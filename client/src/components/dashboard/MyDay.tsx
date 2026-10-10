import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckSquare, Calendar, FileText, ChevronRight } from 'lucide-react';
import { contentApi, kanbanApi, eventsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { ContentPost, KanbanTask } from '../../types';

const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

function todayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function parseLocal(s?: string) {
  if (!s) return null;
  const d = s.includes('T') || s.includes(':') ? new Date(s) : new Date(String(s).replace(/-/g, '/'));
  return isNaN(d.getTime()) ? null : d;
}

/** Mission strip under dashboard hero — daily work at a glance */
export default function MyDay() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [now] = useState(() => new Date());

  useEffect(() => {
    const k = todayKey(new Date());
    (async () => {
      try {
        const [t, c, e] = await Promise.all([
          kanbanApi.getAll(false).catch(() => ({ data: [] as any[] })),
          contentApi.getAll().catch(() => ({ data: [] as any[] })),
          eventsApi.getAll().catch(() => ({ data: [] as any[] })),
        ]);
        setTasks(((t as any).data || []).filter((x: KanbanTask) => x.status !== 'done').slice(0, 4));
        setPosts(
          ((c as any).data || []).filter((p: ContentPost) => {
            const d = parseLocal(p.scheduledDate);
            return d && todayKey(d) === k;
          })
        );
        setEvents(
          ((e as any).data || []).filter((ev: any) => {
            const d = parseLocal(ev.date || ev.eventDate || ev.start);
            return d && todayKey(d) === k;
          })
        );
      } catch { /* soft */ }
    })();
  }, []);

  const month = now.toLocaleDateString('ru-RU', { month: 'long' });
  const day = now.getDate();
  const wd = WEEKDAYS[(now.getDay() + 6) % 7];

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] px-4 md:px-8 mt-5 md:mt-6 relative z-20"
    >
      <div
        className="h-px w-full mb-5 opacity-60"
        style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary), var(--color-accent), transparent)' }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-3 md:gap-4">
        {/* date / identity — asymmetric anchor */}
        <div
          className="hud-panel relative p-5 md:p-7 min-h-[180px] flex flex-col justify-between"
          style={{ background: 'linear-gradient(145deg, rgba(18,20,28,0.95), rgba(10,12,18,0.98))' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.28em] mb-2" style={{ color: 'var(--color-primary)' }}>
                MISSION · СЕГОДНЯ
              </p>
              <h2 className="font-mono text-3xl md:text-5xl font-bold tracking-tight text-white leading-none">
                {String(day).padStart(2, '0')}
              </h2>
              <p className="font-mono text-xs md:text-sm mt-2 text-gray-400 tracking-widest uppercase">
                {month} · {wd}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] text-gray-500 tracking-widest">ОПЕРАТОР</p>
              <p className="font-mono text-xs mt-1 truncate max-w-[140px]" style={{ color: 'var(--color-primary)' }}>
                {user?.fullName || user?.username || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <Stat label="ЗАДАЧИ" value={tasks.length} to="/kanban" />
            <Stat label="ПОСТЫ" value={posts.length} to="/content" />
            <Stat label="СОБЫТИЯ" value={events.length} to="/events" />
          </div>
        </div>

        {/* tasks */}
        <div className="hud-panel p-4 md:p-5 flex flex-col" style={{ background: 'rgba(18,20,28,0.72)' }}>
          <PanelHead icon={<CheckSquare className="w-3.5 h-3.5" />} title="МОИ ЗАДАЧИ" to="/kanban" />
          <ul className="mt-3 space-y-2 flex-1">
            {tasks.length === 0 && <EmptyLine text="нет активных задач" />}
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-xs font-mono text-gray-300">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background:
                      t.priority === 'urgent' || t.priority === 'high'
                        ? '#ff6b6b'
                        : t.priority === 'medium'
                          ? '#eab308'
                          : 'var(--color-primary)',
                  }}
                />
                <span className="truncate">{t.title}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* posts + events */}
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="hud-panel p-4 md:p-5 flex-1" style={{ background: 'rgba(18,20,28,0.72)' }}>
            <PanelHead icon={<FileText className="w-3.5 h-3.5" />} title="ПОСТЫ НА СЕГОДНЯ" to="/content" />
            <div className="mt-3 space-y-2">
              {posts.length === 0 && <EmptyLine text="публикаций нет" />}
              {posts.slice(0, 3).map((p) => (
                <div key={p.id} className="text-xs">
                  <p className="font-mono text-gray-200 truncate">{p.title}</p>
                  <p className="font-mono text-[10px] text-gray-500 uppercase">
                    {(p.platforms?.length ? p.platforms : [p.platform]).join(' · ')} · {p.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="hud-panel p-4 md:p-5" style={{ background: 'rgba(18,20,28,0.72)' }}>
            <PanelHead icon={<Calendar className="w-3.5 h-3.5" />} title="МЕРОПРИЯТИЯ" to="/events" />
            <div className="mt-2">
              {events.length === 0 ? (
                <EmptyLine text="событий нет" />
              ) : (
                <p className="text-xs font-mono text-gray-300 truncate">{events[0]?.title || events[0]?.name}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="group flex items-baseline gap-1.5">
      <span className="font-mono text-xl md:text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
        {value}
      </span>
      <span className="font-mono text-[9px] tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors">
        {label}
      </span>
    </Link>
  );
}

function PanelHead({ icon, title, to }: { icon: React.ReactNode; title: string; to: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
        <h3 className="font-mono text-[10px] tracking-[0.22em] text-gray-400 truncate">{title}</h3>
      </div>
      <Link to={to} className="text-gray-600 hover:text-[var(--color-primary)] transition-colors flex-shrink-0" aria-label={title}>
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="font-mono text-[11px] text-gray-600">// {text}</p>;
}
