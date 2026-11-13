import { motion } from 'framer-motion';

/**
 * Единый спиннер загрузки.
 * В обычном режиме — двойное кольцо на framer (как было).
 * В low-fx (слабые устройства) — лёгкий CSS-вариант, чтобы сам спиннер не ел фреймы.
 */
export default function Loader({ size = 40, label }: { size?: number; label?: string }) {
  const lowFx = typeof document !== 'undefined' && document.documentElement.classList.contains('low-fx');

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {lowFx ? (
        <span className="smart-image-spinner" style={{ width: size, height: size }} />
      ) : (
        <div className="relative" style={{ width: size, height: size }}>
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: '2px solid transparent', borderTopColor: 'var(--color-primary)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-1.5 rounded-full"
            style={{ border: '2px solid transparent', borderBottomColor: 'var(--color-accent)' }}
            animate={{ rotate: -360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}
      {label && (
        <span className="font-mono text-xs" style={{ color: 'var(--color-primary)' }}>{label}</span>
      )}
    </div>
  );
}
