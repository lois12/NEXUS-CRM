import { ReactNode } from 'react';

export function HexagonBadge({ children, color = '#00ff88', size = 32 }: { children: ReactNode; color?: string; size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="absolute inset-0">
        <polygon
          points="50,2 93,25 93,75 50,98 7,75 7,25"
          stroke={color}
          strokeWidth="2"
          fill={`${color}10`}
        />
      </svg>
      <span className="relative z-10 font-mono text-xs font-bold" style={{ color }}>
        {children}
      </span>
    </div>
  );
}

export function ScanlineOverlay({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-50 ${className}`}
      style={{
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.03) 2px,
          rgba(0, 0, 0, 0.03) 4px
        )`,
      }}
    />
  );
}

export function CyberDivider({ color = '#00ff88' }: { color?: string }) {
  return (
    <div className="flex items-center gap-2 my-4">
      <div className="flex-1 h-px" style={{ background: `${color}30` }} />
      <svg width="8" height="8" viewBox="0 0 8 8">
        <rect x="1" y="1" width="6" height="6" stroke={color} strokeWidth="1" fill="none" transform="rotate(45 4 4)" />
      </svg>
      <div className="flex-1 h-px" style={{ background: `${color}30` }} />
    </div>
  );
}

export function GlitchText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{
        textShadow: '2px 0 #ff00ff, -2px 0 #00d4ff',
      }}
    >
      {children}
    </span>
  );
}

export function NeonBorder({ children, color = '#00ff88', className = '' }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        border: `1px solid ${color}30`,
        boxShadow: `0 0 15px ${color}15, inset 0 0 15px ${color}05`,
      }}
    >
      {children}
    </div>
  );
}

export function StatusDot({ status, size = 8 }: { status: 'online' | 'offline' | 'busy' | 'away'; size?: number }) {
  const colors = {
    online: '#00ff88',
    offline: '#4a4a60',
    busy: '#ff3b30',
    away: '#eab308',
  };

  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: colors[status],
        boxShadow: `0 0 6px ${colors[status]}80`,
      }}
    />
  );
}

export function CyberCard({ children, className = '', glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div
      className={`glass-card rounded-2xl p-4 ${className}`}
      style={glow ? { boxShadow: '0 0 30px rgba(0, 255, 136, 0.1)' } : undefined}
    >
      {children}
    </div>
  );
}
