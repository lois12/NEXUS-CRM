import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Edit, Calendar, Globe } from 'lucide-react';

interface PostPreviewProps {
  title: string;
  content: string;
  platform: string;
  imageUrl?: string;
  scheduledDate?: string;
  onSend: () => void;
  onEdit: () => void;
  onClose: () => void;
}

const platformLabels: Record<string, string> = {
  telegram: 'Telegram',
  vk: 'ВКонтакте',
  max: 'MAX',
  dzen: 'Дзен',
};

const platformColors: Record<string, string> = {
  telegram: '#0088cc',
  vk: '#4a76a8',
  max: '#ff6600',
  dzen: '#fc3f1d',
};

export default function PostPreview({ title, content, platform, imageUrl, scheduledDate, onSend, onEdit, onClose }: PostPreviewProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-lg rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>ПРЕДПРОСМОТР</span>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5"><X className="w-4 h-4 text-gray-400" /></button>
          </div>

          {/* Preview card — mimics social media post */}
          <div className="p-5">
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Platform badge */}
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: platformColors[platform] || '#666' }}>
                  <Globe className="w-3 h-3 text-white" />
                </div>
                <span className="text-[10px] font-mono" style={{ color: platformColors[platform] || '#888' }}>
                  {platformLabels[platform] || platform}
                </span>
                {scheduledDate && (
                  <div className="flex items-center gap-1 ml-auto">
                    <Calendar className="w-3 h-3" style={{ color: '#5a5a70' }} />
                    <span className="text-[10px] font-mono" style={{ color: '#5a5a70' }}>{scheduledDate}</span>
                  </div>
                )}
              </div>

              {/* Image */}
              {imageUrl && (
                <div className="aspect-video relative overflow-hidden">
                  <img loading="lazy" decoding="async" src={imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                {title && (
                  <h3 className="text-base font-semibold mb-2" style={{ color: '#e0e0e0' }}>{title}</h3>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#a0a0b0' }}>
                  {content || <span className="italic" style={{ color: '#4a4a60' }}>Нет текста</span>}
                </div>
              </div>
            </div>

            {/* Character count */}
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-[10px] font-mono" style={{ color: '#5a5a70' }}>
                {content.length} символов
              </span>
              {content.length > 2000 && (
                <span className="text-[10px] font-mono" style={{ color: '#ff6b6b' }}>
                  ⚠ Слишком длинный для некоторых платформ
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 px-5 pb-5">
            <button onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm transition-all hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#8a8aa0' }}>
              <Edit className="w-4 h-4" /> РЕДАКТИРОВАТЬ
            </button>
            <button onClick={onSend}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm font-bold transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#000' }}>
              <Send className="w-4 h-4" /> ОТПРАВИТЬ
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
