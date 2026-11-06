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
      className="nx-tile flex flex-col items-center justify-center text-center py-12 px-6"
      style={{ boxShadow: 'var(--depth-float), var(--depth-rim-top), var(--depth-rim-bottom)' }}
    >
      <div className="nx-bezel mb-4">
        <div
          className="nx-core w-16 h-16 flex items-center justify-center"
          style={{
            boxShadow:
              '0 0 0 1px color-mix(in srgb, var(--color-primary) 30%, transparent), 0 0 28px var(--color-glow), inset 0 0 16px color-mix(in srgb, var(--color-primary) 12%, transparent), var(--depth-rim-top)',
          }}
        >
          {icon || <Inbox className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />}
        </div>
      </div>
      <h3 className="text-base font-bold font-mono text-gray-200 mb-1">{title}</h3>
      <p className="text-xs font-mono text-gray-500 max-w-xs mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="nx-press flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold"
          style={{
            background: 'var(--color-primary)',
            color: '#000',
            boxShadow: '0 0 20px var(--color-glow), var(--depth-contact), var(--depth-rim-top)',
          }}
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
