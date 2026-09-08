import { useMemo } from 'react';
import { motion } from 'framer-motion';

// ─── Floating hexagon ──────────────────────────────────────────
function FloatingHex({ x, y, size, speed, color }: {
  x: number; y: number; size: number; speed: number; color: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <polygon
        points="50,2 93,25 93,75 50,98 7,75 7,25"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to={`${speed > 0 ? 360 : -360} 50 50`}
          dur={`${25 + Math.random() * 15}s`}
          repeatCount="indefinite"
        />
      </polygon>
    </svg>
  );
}

// ─── Gradient orb ──────────────────────────────────────────────
function GradientOrb({ x, y, size, color, delay }: {
  x: number; y: number; size: number; color: string; delay: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: 'blur(40px)',
        transform: 'translate(-50%, -50%)',
      }}
      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 8, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// ─── Glitch scanline ───────────────────────────────────────────
function GlitchScanline() {
  return (
    <motion.div
      className="absolute left-0 right-0 pointer-events-none"
      style={{
        height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.4), rgba(0,212,255,0.4), transparent)',
        boxShadow: '0 0 10px rgba(0,255,136,0.3)',
      }}
      animate={{ top: ['-1%', '100%'], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'linear', times: [0, 0.1, 0.9, 1] }}
    />
  );
}

// ─── Data streams ──────────────────────────────────────────────
function DataStreams() {
  const streams = useMemo(() =>
    Array.from({ length: 4 }, (_, i) => ({
      id: i,
      x: 15 + i * 22,
      delay: i * 1.8,
      duration: 3.5 + i * 0.5,
    })), []);

  return (
    <>
      {streams.map(s => (
        <motion.div
          key={s.id}
          className="absolute pointer-events-none"
          style={{
            left: `${s.x}%`,
            width: 1,
            background: 'linear-gradient(180deg, transparent, rgba(0,255,136,0.12), transparent)',
          }}
          animate={{ height: ['0%', '25%', '0%'], top: ['0%', '75%', '100%'], opacity: [0, 0.4, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </>
  );
}

// ─── Static particles (no animation loop) ──────────────────────
function StaticParticles() {
  const dots = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.4 + 0.1,
      color: Math.random() > 0.7 ? '#00d4ff' : '#00ff88',
      animDur: 3 + Math.random() * 4,
      animDelay: Math.random() * 3,
    })), []);

  return (
    <>
      {dots.map(d => (
        <motion.div
          key={d.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            backgroundColor: d.color,
            boxShadow: `0 0 ${d.size * 3}px ${d.color}80`,
          }}
          animate={{ opacity: [d.opacity * 0.3, d.opacity, d.opacity * 0.3] }}
          transition={{ duration: d.animDur, delay: d.animDelay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
}

// ─── Main component ────────────────────────────────────────────
export function CyberBackground() {
  const hexagons = useMemo(() => [
    { x: 15, y: 20, size: 100, speed: 1, color: '#00ff88' },
    { x: 82, y: 15, size: 60, speed: -1, color: '#00d4ff' },
    { x: 72, y: 70, size: 80, speed: 1, color: '#00ff88' },
    { x: 25, y: 78, size: 50, speed: -1, color: '#00d4ff' },
    { x: 50, y: 8, size: 40, speed: 1, color: 'rgba(255,0,255,0.35)' },
    { x: 88, y: 45, size: 70, speed: -1, color: '#00ff88' },
  ], []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Deep background */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(0,255,136,0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.03) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(255,0,255,0.02) 0%, transparent 50%)
        `,
      }} />

      {/* Gradient orbs */}
      <GradientOrb x={20} y={30} size={400} color="rgba(0,255,136,0.08)" delay={0} />
      <GradientOrb x={75} y={20} size={350} color="rgba(0,212,255,0.06)" delay={2} />
      <GradientOrb x={60} y={70} size={300} color="rgba(255,0,255,0.04)" delay={4} />

      {/* Grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(0, 255, 136, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 136, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      {/* Perspective floor */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: '30%',
        background: `
          linear-gradient(180deg, transparent 0%, rgba(0,255,136,0.02) 100%),
          repeating-linear-gradient(90deg, rgba(0,255,136,0.03) 0px, transparent 1px, transparent 60px),
          repeating-linear-gradient(0deg, rgba(0,255,136,0.03) 0px, transparent 1px, transparent 60px)
        `,
        transform: 'perspective(500px) rotateX(45deg)',
        transformOrigin: 'bottom center',
        maskImage: 'linear-gradient(180deg, transparent 0%, black 30%)',
        WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 30%)',
      }} />

      {/* Static particles */}
      <StaticParticles />

      {/* Floating hexagons */}
      {hexagons.map((h, i) => <FloatingHex key={i} {...h} />)}

      {/* Data streams */}
      <DataStreams />

      {/* Scanline */}
      <GlitchScanline />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
      }} />

      {/* Edge glows */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.3), rgba(0,212,255,0.3), transparent)',
        boxShadow: '0 0 30px rgba(0,255,136,0.1)',
      }} />
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.2), rgba(0,255,136,0.2), transparent)',
      }} />
    </div>
  );
}
