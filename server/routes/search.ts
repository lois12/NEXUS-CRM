import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query } from '../db/database';

const router = Router();

function hasRole(user: AuthRequest['user'], ...roles: string[]): boolean {
  if (!user) return false;
  const userRoles = user.roles?.length ? user.roles : [user.role];
  return roles.some(r => userRoles.includes(r));
}

// Case-insensitive LIKE for Cyrillic — SQLite LOWER() doesn't work for non-ASCII
function ciLike(value: string | null, term: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(term);
}

// Extract a snippet around the match
function findSnippet(text: string | null, term: string, ctxLen: number = 60): string {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(term);
  if (idx === -1) return '';
  const start = Math.max(0, idx - ctxLen);
  const end = Math.min(text.length, idx + term.length + ctxLen);
  let snippet = text.slice(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
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

    // Kanban tasks — personal only
    if (results.length < 20) {
      const tasks = query(`SELECT id, title, status AS subtitle FROM kanban_tasks WHERE userId = ? AND archived = 0`, [user?.id]);
      for (const t of tasks) {
        if (ciLike(t.title, term)) {
          results.push({ ...t, type: 'task', link: '/kanban', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Projects (search title + description)
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

    // Events (search title + location)
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор', 'smm')) {
      const rows = query(`SELECT id, title, COALESCE(date, status) AS subtitle, location FROM events`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.location, term)) {
          results.push({ id: r.id, title: r.title, subtitle: r.subtitle || '', type: 'event', link: '/events', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Content (search title + description)
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор', 'smm')) {
      const rows = query(`SELECT id, title, platform AS subtitle, content FROM content_posts`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.content, term)) {
          const sub = ciLike(r.content, term) ? findSnippet(r.content, term) : (r.subtitle || '');
          results.push({ id: r.id, title: r.title, subtitle: sub, type: 'content', link: '/content', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Partners (search name + category + notes + contactPerson)
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор')) {
      const rows = query(`SELECT id, name AS title, category AS subtitle, notes, contactPerson FROM partners`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.subtitle, term) || ciLike(r.notes, term) || ciLike(r.contactPerson, term)) {
          results.push({ id: r.id, title: r.title, subtitle: r.subtitle || '', type: 'partner', link: '/partners', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Ideas (search title + content)
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор', 'smm', 'документовед')) {
      const rows = query(`SELECT id, title, content FROM ideas`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.content, term)) {
          const sub = ciLike(r.content, term) ? findSnippet(r.content, term) : '';
          results.push({ id: r.id, title: r.title, subtitle: sub, type: 'idea', link: '/ideas', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Knowledge (search title, content, category, tags)
    if (results.length < 20) {
      const rows = query(`SELECT id, title, content, category, tags FROM knowledge_base`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.category, term) || ciLike(r.tags, term) || ciLike(r.content, term)) {
          const subtitle = ciLike(r.content, term) ? findSnippet(r.content, term) : (r.category || '');
          results.push({ id: r.id, title: r.title, subtitle, type: 'knowledge', link: '/knowledge', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Inventory (search name + location + type)
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'мол')) {
      const rows = query(`SELECT id, name AS title, location AS subtitle, type FROM inventory`);
      for (const r of rows) {
        if (ciLike(r.title, term) || ciLike(r.subtitle, term) || ciLike(r.type, term)) {
          results.push({ id: r.id, title: r.title, subtitle: r.subtitle || '', type: 'inventory', link: '/inventory', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    // Materials
    if (results.length < 20 && hasRole(user, 'super_admin', 'руководитель', 'редактор', 'smm', 'документовед')) {
      const rows = query(`SELECT id, name AS title, folder AS subtitle FROM materials`);
      for (const r of rows) {
        if (ciLike(r.title, term)) {
          results.push({ ...r, type: 'material', link: '/materials', avatar: '' });
          if (results.length >= 20) break;
        }
      }
    }

    res.json({ success: true, data: results.slice(0, 20) });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
