import { createElement } from 'react';
import { User } from '../../types';
import { SOUNDS } from './chatConstants';
import { formatTimeKR } from '../../utils/timezone';

export function playSound(id: string) {
  const s = SOUNDS.find(x => x.id === id);
  if (!s || !s.freq.length) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    s.freq.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * s.dur);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i + 1) * s.dur);
      o.start(ctx.currentTime + i * s.dur); o.stop(ctx.currentTime + (i + 1) * s.dur);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

export function url(u: string) { return u.startsWith('http') ? u : u; }

export function extractMentions(text: string, users: User[]) {
  const r: string[] = [];
  const re = /@(\w+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const u = users.find(u => u.username.toLowerCase() === m![1].toLowerCase() || u.fullName.toLowerCase().includes(m![1].toLowerCase()));
    if (u) r.push(u.id);
  }
  return r;
}

export function renderMentions(text: string, ids: string, users: User[]) {
  if (!ids) return text;
  const idArr = ids.split(',').filter(Boolean);
  if (!idArr.length) return text;
  return text.split(/(@\w+)/g).map((p, i) => {
    if (p.startsWith('@')) {
      const u = users.find(u => u.username.toLowerCase() === p.substring(1).toLowerCase());
      if (u) return createElement('span', { key: i, className: 'font-bold', style: { color: '#00d4ff' } }, p);
    }
    return p;
  });
}

export function renderRichText(children: any, mentionIds: string, users: User[]): any {
  // Process React children to detect @mentions and #task references
  if (typeof children === 'string') {
    const parts: any[] = [];
    let key = 0;
    // Split by @mentions and #task patterns
    const regex = /(@\w+|#task[\s-]+\d+|#задача[\s-]+\d+)/gi;
    let lastIdx = 0;
    let match;
    while ((match = regex.exec(children)) !== null) {
      if (match.index > lastIdx) parts.push(children.slice(lastIdx, match.index));
      const token = match[0];
      if (token.startsWith('@')) {
        parts.push(createElement('span', { key: key++, className: 'font-bold', style: { color: '#00d4ff' } }, token));
      } else {
        parts.push(createElement('span', { key: key++, className: 'font-bold cursor-pointer underline', style: { color: '#eab308' }, onClick: () => { window.dispatchEvent(new CustomEvent('nexus:open-task', { detail: { token } })); } }, token));
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < children.length) parts.push(children.slice(lastIdx));
    return parts.length > 0 ? parts : children;
  }
  // If children is an array (React elements), recurse
  if (Array.isArray(children)) return children.map((child) => typeof child === 'string' ? renderRichText(child, mentionIds, users) : child);
  return children;
}

export function fmtMsgTime(d: string) {
  // SQLite datetime('now') returns UTC without 'Z' suffix — force UTC parse
  const date = d && !d.endsWith('Z') && !d.includes('+') ? new Date(d + 'Z') : new Date(d);
  return formatTimeKR(date);
}
export function fmtTime(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
