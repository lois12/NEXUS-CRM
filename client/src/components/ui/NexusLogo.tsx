interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  variant?: 'full' | 'icon' | 'favicon';
}

const LOGO_DEFS = (
  <defs>
    {/* Main gradient - neon green to cyan */}
    <linearGradient id="nexus-grad-main" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#00ff88" />
      <stop offset="50%" stopColor="#00e67a" />
      <stop offset="100%" stopColor="#00d4ff" />
    </linearGradient>

    {/* Subtle fill gradient */}
    <linearGradient id="nexus-grad-fill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#00ff88" stopOpacity="0.15" />
      <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.05" />
    </linearGradient>

    {/* Border gradient */}
    <linearGradient id="nexus-grad-border" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#00ff88" stopOpacity="0.8" />
      <stop offset="50%" stopColor="#00d4ff" stopOpacity="0.6" />
      <stop offset="100%" stopColor="#00ff88" stopOpacity="0.4" />
    </linearGradient>

    {/* Glow filter */}
    <filter id="nexus-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 1 0 0 0.5  0 0 0 0 0.3  0 0 0 0.6 0" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    {/* Strong glow for accent */}
    <filter id="nexus-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 1 0 0 0.5  0 0 0 0 0.3  0 0 0 0.4 0" />
    </filter>

    {/* Inner shadow */}
    <filter id="nexus-inner-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feComponentTransfer in="SourceAlpha">
        <feFuncA type="table" tableValues="1 0" />
      </feComponentTransfer>
      <feGaussianBlur stdDeviation="2" />
      <feOffset dx="0" dy="1" result="offsetblur" />
      <feFlood floodColor="#00ff88" floodOpacity="0.3" result="color" />
      <feComposite in2="offsetblur" operator="in" />
      <feComposite in2="SourceAlpha" operator="in" />
      <feMerge>
        <feMergeNode in="SourceGraphic" />
        <feMergeNode />
      </feMerge>
    </filter>
  </defs>
);

function HexagonShape({ cx, cy, r, stroke, strokeWidth, fill, opacity = 1 }: {
  cx: number; cy: number; r: number;
  stroke?: string; strokeWidth?: number;
  fill?: string; opacity?: number;
}) {
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');

  return (
    <polygon
      points={points}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill={fill}
      opacity={opacity}
    />
  );
}

export function NexusLogo({ size = 40, className = '', showText = true, variant = 'full' }: LogoProps) {
  if (variant === 'favicon') {
    return <NexusFavicon size={size} className={className} />;
  }

  if (variant === 'icon') {
    return <NexusIcon size={size} className={className} />;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {LOGO_DEFS}

        {/* Background circle with subtle gradient */}
        <circle cx="60" cy="60" r="56" fill="#0a0a0f" />
        <circle cx="60" cy="60" r="56" fill="url(#nexus-grad-fill)" opacity="0.3" />

        {/* Outer hexagon - decorative, thin */}
        <HexagonShape cx={60} cy={60} r={52} stroke="url(#nexus-grad-border)" strokeWidth={1} opacity={0.4} />

        {/* Middle hexagon - main border */}
        <HexagonShape cx={60} cy={60} r={46} stroke="url(#nexus-grad-main)" strokeWidth={2} />

        {/* Inner hexagon - filled */}
        <HexagonShape cx={60} cy={60} r={38} fill="url(#nexus-grad-fill)" stroke="url(#nexus-grad-border)" strokeWidth={1} opacity={0.6} />

        {/* N letter - clean geometric */}
        <g filter="url(#nexus-glow)">
          <path
            d="M40 82V40L72 82V40"
            stroke="url(#nexus-grad-main)"
            strokeWidth={4}
            strokeLinecap="square"
            strokeLinejoin="miter"
            fill="none"
          />
        </g>

        {/* Corner accents */}
        <line x1="8" y1="8" x2="20" y2="8" stroke="#00ff88" strokeWidth={1} opacity={0.3} />
        <line x1="8" y1="8" x2="8" y2="20" stroke="#00ff88" strokeWidth={1} opacity={0.3} />
        <line x1="112" y1="8" x2="100" y2="8" stroke="#00d4ff" strokeWidth={1} opacity={0.3} />
        <line x1="112" y1="8" x2="112" y2="20" stroke="#00d4ff" strokeWidth={1} opacity={0.3} />
        <line x1="8" y1="112" x2="20" y2="112" stroke="#00d4ff" strokeWidth={1} opacity={0.3} />
        <line x1="8" y1="112" x2="8" y2="100" stroke="#00d4ff" strokeWidth={1} opacity={0.3} />
        <line x1="112" y1="112" x2="100" y2="112" stroke="#00ff88" strokeWidth={1} opacity={0.3} />
        <line x1="112" y1="112" x2="112" y2="100" stroke="#00ff88" strokeWidth={1} opacity={0.3} />

        {/* Small dots at hexagon vertices */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const x = 60 + 46 * Math.cos(angle);
          const y = 60 + 46 * Math.sin(angle);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2}
              fill="#00ff88"
              opacity={0.8}
            />
          );
        })}
      </svg>

      {showText && (
        <div className="flex flex-col select-none">
          <span
            className="font-mono font-bold tracking-[0.2em] leading-none"
            style={{
              fontSize: size * 0.4,
              background: 'linear-gradient(135deg, #00ff88 0%, #00d4ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            NEXUS
          </span>
          <span
            className="font-mono tracking-[0.5em] leading-none mt-0.5"
            style={{
              fontSize: size * 0.18,
              color: '#4a4a60',
            }}
          >
            CRM
          </span>
        </div>
      )}
    </div>
  );
}

export function NexusIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {LOGO_DEFS}

      <circle cx="60" cy="60" r="56" fill="#0a0a0f" />
      <HexagonShape cx={60} cy={60} r={48} stroke="url(#nexus-grad-main)" strokeWidth={2.5} />
      <HexagonShape cx={60} cy={60} r={40} fill="url(#nexus-grad-fill)" stroke="url(#nexus-grad-border)" strokeWidth={1} opacity={0.5} />

      <g filter="url(#nexus-glow)">
        <path d="M40 82V40L72 82V40" stroke="url(#nexus-grad-main)" strokeWidth={4} strokeLinecap="square" strokeLinejoin="miter" fill="none" />
      </g>
    </svg>
  );
}

export function NexusFavicon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="fav-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00ff88" />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
        <linearGradient id="fav-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0d0d15" />
          <stop offset="100%" stopColor="#0a0a0f" />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect width="48" height="48" rx="10" fill="url(#fav-bg)" />
      <rect x="1" y="1" width="46" height="46" rx="9" stroke="url(#fav-grad)" strokeWidth="0.5" fill="none" opacity="0.3" />

      {/* Hexagon */}
      <polygon
        points="24,6 40,15 40,33 24,42 8,33 8,15"
        stroke="url(#fav-grad)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* N letter - clean geometric */}
      <path
        d="M16 34V14L32 34V14"
        stroke="url(#fav-grad)"
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
}
