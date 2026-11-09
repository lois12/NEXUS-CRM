import { useRef, useEffect, useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Calendar, QrCode, Wifi, CalendarClock, Sparkles, Shuffle,
  BookOpen, CheckSquare, Users, CloudSun, Package, PartyPopper,
  Rocket, FolderOpen, BarChart3, Cpu, Gauge, Monitor, LucideIcon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import MyDay from '../components/dashboard/MyDay';

// three.js lives in its own chunk and is only fetched once TitanScene mounts.
const TitanScene = lazy(() => import('../components/dashboard/TitanScene'));

// Inject glitch / badge CSS once
const glitchCSS = `
@keyframes glitch-in {
  0% {
    opacity: 0;
    transform: skewX(-8deg) translateX(-10px);
    clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
    filter: brightness(3) saturate(0);
  }
  15% {
    opacity: 1;
    clip-path: polygon(0 0, 40% 0, 35% 100%, 0 100%);
    filter: brightness(2) saturate(0.5);
  }
  30% {
    transform: skewX(3deg) translateX(4px);
    clip-path: polygon(0 0, 65% 0, 70% 100%, 0 100%);
    filter: brightness(1.5) saturate(0.8);
  }
  50% {
    transform: skewX(-1deg) translateX(-2px);
    clip-path: polygon(0 0, 85% 0, 80% 100%, 0 100%);
    filter: brightness(1.2) saturate(1);
  }
  70% {
    transform: skewX(0.5deg) translateX(1px);
    clip-path: polygon(0 0, 95% 0, 98% 100%, 0 100%);
    filter: brightness(1.1);
  }
  100% {
    opacity: 1;
    transform: skewX(0) translateX(0);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 100% 100%);
    filter: brightness(1);
  }
}
@keyframes glitch-out {
  0% {
    opacity: 1;
    transform: skewX(0) translateX(0);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 100% 100%);
    filter: brightness(1);
  }
  25% {
    transform: skewX(4deg) translateX(6px);
    clip-path: polygon(10% 0, 100% 0, 100% 100%, 15% 100%);
    filter: brightness(1.8) saturate(0.6);
  }
  50% {
    transform: skewX(-6deg) translateX(-8px);
    clip-path: polygon(30% 0, 100% 0, 100% 100%, 25% 100%);
    filter: brightness(2.5) saturate(0.3);
  }
  75% {
    opacity: 0.6;
    clip-path: polygon(60% 0, 100% 0, 100% 100%, 55% 100%);
    filter: brightness(3) saturate(0);
  }
  100% {
    opacity: 0;
    clip-path: polygon(100% 0, 100% 0, 100% 100%, 100% 100%);
    filter: brightness(4) saturate(0);
  }
}
.badge-enter { animation: glitch-in 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
.badge-exit { animation: glitch-out 0.4s cubic-bezier(0.55, 0, 1, 0.45) forwards; }
@keyframes badge-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.badge-float { animation: badge-float 5s ease-in-out infinite; }
`;
if (typeof document !== 'undefined' && !document.getElementById('glitch-styles')) {
  const style = document.createElement('style');
  style.id = 'glitch-styles';
  style.textContent = glitchCSS;
  document.head.appendChild(style);
}

/** Weak / small / motion-sensitive devices get the static poster instead of WebGL. */
function isWeakDevice() {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 8 : 8;
  return cores <= 4 || window.innerWidth < 768;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const ALL_BADGES: { label: string; icon: LucideIcon }[] = [
  { label: 'Контент-план', icon: Calendar },
  { label: 'QR генератор', icon: QrCode },
  { label: 'IP Ping', icon: Wifi },
  { label: 'Планирование', icon: CalendarClock },
  { label: 'ИИ генерация', icon: Sparkles },
  { label: 'Рандомайзер', icon: Shuffle },
  { label: 'База знаний', icon: BookOpen },
  { label: 'Задачи', icon: CheckSquare },
  { label: 'Партнёры', icon: Users },
  { label: 'Погода', icon: CloudSun },
  { label: 'Оборудование', icon: Package },
  { label: 'Мероприятия', icon: PartyPopper },
  { label: 'Проекты', icon: Rocket },
  { label: 'Материалы', icon: FolderOpen },
  { label: 'Аналитика', icon: BarChart3 },
];

const POSITIONS = [
  { x: '5%', y: '22%' }, { x: '70%', y: '14%' }, { x: '78%', y: '50%' },
  { x: '3%', y: '55%' }, { x: '65%', y: '72%' }, { x: '10%', y: '38%' },
  { x: '75%', y: '32%' }, { x: '8%', y: '75%' }, { x: '60%', y: '85%' },
  { x: '85%', y: '65%' }, { x: '12%', y: '15%' }, { x: '52%', y: '8%' },
];

function randomFrom(arr: typeof ALL_BADGES, exclude: string): typeof ALL_BADGES[0] {
  const filtered = arr.filter(a => a.label !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function FloatingBadges() {
  const [visible, setVisible] = useState<{ id: number; label: string; icon: LucideIcon; pos: typeof POSITIONS[0] }[]>([]);
  const nextId = useRef(0);

  const addBadge = useCallback(() => {
    const id = nextId.current++;
    const currentLabels = visible.map(v => v.label);
    const badge = randomFrom(ALL_BADGES, currentLabels[currentLabels.length - 1] || '');
    const pos = POSITIONS[id % POSITIONS.length];
    setVisible(prev => [...prev.slice(-4), { id, label: badge.label, icon: badge.icon, pos }]);
  }, [visible]);

  useEffect(() => {
    const init = setTimeout(() => {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => addBadge(), i * 400);
      }
    }, 2000);

    const interval = setInterval(() => {
      if (Math.random() > 0.4) addBadge();
      if (visible.length > 3) setVisible(prev => prev.slice(1));
    }, 3500);

    return () => { clearTimeout(init); clearInterval(interval); };
  }, [addBadge, visible.length]);

  return (
    <AnimatePresence>
      {visible.map((badge) => (
        <motion.div
          key={badge.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute z-10 pointer-events-none"
          style={{ left: badge.pos.x, top: badge.pos.y }}
        >
          <div className="badge-float">
            <div className="badge-enter">
              <div
                className="flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 rounded whitespace-nowrap"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
                  color: 'var(--color-primary)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)',
                  borderBottom: '2px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
                  boxShadow: '0 0 12px var(--color-glow)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textShadow: '0 0 6px var(--color-glow)',
                }}
              >
                <badge.icon className="w-3 h-3" />
                {badge.label}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

const CONSOLE_LINES = [
  '> initializing neural link... done',
  '> connecting to nexus core... ok',
  '> loading modules [22/22] ████████ 100%',
  '> system status: OPERATIONAL',
  '> root@nexus:~$ _',
];

function TypingLine() {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const line = CONSOLE_LINES[lineIdx];
    if (charIdx < line.length) {
      const timer = setTimeout(() => setCharIdx(c => c + 1), 30 + Math.random() * 40);
      return () => clearTimeout(timer);
    }

    // Line complete — pause then next or fade out
    const pause = setTimeout(() => {
      if (lineIdx < CONSOLE_LINES.length - 1) {
        setLineIdx(i => i + 1);
        setCharIdx(0);
      } else {
        // Last line — blink cursor a few times then fade
        setTimeout(() => setShow(false), 2000);
      }
    }, lineIdx === CONSOLE_LINES.length - 1 ? 0 : 600);

    return () => clearTimeout(pause);
  }, [charIdx, lineIdx]);

  if (!show) return null;

  const line = CONSOLE_LINES[lineIdx];
  const isLastLine = lineIdx === CONSOLE_LINES.length - 1;
  const cursorVisible = charIdx >= line.length && isLastLine;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      className="font-mono text-[10px] sm:text-xs h-4"
      style={{ color: 'color-mix(in srgb, var(--color-primary) 50%, transparent)' }}
    >
      {line.substring(0, charIdx)}
      {cursorVisible && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{ color: 'var(--color-primary)' }}
        >
          _
        </motion.span>
      )}
    </motion.div>
  );
}

/** Light-theme hero: soft gradient + floating glass shapes (no dark 3D) */
function LightHeroScene() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--color-primary) 12%, transparent) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, transparent 45%), linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 94%, var(--color-primary)) 0%, var(--color-bg) 100%)',
      }}
    >
      {/* soft grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(color-mix(in srgb, var(--color-primary) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 6%, transparent) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)',
        }}
      />
      {/* floating orbs */}
      {[
        { s: 220, x: '12%', y: '18%', c: 'var(--color-primary)', a: 0.14, d: 0 },
        { s: 160, x: '72%', y: '22%', c: 'var(--color-accent)', a: 0.12, d: 1.2 },
        { s: 280, x: '58%', y: '58%', c: 'var(--color-primary)', a: 0.1, d: 0.6 },
        { s: 120, x: '28%', y: '68%', c: 'var(--color-accent)', a: 0.12, d: 1.8 },
      ].map((o, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: o.s,
            height: o.s,
            left: o.x,
            top: o.y,
            background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--color-card) 75%, transparent), color-mix(in srgb, ${o.c} ${Math.round(o.a * 100)}%, transparent))`,
            border: '1px solid color-mix(in srgb, var(--color-primary) 12%, transparent)',
            filter: 'blur(0.5px)',
          }}
          animate={{ y: [0, -18, 0], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 8 + o.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/** Zero-GPU fallback: CSS starfield + gradient orb. Also the live scene's poster mode. */
function StaticPoster() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* tiled star layers */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(0.8px 0.8px at 24px 18px, color-mix(in srgb, var(--color-text-primary) 70%, transparent), transparent 100%)',
          backgroundSize: '56px 48px',
        }}
      />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 30px 24px, color-mix(in srgb, var(--color-primary) 65%, transparent), transparent 100%)',
          backgroundSize: '96px 82px',
        }}
      />
      {/* gradient orb */}
      <div
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 'min(46vw, 380px)',
          height: 'min(46vw, 380px)',
          background:
            'radial-gradient(circle at 38% 32%, color-mix(in srgb, var(--color-primary) 28%, transparent), color-mix(in srgb, var(--color-primary) 8%, transparent) 55%, transparent 72%)',
          boxShadow: '0 0 100px color-mix(in srgb, var(--color-primary) 22%, transparent)',
        }}
      />
      {/* horizon glow */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background: 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-primary) 7%, transparent))',
        }}
      />
    </div>
  );
}

/** Quick-launch routes — same paths as Sidebar. */
const LAUNCH: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Контент-план', to: '/content', icon: Calendar },
  { label: 'Задачи', to: '/kanban', icon: CheckSquare },
  { label: 'QR генератор', to: '/qr', icon: QrCode },
  { label: 'Мероприятия', to: '/events', icon: PartyPopper },
  { label: 'Проекты', to: '/projects', icon: Rocket },
  { label: 'Погода', to: '/weather', icon: CloudSun },
  { label: 'Аналитика', to: '/analytics', icon: BarChart3 },
  { label: 'База знаний', to: '/knowledge', icon: BookOpen },
  { label: 'Материалы', to: '/materials', icon: FolderOpen },
  { label: 'Оборудование', to: '/inventory', icon: Package },
  { label: 'IP Ping', to: '/ping', icon: Wifi },
  { label: 'Рандомайзер', to: '/random', icon: Shuffle },
];

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="nx-eyebrow">{title}</h2>
        {hint && (
          <span
            className="font-mono text-[9px] tracking-[0.18em] uppercase"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {hint}
          </span>
        )}
      </div>
      <div className="nx-divider mt-2" />
    </div>
  );
}

function ModeChip({
  active, disabled, onClick, children, title,
}: {
  active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`nx-press font-mono text-[9px] font-bold tracking-[0.16em] uppercase px-2.5 py-1.5 rounded-lg transition-colors${active ? ' [box-shadow:0_0_14px_var(--color-glow)]' : ''}`}
      style={{
        color: active ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
        background: active
          ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
          : 'color-mix(in srgb, var(--color-text-primary) 6%, transparent)',
        border: `1px solid ${active
          ? 'color-mix(in srgb, var(--color-primary) 38%, transparent)'
          : 'color-mix(in srgb, var(--color-text-primary) 10%, transparent)'}`,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

function VitalTile({
  icon: Icon, label, value, sub, rise,
}: {
  icon: LucideIcon; label: string; value: string; sub: string; rise: string;
}) {
  return (
    <div className={`hud-panel nx-tile nx-rise ${rise} p-4 md:p-5 flex items-center gap-4`}>
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)',
        }}
      >
        <Icon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
      </div>
      <div className="min-w-0">
        <p
          className="font-mono text-[9px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {label}
        </p>
        <p
          className="font-mono text-xl md:text-2xl font-bold leading-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {value}
        </p>
        <p className="font-mono text-[10px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

type RenderMode = 'live' | 'static';

export default function Dashboard() {
  const { themeName } = useTheme();
  const isLight = themeName === 'office-light';
  const reducedMotion = usePrefersReducedMotion();
  const [renderPref, setRenderPref] = useState<RenderMode>(() => {
    try {
      const saved = localStorage.getItem('nexus-dash-render');
      if (saved === 'live' || saved === 'static') return saved;
    } catch { /* storage blocked */ }
    return isWeakDevice() ? 'static' : 'live';
  });

  useEffect(() => {
    try { localStorage.setItem('nexus-dash-render', renderPref); } catch { /* storage blocked */ }
  }, [renderPref]);

  const mode: RenderMode = reducedMotion ? 'static' : renderPref;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 0 : 0;
  const [sessionTime] = useState(() => new Date());

  const bootLog = useMemo(() => {
    const t = sessionTime.toLocaleTimeString('ru-RU', { hour12: false });
    return [
      `[${t}] ядро — инициализация завершена`,
      `[${t}] графика — ${mode === 'live' ? '3d-сцена активна' : 'статичный постер'}`,
      `[${t}] потоков — ${cores || 'н/д'} · быстрый доступ — ${LAUNCH.length}`,
      `[${t}] статус — OPERATIONAL`,
    ];
  }, [mode, cores, sessionTime]);

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-10">
      {/* ============ HERO BAND ============ */}
      <section className="nx-bezel h-[calc(100vh-11rem)] md:h-[calc(100vh-12rem)] min-h-[360px]">
        <div
          className="nx-core relative w-full h-full overflow-hidden"
          style={isLight ? { background: 'var(--color-bg)' } : undefined}
        >
          {/* 3D scene / poster / light hero */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            {isLight ? (
              <LightHeroScene />
            ) : mode === 'live' ? (
              <Suspense fallback={<StaticPoster />}>
                <TitanScene />
              </Suspense>
            ) : (
              <StaticPoster />
            )}
          </motion.div>

          {/* scan line */}
          <motion.div
            initial={{ top: '-2px' }}
            animate={{ top: '100%' }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="absolute left-0 right-0 h-[2px] z-10"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
              boxShadow: '0 0 20px var(--color-primary), 0 0 40px var(--color-glow)',
            }}
          />

          {/* title overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-start pt-4 md:pt-6 z-20 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <div className="nx-eyebrow nx-rise mb-3">SYSTEM · ONLINE</div>
              <div className="relative">
                <motion.h1
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0, 1, 0, 1] }}
                  transition={{ duration: 0.8, delay: 0.5, times: [0, 0.1, 0.15, 0.2, 0.25, 1] }}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold font-mono tracking-[0.2em] md:tracking-[0.3em] relative"
                  style={{
                    color: 'var(--color-primary)',
                    textShadow: '0 0 30px var(--color-glow), 0 0 60px var(--color-glow), 0 0 100px var(--color-glow)',
                  }}
                >
                  NEXUS CRM
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.7, 0] }}
                    transition={{ duration: 0.3, delay: 0.6 }}
                    className="absolute inset-0"
                    style={{ color: 'var(--color-danger)', clipPath: 'inset(20% 0 60% 0)', transform: 'translate(-3px, 0)' }}
                  >
                    NEXUS CRM
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.7, 0] }}
                    transition={{ duration: 0.3, delay: 0.65 }}
                    className="absolute inset-0"
                    style={{ color: 'var(--color-info)', clipPath: 'inset(50% 0 20% 0)', transform: 'translate(3px, 0)' }}
                  >
                    NEXUS CRM
                  </motion.span>
                </motion.h1>
              </div>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }}
                className="nx-divider mx-auto mt-2 mb-3 md:mt-3 md:mb-4"
                style={{ maxWidth: '300px' }}
              />
              <TypingLine />
            </motion.div>
          </div>

          {/* render-mode switch (active chip = the only glowing one) */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
            <ModeChip
              active={mode === 'live'}
              disabled={reducedMotion}
              onClick={() => setRenderPref('live')}
              title={reducedMotion ? 'prefers-reduced-motion: 3D отключён' : 'живая 3D-сцена'}
            >
              3D
            </ModeChip>
            <ModeChip
              active={mode === 'static'}
              onClick={() => setRenderPref('static')}
              title="статичный постер"
            >
              ПОСТЕР
            </ModeChip>
          </div>

          {!reducedMotion && <FloatingBadges />}
        </div>
      </section>

      <div className="nx-divider my-6" />

      {/* ============ BENTO GRID ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* MyDay HUD — wide block */}
        <div className="lg:col-span-8">
          <MyDay />
        </div>

        {/* vitals — narrow stacked tiles */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <VitalTile
            icon={Cpu}
            label="ПРОЦЕССОР"
            value={cores ? String(cores) : '—'}
            sub="ядер доступно"
            rise="nx-rise-1"
          />
          <VitalTile
            icon={Gauge}
            label="ВИЗУАЛ"
            value={mode === 'live' ? 'LIVE 3D' : 'ПОСТЕР'}
            sub={mode === 'live' ? 'динамическая сцена' : 'статичный рендер'}
            rise="nx-rise-2"
          />
          <VitalTile
            icon={Monitor}
            label="КАДРЫ"
            value={mode === 'static' ? 'СТАТИКА' : isMobile ? '30 FPS' : '60 FPS'}
            sub="лимит кадров"
            rise="nx-rise-3"
          />
        </div>

        {/* quick-launch chips */}
        <section className="lg:col-span-7 nx-rise nx-rise-4">
          <SectionHead title="БЫСТРЫЙ ЗАПУСК" hint="основные модули" />
          <div className="flex flex-wrap gap-2 mt-3">
            {LAUNCH.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="nx-press flex items-center gap-2 rounded-xl px-3.5 py-2.5 [box-shadow:var(--depth-contact),var(--depth-rim-top),var(--depth-rim-bottom)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 16%, transparent)',
                }}
              >
                <item.icon className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                <span
                  className="font-mono text-[11px] font-semibold tracking-wide"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* activity strip */}
        <section className="lg:col-span-5 nx-rise nx-rise-5">
          <SectionHead title="СИСТЕМНАЯ ЛЕНТА" hint="телеметрия" />
          <div className="hud-panel nx-tile p-4 md:p-5 mt-3">
            <div className="flex items-center justify-between gap-2">
              <span
                className="font-mono text-[9px] tracking-[0.18em] uppercase"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                сессия {sessionTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] uppercase">
                <span
                  className="w-1.5 h-1.5 rounded-full [box-shadow:0_0_8px_var(--color-glow)]"
                  style={{ background: 'var(--color-primary)' }}
                />
                <span style={{ color: 'var(--color-primary)' }}>online</span>
              </span>
            </div>
            <div className="nx-divider my-3" />
            <ul className="space-y-1.5">
              {bootLog.map((line) => (
                <li
                  key={line}
                  className="font-mono text-[10px] sm:text-[11px] leading-relaxed truncate"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {line}
                </li>
              ))}
              <li className="font-mono text-[10px] sm:text-[11px]" style={{ color: 'var(--color-primary)' }}>
                &gt; <span className="animate-pulse">_</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
