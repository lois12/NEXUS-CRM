import { motion } from 'framer-motion';
import { Plus, Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/** Empty list placeholder with optional create CTA */
export default function EmptyState({
  title = 'Пока пусто',
  description = 'Здесь появятся записи, когда вы их создадите.',
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center text-center py-12 px-6"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'rgba(0,255,136,0.06)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 0 24px var(--color-glow)',
        }}
      >
        {icon || <Inbox className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />}
      </div>
      <h3 className="text-base font-bold font-mono text-gray-200 mb-1">{title}</h3>
      <p className="text-xs font-mono text-gray-500 max-w-xs mb-5">{description}</p>
      {actionLabel && onAction && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onAction}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all"
          style={{
            background: 'var(--color-primary)',
            color: '#000',
            boxShadow: '0 0 20px var(--color-glow)',
          }}
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
