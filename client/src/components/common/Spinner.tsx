import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface SpinnerProps {
  text?: string;
}

export default function Spinner({ text = 'ЗАГРУЗКА...' }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Zap className="w-12 h-12 mx-auto" style={{ color: 'var(--color-primary)' }} />
        </motion.div>
        <p className="neon-text mt-3 font-mono text-sm" style={{ color: 'var(--color-primary)' }}>{text}</p>
      </div>
    </div>
  );
}
