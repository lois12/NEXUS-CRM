import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/** NEXUS-style prompt dialog (replaces window.prompt) */
export default function NexusPrompt({
  open,
  title,
  placeholder,
  defaultValue = '',
  confirmLabel = 'СОЗДАТЬ',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => ref.current?.focus(), 60);
    }
  }, [open, defaultValue]);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onConfirm(v);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="glass-frost rounded-2xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-sm font-bold tracking-wider" style={{ color: 'var(--color-primary)' }}>
                {title}
              </h3>
              <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={ref}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') onClose();
              }}
              placeholder={placeholder}
              className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none"
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e0e0e0',
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="btn-ghost">ОТМЕНА</button>
              <button onClick={submit} disabled={!value.trim()} className="btn-primary">
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
