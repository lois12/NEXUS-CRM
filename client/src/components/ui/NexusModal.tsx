import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger';
}

interface SpinnerProps {
  isVisible: boolean;
  text?: string;
}

const typeConfig = {
  info: { icon: Info, color: '#00d4ff', bg: 'rgba(0, 212, 255, 0.1)', border: 'rgba(0, 212, 255, 0.3)' },
  success: { icon: CheckCircle, color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)', border: 'rgba(0, 255, 136, 0.3)' },
  warning: { icon: AlertTriangle, color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)' },
  error: { icon: AlertTriangle, color: '#ff3b30', bg: 'rgba(255, 59, 48, 0.1)', border: 'rgba(255, 59, 48, 0.3)' },
  danger: { icon: AlertTriangle, color: '#ff3b30', bg: 'rgba(255, 59, 48, 0.1)', border: 'rgba(255, 59, 48, 0.3)' },
};

export function AlertModal({ isOpen, onClose, title, message, type = 'info' }: AlertModalProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-[200] p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-frost rounded-2xl p-6 w-full max-w-sm"
            style={{ border: `1px solid ${config.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}>
                <Icon className="w-6 h-6" style={{ color: config.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold font-mono text-gray-200 mb-1">{title}</h3>
                <p className="text-sm text-gray-400">{message}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
              >
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmModal({ isOpen, onConfirm, onCancel, title, message, confirmText = 'ПОДТВЕРДИТЬ', cancelText = 'ОТМЕНА', type = 'warning' }: ConfirmModalProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-[200] p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-frost rounded-2xl p-6 w-full max-w-sm"
            style={{ border: `1px solid ${config.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}>
                <Icon className="w-6 h-6" style={{ color: config.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold font-mono text-gray-200 mb-1">{title}</h3>
                <p className="text-sm text-gray-400">{message}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl glass font-mono text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className="px-5 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
                style={{ 
                  backgroundColor: type === 'danger' ? '#ff3b30' : 'var(--color-primary)', 
                  color: type === 'danger' ? '#fff' : '#000' 
                }}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NexusSpinner({ isVisible, text = 'ЗАГРУЗКА...' }: SpinnerProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-[200]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            {/* Nexus spinner */}
            <div className="relative w-16 h-16">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '2px solid transparent', borderTopColor: 'var(--color-primary)', borderRightColor: 'var(--color-primary)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-2 rounded-full"
                style={{ border: '2px solid transparent', borderBottomColor: 'var(--color-accent)', borderLeftColor: 'var(--color-accent)' }}
                animate={{ rotate: -360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-4 rounded-full"
                style={{ border: '2px solid transparent', borderTopColor: 'var(--color-secondary)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-glow)' }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>
            </div>
            <motion.p
              className="font-mono text-sm font-bold"
              style={{ color: 'var(--color-primary)', textShadow: '0 0 10px var(--color-glow)' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {text}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for alert
export function useNexusAlert() {
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>({
    isOpen: false, title: '', message: '', type: 'info'
  });

  const showAlert = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setAlertState({ isOpen: true, title, message, type });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return { alertState, showAlert, closeAlert };
}

export function useNexusConfirm() {
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; type: 'warning' | 'danger'; onConfirm: () => void }>({
    isOpen: false, title: '', message: '', type: 'warning', onConfirm: () => {}
  });

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' = 'warning') => {
    setConfirmState({ isOpen: true, title, message, type, onConfirm });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return { confirmState, showConfirm, closeConfirm };
}

// Toast notification — powered by Sonner
export function showToast(message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') {
  switch (type) {
    case 'success': sonnerToast.success(message); break;
    case 'error': sonnerToast.error(message); break;
    case 'warning': sonnerToast.warning(message); break;
    default: sonnerToast(message); break;
  }
}

export function NexusToasts() {
  // Sonner's <Toaster> is rendered in App.tsx — this component is kept for compatibility
  return null;
}
