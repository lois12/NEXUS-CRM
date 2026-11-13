import { useEffect, useRef, useState } from 'react';
import { connectSocket } from '../../services/socket';
import { usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface Note {
  key: number;
  name: string;
  online: boolean;
}

/**
 * Ненавязчивые уведомления о входе/выходе пользователей.
 * Пилюля в правом нижнем углу на 2 секунды, экран не блокирует.
 */
export default function PresenceToasts() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const prevIdsRef = useRef<Set<string> | null>(null);
  const namesRef = useRef<Map<string, string>>(new Map());
  const keyRef = useRef(0);

  // имена пользователей — один раз
  useEffect(() => {
    usersApi.getAll().then(res => {
      if (res.success && res.data) {
        const m = new Map<string, string>();
        for (const u of res.data) m.set(u.id, u.fullName || u.username);
        namesRef.current = m;
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const socket = connectSocket(user.id);
    if (!socket) return;

    const handleOnline = (ids: string[]) => {
      const next = new Set(ids);
      const prev = prevIdsRef.current;
      prevIdsRef.current = next;
      // первый снимок — просто базовая линия, без тостов
      if (!prev) return;

      const added: string[] = [];
      const removed: string[] = [];
      next.forEach(id => { if (!prev.has(id)) added.push(id); });
      prev.forEach(id => { if (!next.has(id)) removed.push(id); });

      const push = (userId: string, online: boolean) => {
        if (userId === user.id) return;
        const name = namesRef.current.get(userId) || 'Пользователь';
        const key = ++keyRef.current;
        setNotes(n => [...n.slice(-2), { key, name, online }]);
        setTimeout(() => setNotes(n => n.filter(x => x.key !== key)), 2000);
      };

      added.forEach(id => push(id, true));
      removed.forEach(id => push(id, false));
    };

    socket.on('users:online', handleOnline);
    return () => { socket.off('users:online', handleOnline); };
  }, [user?.id]);

  if (notes.length === 0) return null;

  return (
    <div
      className="fixed right-4 z-[90] flex flex-col items-end gap-2 pointer-events-none"
      style={{ bottom: 'calc(6rem + 40px)' }}
      aria-live="polite"
    >
      {notes.map(n => (
        <div
          key={n.key}
          className="nx-tile px-3.5 py-2 flex items-center gap-2.5 pointer-events-auto"
          style={{ minWidth: 190 }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: n.online ? '#00ff88' : '#6b7280',
              boxShadow: n.online ? '0 0 8px rgba(0,255,136,0.55)' : 'none',
            }}
          />
          <div className="min-w-0">
            <p className="text-xs text-gray-200 truncate leading-tight">{n.name}</p>
            <p className="font-mono text-[9px] tracking-wider" style={{ color: n.online ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}>
              {n.online ? 'ОНЛАЙН' : 'ОФФЛАЙН'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
