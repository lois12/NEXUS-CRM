import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface GlitchTransitionProps {
  active: boolean;
  onComplete: () => void;
  duration?: number;
}

const glitchLines = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  y: i * 5,
  delay: Math.random() * 0.3,
  offset: (Math.random() - 0.5) * 40,
  height: 3 + Math.random() * 7,
}));

export function GlitchTransition({ active, onComplete, duration = 800 }: GlitchTransitionProps) {
  const [phase, setPhase] = useState<'idle' | 'glitch' | 'fade'>('idle');

  useEffect(() => {
    if (!active) {
      setPhase('idle');
      return;
    }

    setPhase('glitch');

    const glitchTimer = setTimeout(() => {
      setPhase('fade');
    }, duration * 0.6);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      clearTimeout(glitchTimer);
      clearTimeout(completeTimer);
    };
  }, [active, duration, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 z-[9999] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {/* Base dark overlay */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: '#0a0a0f' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'glitch' ? 0.85 : 1 }}
            transition={{ duration: 0.15 }}
          />

          {/* Glitch scanlines */}
          {phase === 'glitch' && (
            <>
              {glitchLines.map((line) => (
                <motion.div
                  key={line.id}
                  className="absolute left-0 right-0"
                  style={{
                    top: `${line.y}%`,
                    height: `${line.height}px`,
                    background: `linear-gradient(90deg, 
                      transparent ${(50 + line.offset) * 0.5}%, 
                      rgba(0,255,136,0.3) ${50 + line.offset * 0.3}%, 
                      rgba(0,212,255,0.2) ${50 + line.offset * 0.5}%, 
                      transparent ${(50 + line.offset) * 1.2}%)`,
                    mixBlendMode: 'screen',
                  }}
                  initial={{ x: 0, opacity: 0, scaleX: 0 }}
                  animate={{
                    x: [0, line.offset * 2, -line.offset, line.offset * 0.5, 0],
                    opacity: [0, 1, 0.7, 1, 0],
                    scaleX: [0, 1.2, 0.8, 1, 0],
                  }}
                  transition={{
                    duration: 0.5,
                    delay: line.delay,
                    ease: 'easeInOut',
                  }}
                />
              ))}

              {/* RGB shift blocks */}
              <motion.div
                className="absolute"
                style={{
                  top: '20%', left: '10%', right: '60%', bottom: '60%',
                  background: 'rgba(255,0,0,0.15)',
                  mixBlendMode: 'screen',
                  filter: 'blur(2px)',
                }}
                animate={{
                  x: [0, 15, -10, 5, 0],
                  opacity: [0, 0.8, 0.4, 0.6, 0],
                }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute"
                style={{
                  top: '50%', left: '40%', right: '10%', bottom: '20%',
                  background: 'rgba(0,255,136,0.1)',
                  mixBlendMode: 'screen',
                  filter: 'blur(2px)',
                }}
                animate={{
                  x: [0, -12, 8, -3, 0],
                  opacity: [0, 0.6, 0.9, 0.3, 0],
                }}
                transition={{ duration: 0.45, delay: 0.1, ease: 'easeInOut' }}
              />

              {/* Horizontal distortion bars */}
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={`bar-${i}`}
                  className="absolute left-0 right-0"
                  style={{
                    top: `${20 + i * 15}%`,
                    height: '2px',
                    background: 'rgba(0,255,136,0.6)',
                    boxShadow: '0 0 10px rgba(0,255,136,0.4)',
                  }}
                  animate={{
                    x: [0, 200, -150, 80, 0],
                    opacity: [0, 1, 0.5, 1, 0],
                    scaleX: [0.5, 1.5, 0.8, 1.2, 0],
                  }}
                  transition={{
                    duration: 0.35,
                    delay: 0.05 * i,
                    ease: 'easeOut',
                  }}
                />
              ))}

              {/* Center glow pulse */}
              <motion.div
                className="absolute"
                style={{
                  top: '40%', left: '40%', right: '40%', bottom: '40%',
                  background: 'radial-gradient(circle, rgba(0,255,136,0.4) 0%, transparent 70%)',
                  filter: 'blur(30px)',
                }}
                animate={{
                  scale: [0, 2, 1.5, 3],
                  opacity: [0, 0.8, 0.4, 0],
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </>
          )}

          {/* Fade phase - solid overlay with NEXUS text */}
          {phase === 'fade' && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backgroundColor: '#0a0a0f' }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeIn' }}
            >
              <motion.span
                className="font-mono text-2xl font-bold tracking-[0.3em]"
                style={{ color: '#00ff88' }}
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.25 }}
              >
                NEXUS
              </motion.span>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
