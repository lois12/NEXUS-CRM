import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface NexusFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSave?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  maxWidth?: string;
}

export default function NexusFormModal({
  isOpen, onClose, title, children, onSave,
  saveLabel = 'СОХРАНИТЬ', cancelLabel = 'ОТМЕНА',
  saveDisabled = false, maxWidth = 'max-w-lg'
}: NexusFormModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-[100] p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`glass-frost rounded-2xl p-6 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
            style={{ border: '1px solid var(--color-border)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>{title}</h2>
              <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {children}
            {onSave && (
              <div className="flex gap-3 mt-5">
                <button onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl glass font-mono text-sm text-gray-400">
                  {cancelLabel}
                </button>
                <button onClick={onSave} disabled={saveDisabled}
                  className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold disabled:opacity-50 transition-all"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                  {saveLabel}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
