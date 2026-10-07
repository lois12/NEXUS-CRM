import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Copy,
  Calendar,
} from 'lucide-react';
import { ContentPost, SocialPlatform } from '../../types';

const platformColors: Record<SocialPlatform, string> = {
  telegram: '#0088cc',
  vk: '#0077ff',
  site: '#00ff88',
  max: '#ff6600',
};

const platformLabels: Record<SocialPlatform, string> = {
  telegram: 'ТГ',
  vk: 'VK',
  site: 'Web',
  max: 'MAX',
};

const statusColors: Record<string, string> = {
  черновик: '#6b7280',
  запланирован: '#00d4ff',
  опубликован: '#22c55e',
  на_доработку: '#eab308',
  согласован: '#00d4ff',
  утверждён: '#bf00ff',
};

const statusLabels: Record<string, string> = {
  черновик: 'Черновик',
  запланирован: 'Запланирован',
  опубликован: 'Опубликован',
  на_доработку: 'Доработка',
  согласован: 'Согласован',
  утверждён: 'Утверждён',
};

const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_NOM = [
  'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
  'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ',
];

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

function formatDayLabel(date: Date): string {
  return `${date.getDate()} ${MONTHS_GEN[date.getMonth()]} ${date.getFullYear()}, ${WEEKDAYS[(date.getDay() + 6) % 7]}`;
}

function formatShort(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

function getPostPlatforms(post: ContentPost): SocialPlatform[] {
  if (post.platforms?.length) return post.platforms;
  return post.platform ? [post.platform] : ['telegram'];
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

interface WeekAccordionViewProps {
  posts: ContentPost[];
  filterPlatform: SocialPlatform | 'all';
  canEdit: boolean;
  onEdit: (post: ContentPost) => void;
  onDelete: (id: string) => void;
  onDuplicate: (post: ContentPost) => void;
  onCreateForDate: (date: Date) => void;
}

export default function WeekAccordionView({
  posts,
  filterPlatform,
  canEdit,
  onEdit,
  onDelete,
  onDuplicate,
  onCreateForDate,
}: WeekAccordionViewProps) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [openWeekKey, setOpenWeekKey] = useState<string | null>(() => {
    const t = startOfWeek(new Date());
    return formatShort(t);
  });
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);

  const weeks = useMemo(() => {
    // 6 weeks starting from anchor (covers any month fully when navigating)
    const list: Date[] = [];
    for (let i = 0; i < 6; i++) list.push(addDays(anchor, i * 7));
    return list;
  }, [anchor]);

  const postsForDay = (date: Date) =>
    posts.filter((post) => {
      const src = post.scheduledDate || post.createdAt;
      if (!src) return false;
      const postDate = parseLocalDate(src);
      if (!sameDay(postDate, date)) return false;
      if (filterPlatform !== 'all' && !getPostPlatforms(post).includes(filterPlatform)) return false;
      return true;
    });

  const countForWeek = (weekStart: Date) => {
    let n = 0;
    for (let i = 0; i < 7; i++) n += postsForDay(addDays(weekStart, i)).length;
    return n;
  };

  const navLabel = `${formatShort(anchor)} — ${formatShort(addDays(anchor, 41))}`;
  const today = new Date();

  return (
    <div>
      {/* Header nav */}
      <div className="flex items-center justify-between mb-4 md:mb-5 gap-2">
        <motion.button
          whileHover={{ scale: 1.08, x: -2 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setAnchor((p) => addDays(p, -7))}
          className="p-2 md:p-2.5 rounded-xl glass hover:glass-accent transition-all flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--color-primary)' }} />
        </motion.button>

        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <h2 className="text-xs sm:text-sm md:text-lg font-bold font-mono text-gray-200 tracking-wider truncate">
            {navLabel}
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const t = startOfWeek(new Date());
              setAnchor(t);
              setOpenWeekKey(formatShort(t));
              setOpenDayKey(formatShort(new Date()));
            }}
            className="px-2.5 md:px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-mono glass hover:glass-accent transition-all flex-shrink-0"
            style={{ color: 'var(--color-primary)' }}
          >
            СЕГОДНЯ
          </motion.button>
        </div>

        <motion.button
          whileHover={{ scale: 1.08, x: 2 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setAnchor((p) => addDays(p, 7))}
          className="p-2 md:p-2.5 rounded-xl glass hover:glass-accent transition-all flex-shrink-0"
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--color-primary)' }} />
        </motion.button>
      </div>

      {/* Month strip */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Array.from(new Set(weeks.map((w) => `${w.getFullYear()}-${w.getMonth()}`))).map((key) => {
          const [y, m] = key.split('-').map(Number);
          return (
            <span
              key={key}
              className="px-3 py-1 rounded-lg text-[10px] font-mono tracking-widest"
              style={{ background: 'rgba(0,255,136,0.08)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}
            >
              {MONTHS_NOM[m]} {y}
            </span>
          );
        })}
      </div>

      {/* Weeks accordion */}
      <div className="space-y-3">
        {weeks.map((weekStart, wi) => {
          const weekEnd = addDays(weekStart, 6);
          const weekKey = formatShort(weekStart);
          const isOpen = openWeekKey === weekKey;
          const postCount = countForWeek(weekStart);
          const isCurrentWeek = sameDay(startOfWeek(today), weekStart);

          return (
            <div
              key={weekKey}
              className="glass rounded-2xl overflow-hidden"
              style={isCurrentWeek ? { border: '1px solid rgba(0,255,136,0.35)', boxShadow: '0 0 20px rgba(0,255,136,0.12)' } : {}}
            >
              {/* Week header */}
              <button
                onClick={() => {
                  setOpenWeekKey(isOpen ? null : weekKey);
                  if (!isOpen) setOpenDayKey(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isCurrentWeek ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                    color: isCurrentWeek ? '#000' : 'var(--color-primary)',
                    boxShadow: isCurrentWeek ? '0 0 12px var(--color-glow)' : 'none',
                  }}
                >
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono tracking-widest" style={{ color: 'var(--color-primary)' }}>
                    НЕДЕЛЯ {wi + 1}
                    {isCurrentWeek && <span className="ml-2 text-[10px] opacity-80">// ТЕКУЩАЯ</span>}
                  </div>
                  <div className="text-sm font-bold font-mono text-gray-200 truncate">
                    {formatShort(weekStart)} — {formatShort(weekEnd)}
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex-shrink-0"
                  style={{
                    background: postCount > 0 ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.04)',
                    color: postCount > 0 ? 'var(--color-primary)' : '#6b7280',
                  }}
                >
                  {postCount}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Days */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-1.5">
                      {Array.from({ length: 7 }, (_, di) => {
                        const day = addDays(weekStart, di);
                        const dayKey = formatShort(day);
                        const dayPosts = postsForDay(day);
                        const isDayOpen = openDayKey === dayKey;
                        const isToday = sameDay(day, today);
                        const isWeekend = di >= 5;

                        return (
                          <div
                            key={dayKey}
                            className="rounded-xl overflow-hidden"
                            style={{
                              background: isToday ? 'rgba(0,255,136,0.06)' : 'rgba(255,255,255,0.02)',
                              border: isToday ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <button
                              onClick={() => setOpenDayKey(isDayOpen ? null : dayKey)}
                              className="w-full flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                            >
                              <span
                                className="text-xs font-mono font-bold w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={
                                  isToday
                                    ? { background: 'var(--color-primary)', color: '#000', boxShadow: '0 0 10px var(--color-glow)' }
                                    : isWeekend
                                    ? { color: '#ff6b6b', background: 'rgba(255,107,107,0.1)' }
                                    : { color: '#9ca3af', background: 'rgba(255,255,255,0.05)' }
                                }
                              >
                                {day.getDate()}
                              </span>
                              <span className={`flex-1 text-[11px] sm:text-xs md:text-sm font-mono truncate ${isWeekend ? 'text-gray-400' : 'text-gray-200'}`}>
                                {formatDayLabel(day)}
                              </span>
                              {isToday && (
                                <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)' }}>
                                  СЕГОДНЯ
                                </span>
                              )}
                              <span
                                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                style={{
                                  background: dayPosts.length ? 'rgba(0,212,255,0.12)' : 'transparent',
                                  color: dayPosts.length ? '#00d4ff' : '#4a4a60',
                                }}
                              >
                                {dayPosts.length}
                              </span>
                              {canEdit && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCreateForDate(day);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.stopPropagation();
                                      onCreateForDate(day);
                                    }
                                  }}
                                  className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
                                  title="Добавить пост"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-gray-600 transition-transform flex-shrink-0 ${isDayOpen ? 'rotate-180' : ''}`}
                              />
                            </button>

                            <AnimatePresence>
                              {isDayOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-3 space-y-2">
                                    {dayPosts.length === 0 ? (
                                      <div className="text-xs font-mono text-gray-500 py-2 px-1">
                                        // ПОСТОВ НЕТ
                                      </div>
                                    ) : (
                                      dayPosts.map((post) => {
                                        const tags = getPostPlatforms(post);
                                        const sc = statusColors[post.status] || '#6b7280';
                                        return (
                                          <div
                                            key={post.id}
                                            className="glass-card rounded-xl p-3 group"
                                          >
                                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                              <div className="flex flex-wrap items-center gap-1">
                                                {tags.map((t) => (
                                                  <span
                                                    key={t}
                                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                                                    style={{
                                                      background: `${platformColors[t] || '#6b7280'}30`,
                                                      color: platformColors[t] || '#9ca3af',
                                                    }}
                                                  >
                                                    {platformLabels[t] || t}
                                                  </span>
                                                ))}
                                              </div>
                                              <span
                                                className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                                                style={{ background: `${sc}20`, color: sc }}
                                              >
                                                {statusLabels[post.status] || post.status}
                                              </span>
                                            </div>
                                            <div className="text-sm font-medium text-gray-200 mb-1">{post.title}</div>
                                            <div
                                              className="text-xs text-gray-400 line-clamp-2 mb-2"
                                              dangerouslySetInnerHTML={{ __html: post.content }}
                                            />
                                            {canEdit && (
                                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  onClick={() => onEdit(post)}
                                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono glass text-gray-400 hover:text-gray-200"
                                                >
                                                  <Edit className="w-3 h-3" /> ИЗМЕНИТЬ
                                                </button>
                                                <button
                                                  onClick={() => onDuplicate(post)}
                                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono glass text-gray-400 hover:text-gray-200"
                                                >
                                                  <Copy className="w-3 h-3" /> КОПИЯ
                                                </button>
                                                <button
                                                  onClick={() => onDelete(post.id)}
                                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono glass text-red-400 hover:text-red-300"
                                                >
                                                  <Trash2 className="w-3 h-3" /> УДАЛИТЬ
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
