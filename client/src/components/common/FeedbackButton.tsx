import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send } from 'lucide-react';
import { showToast } from '../ui/NexusModal';

/** Header button → modal → POST /api/feedback → admin inbox */
export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!message.trim()) {
      showToast('Напишите сообщение', 'error');
      return;
    }
    setSending(true);
    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          page: window.location.pathname,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast('Отправлено админам', 'success');
        setMessage('');
        setOpen(false);
      } else {
        showToast(data?.error || 'Не удалось отправить', 'error');
      }
    } catch {
      showToast('Ошибка сети', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Сообщить админу"
        className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-frost rounded-2xl p-5 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                  <MessageSquare className="w-4 h-4" />
                  СООБЩИТЬ АДМИНУ
                </h3>
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs font-mono text-gray-500 mb-3">
                // что бесит / баг / идея — придёт во вкладку админа
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                autoFocus
                placeholder="Опишите проблему или пожелание…"
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none resize-none"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e0e0e0',
                }}
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-mono text-gray-400 hover:bg-white/5"
                >
                  ОТМЕНА
                </button>
                <button
                  onClick={submit}
                  disabled={sending || !message.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold disabled:opacity-40"
                  style={{ background: 'var(--color-primary)', color: '#000' }}
                >
                  <Send className="w-3.5 h-3.5" />
                  {sending ? 'ОТПРАВКА…' : 'ОТПРАВИТЬ'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
