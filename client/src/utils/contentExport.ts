import type { ContentPost } from '../types';

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes('T')) return new Date(dateStr);
  const [datePart, timePart] = dateStr.split(' ');
  if (datePart && datePart.includes('-')) {
    const [y, m, d] = datePart.split('-').map(Number);
    const [h, min] = (timePart || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, h || 0, min || 0);
  }
  return new Date(dateStr);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function fmtDateTime(s?: string): string {
  if (!s) return '—';
  const d = parseLocalDate(s);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`;
}

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function platformsOf(post: ContentPost): string {
  const tags = post.platforms?.length ? post.platforms : post.platform ? [post.platform] : ['telegram'];
  return tags.join(', ');
}

export function getWeekRange(anchor?: Date): { start: Date; end: Date } {
  const start = startOfWeek(anchor || new Date());
  return { start, end: addDays(start, 6) };
}

export function postsForWeek(posts: ContentPost[], anchor?: Date): ContentPost[] {
  const { start, end } = getWeekRange(anchor);
  const startMs = start.getTime();
  const endMs = addDays(end, 1).getTime() - 1;
  return posts.filter((p) => {
    const src = p.scheduledDate || p.createdAt;
    if (!src) return false;
    const t = parseLocalDate(src).getTime();
    return t >= startMs && t <= endMs;
  });
}

/** Download week as CSV (BOM + `;` for Excel RU) */
export function exportWeekCsv(posts: ContentPost[], anchor?: Date) {
  const { start, end } = getWeekRange(anchor);
  const week = postsForWeek(posts, anchor);
  const header = ['Дата', 'Время', 'День', 'Заголовок', 'Текст', 'Площадки', 'Статус', 'Автор'];
  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const rows = week
    .slice()
    .sort((a, b) => {
      const da = parseLocalDate(a.scheduledDate || a.createdAt).getTime();
      const db = parseLocalDate(b.scheduledDate || b.createdAt).getTime();
      return da - db;
    })
    .map((p) => {
      const d = parseLocalDate(p.scheduledDate || p.createdAt);
      return [
        fmtDate(d),
        p.scheduledDate?.includes('T') || p.scheduledDate?.includes(':') ? fmtDateTime(p.scheduledDate).split(' ')[1] : '—',
        weekdays[(d.getDay() + 6) % 7],
        p.title,
        stripHtml(p.content).slice(0, 200),
        platformsOf(p),
        p.status,
        p.authorName || '',
      ];
    });

  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `content-plan_${fmtDate(start)}-${fmtDate(end)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Open printable week PDF (window.print) */
export function exportWeekPdf(posts: ContentPost[], anchor?: Date) {
  const { start, end } = getWeekRange(anchor);
  const week = postsForWeek(posts, anchor);
  const byDay = new Map<string, ContentPost[]>();
  for (const p of week) {
    const d = parseLocalDate(p.scheduledDate || p.createdAt);
    const k = dayKey(d);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(p);
  }

  const weekdays = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  const daysHtml: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    const list = (byDay.get(dayKey(day)) || []).sort((a, b) => {
      const da = parseLocalDate(a.scheduledDate || a.createdAt).getTime();
      const db = parseLocalDate(b.scheduledDate || b.createdAt).getTime();
      return da - db;
    });
    daysHtml.push(`
      <div class="day">
        <div class="day-h">${fmtDate(day)} · ${weekdays[i]}</div>
        ${list.length === 0 ? '<div class="empty">— постов нет —</div>' : list.map((p) => `
          <div class="post">
            <div class="meta"><b>${platformsOf(p)}</b> · ${p.status}</div>
            <div class="title">${p.title}</div>
            <div class="text">${stripHtml(p.content).slice(0, 400)}</div>
          </div>
        `).join('')}
      </div>
    `);
  }

  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<title>Контент-план ${fmtDate(start)} — ${fmtDate(end)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 28px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #555; font-size: 12px; margin-bottom: 18px; }
  .day { border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .day-h { font-weight: 700; font-size: 13px; margin-bottom: 6px; color: #0f766e; }
  .post { padding: 6px 0; border-top: 1px dashed #eee; }
  .post:first-of-type { border-top: none; }
  .meta { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; }
  .title { font-size: 13px; font-weight: 600; margin: 2px 0; }
  .text { font-size: 11px; color: #333; }
  .empty { font-size: 11px; color: #999; padding: 4px 0; }
  .footer { margin-top: 16px; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
</style></head>
<body>
  <h1>NEXUS CRM · Контент-план</h1>
  <div class="sub">Неделя ${fmtDate(start)} — ${fmtDate(end)} · постов: ${week.length}</div>
  ${daysHtml.join('')}
  <div class="footer">Сформировано ${new Date().toLocaleString('ru-RU')}</div>
  <script>window.onload = () => window.print();</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
