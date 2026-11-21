import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../db/database';

function hasRole(user: AuthRequest['user'], ...roles: string[]): boolean {
  if (!user) return false;
  const userRoles = user.roles?.length ? user.roles : [user.role];
  return roles.some(r => userRoles.includes(r));
}

function ciLike(value: string | null, term: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(term);
}

/** Вырезаем HTML-теги: сниппеты должны быть текстом, а не «tml&gt;» */
function stripHtml(s: string): string {
  return String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function findSnippet(text: string | null, term: string, ctxLen: number = 60): string {
  if (!text) return '';
  const plain = stripHtml(String(text));
  const idx = plain.toLowerCase().indexOf(term);
  if (idx === -1) return '';
  const start = Math.max(0, idx - ctxLen);
  const end = Math.min(plain.length, idx + term.length + ctxLen);
  let snippet = plain.slice(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < plain.length) snippet = snippet + '...';
  return snippet;
}

export function searchAll(req: AuthRequest, res: Response) {
  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 2) {
    return res.json({ success: true, data: [] });
  }

  const term = q.toLowerCase();
  const user = req.user;

  try {
    const results: any[] = [];

    // Users
    const users = query(`SELECT id, fullName AS title, username AS subtitle, avatar FROM users`);
    for (const u of users) {
      if (ciLike(u.title, term) || ciLike(u.subtitle, term)) {
        results.push({ ...u, type: 'user', link: '/users' });
        if (results.length >= 20) break;
      }
    }

    // Kanban tasks
    if (results.length < 20) {
      const tasks = query(`SELECT id, title, status AS subtitle FROM kanban_tasks WHERE userId = ? AND archived = 0`, [user?.id]);
      for (const t of tasks) {
        if (ciLike(t.title, term)) {
          results.push({ ...t, type: 'task', link: '/kanban', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Projects
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор', 'smm', 'документовед')) {
      const rows = query(`SELECT id, title, description, status AS subtitle FROM projects`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.description, term)) {
          const sub = ciLike(r.description, term) ? findSnippet(r.description, term) : (r.subtitle || '');
          results.push({ id: r.id, title: r.title, subtitle: sub, type: 'project', link: '/projects', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Events
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор', 'smm')) {
      const rows = query(`SELECT id, title, COALESCE(date, status) AS subtitle, location FROM events`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.location, term)) {
          results.push({ id: r.id, title: r.title, subtitle: r.subtitle || '', type: 'event', link: '/events', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Content
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор', 'smm')) {
      const rows = query(`SELECT id, title, platform AS subtitle, content FROM content_posts`);
      for (const r of rows) {
        const plain = stripHtml(r.content || '');
        if (ciLike(r.title, term) || ciLike(plain, term)) {
          const sub = ciLike(plain, term) ? findSnippet(plain, term) : (r.subtitle || '');
          results.push({ id: r.id, title: r.title, subtitle: sub, type: 'content', link: `/content?post=${r.id}`, avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Quizzes
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'информационный', 'туризм', 'редактор', 'smm', 'документовед')) {
      const rows = query(`SELECT id, title, organizer AS subtitle, description FROM quizzes`);
      for (const r of rows) {
        const plain = stripHtml(r.description || '');
        if (ciLike(r.title, term) || ciLike(plain, term)) {
          const sub = ciLike(plain, term) ? findSnippet(plain, term) : (r.subtitle || '');
          results.push({ id: r.id, title: r.title, subtitle: sub, type: 'quiz', link: '/quizzes', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Surveys
    if (results.length < 20) {
      const rows = query(`SELECT id, name AS title, description FROM surveys`);
      for (const r of rows) {
        const plain = stripHtml(r.description || '');
        if (ciLike(r.title, term) || ciLike(plain, term)) {
          const sub = ciLike(plain, term) ? findSnippet(plain, term) : '';
          results.push({ id: r.id, title: r.title, subtitle: sub, type: 'survey', link: '/surveys', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Registrations
    if (results.length < 20) {
      const rows = query(`SELECT id, title, description, location, eventDate FROM registrations`);
      for (const r of rows) {
        const plain = stripHtml(r.description || '');
        if (ciLike(r.title, term) || ciLike(plain, term) || ciLike(r.location, term)) {
          const sub = ciLike(plain, term) ? findSnippet(plain, term) : (r.location || r.eventDate || '');
          results.push({ id: r.id, title: r.title, subtitle: sub, type: 'registration', link: '/registrations', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Partners
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор')) {
      const rows = query(`SELECT id, name AS title, category AS subtitle, notes, contactPerson FROM partners`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.subtitle, term) || ciLike(r.notes, term) || ciLike(r.contactPerson, term)) {
          results.push({ id: r.id, title: r.title, subtitle: r.subtitle || '', type: 'partner', link: '/partners', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Ideas
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор', 'smm', 'документовед')) {
      const rows = query(`SELECT id, title, content FROM ideas`);
      for (const r of rows) {
        const plain = stripHtml(r.content || '');
        if (ciLike(r.title, term) || ciLike(plain, term)) {
          const sub = ciLike(plain, term) ? findSnippet(plain, term) : '';
          results.push({ id: r.id, title: r.title, subtitle: sub, type: 'idea', link: '/ideas', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Knowledge
    if (results.length < 20) {
      const rows = query(`SELECT id, title, content, category, tags FROM knowledge_base`);
      for (const r of rows) {
        const plain = stripHtml(r.content || '');
        if (ciLike(r.title, term) || ciLike(r.category, term) || ciLike(r.tags, term) || ciLike(plain, term)) {
          const subtitle = ciLike(plain, term) ? findSnippet(plain, term) : (r.category || '');
          results.push({ id: r.id, title: r.title, subtitle, type: 'knowledge', link: '/knowledge', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Inventory
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'мол')) {
      const rows = query(`SELECT id, name AS title, location AS subtitle, type FROM inventory`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.subtitle, term) || ciLike(r.type, term)) {
          results.push({ id: r.id, title: r.title, subtitle: r.subtitle || '', type: 'inventory', link: '/inventory', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Materials — name + text-file content
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор', 'smm', 'документовед', 'информационный', 'туризм')) {
      const rows = query(`SELECT id, name AS title, folder AS subtitle, url, mimeType FROM materials`);
      for (const r of rows) {
        let hit = ciLike(r.title, term) || ciLike(r.subtitle, term);
        let snippet = hit && ciLike(r.subtitle, term) ? String(r.subtitle || '') : '';
        if (!hit) {
          const snip = textFileSnippet(r.url, r.mimeType, term);
          if (snip) {
            hit = true;
            snippet = snip;
          }
        }
        if (hit) {
          results.push({
            id: r.id,
            title: r.title,
            subtitle: snippet || r.subtitle || '',
            type: 'material',
            link: '/materials',
            avatar: '',
          });
          if (results.length >= 20) break;
        }
      }
    }

    res.json({ success: true, data: results.slice(0, 20) });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
}

const TEXT_EXT = /\.(txt|md|csv|json|html?|xml|log|yml|yaml|tsv|sql|js|ts|tsx|css)$/i;

/** Read small text files and find a snippet around the query */
function textFileSnippet(url: string | null, mimeType: string | null, term: string): string | null {
  if (!url) return null;
  // only text-ish files (avoid binary/pdf)
  const looksText = TEXT_EXT.test(url) || (mimeType || '').startsWith('text/') || (mimeType || '').includes('json');
  if (!looksText) return null;
  try {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const { UPLOADS_DIR } = require('../paths') as typeof import('../paths');
    // url like /uploads/filename.ext
    const file = path.basename(String(url).split('?')[0]);
    const full = path.join(UPLOADS_DIR, file);
    const st = fs.statSync(full);
    if (st.size > 512 * 1024) return null; // skip >512KB
    const text = fs.readFileSync(full, 'utf8');
    const idx = text.toLowerCase().indexOf(term);
    if (idx === -1) return null;
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + term.length + 60);
    return '…' + text.slice(start, end).replace(/\s+/g, ' ').trim() + '…';
  } catch {
    return null;
  }
}