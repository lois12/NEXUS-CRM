import { GLASS_BG, GLASS_BLUR, GLOW_GREEN } from './chatConstants';
import { url } from './chatUtils';
import { formatLastSeenKR, isTodayKR, isYesterdayKR, formatDateKR } from '../../utils/timezone';

// ── Online check helper ──
export const isOnline = (lastSeen?: string) => {
  if (!lastSeen) return false;
  const diff = Date.now() - new Date(lastSeen + 'Z').getTime();
  return diff < 5 * 60 * 1000;
};

export const formatLastSeen = (lastSeen?: string) => formatLastSeenKR(lastSeen);

// ── Avatar ──
export function Avatar({ name, avatar, size = 'md', onClick, glow, lastSeen }: { name?: string; avatar?: string; size?: 'sm' | 'md' | 'lg'; onClick?: () => void; glow?: boolean; lastSeen?: string }) {
  const sz = size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-sm';
  return (
    <div className="relative inline-flex">
      <div onClick={onClick} className={`${sz} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-105' : ''} ${glow ? 'ring-2 ring-offset-1 ring-[var(--color-primary)] ring-offset-[var(--color-bg)]' : ''}`}
        style={{ border: '1.5px solid rgba(255,255,255,0.1)', background: GLASS_BG, backdropFilter: GLASS_BLUR, boxShadow: glow ? GLOW_GREEN : 'none' }}>
        {avatar ? <img loading="lazy" decoding="async" src={url(avatar)} alt="" className="w-full h-full object-cover" /> : <span className="font-mono font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 8px rgba(0,255,136,0.4)' }}>{name?.charAt(0) || '?'}</span>}
      </div>
      {lastSeen !== undefined && <OnlineBadge lastSeen={lastSeen} size={size === 'sm' ? 'sm' : 'md'} />}
    </div>
  );
}

// ── Online Badge ──
export function OnlineBadge({ lastSeen, size = 'sm' }: { lastSeen?: string; size?: 'sm' | 'md' }) {
  const online = isOnline(lastSeen);
  const sz = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <div className={`${sz} rounded-full absolute -bottom-0.5 -right-0.5`}
      style={{
        background: online ? '#00ff88' : '#4a4a60',
        border: '2px solid var(--color-bg)',
        boxShadow: online ? '0 0 6px rgba(0,255,136,0.5)' : 'none',
      }}
      title={online ? 'В сети' : `Был(а) ${formatLastSeen(lastSeen)}`}
    />
  );
}

// ── Date Separator ──
export function DateSeparator({ date }: { date: string }) {
  let label: string;
  if (isTodayKR(date)) label = 'Сегодня';
  else if (isYesterdayKR(date)) label = 'Вчера';
  else label = formatDateKR(date, { day: 'numeric', month: 'long' });

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <span className="text-[10px] font-mono px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: '#5a5a70', border: '1px solid rgba(255,255,255,0.06)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  );
}

// ── Side Panel ──
export function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: 'rgba(10,10,18,0.95)', backdropFilter: 'blur(20px)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-primary)' }}>{title}</span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><span className="text-gray-400">✕</span></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}