import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface StickerPickerProps {
  onSelect: (sticker: string) => void;
  onClose: () => void;
}

// Animated sticker categories — large emojis with CSS animations
const STICKER_CATEGORIES = [
  {
    label: 'Реакции',
    stickers: [
      { emoji: '👍', label: 'Лайк' },
      { emoji: '❤️', label: 'Сердце' },
      { emoji: '🔥', label: 'Огонь' },
      { emoji: '😂', label: 'Смех' },
      { emoji: '😮', label: 'Ого' },
      { emoji: '👏', label: 'Аплодисменты' },
      { emoji: '💯', label: '100' },
      { emoji: '🎉', label: 'Ура' },
      { emoji: '💪', label: 'Сила' },
      { emoji: '🤝', label: 'Рукопожатие' },
      { emoji: '✌️', label: 'Победа' },
      { emoji: '🤞', label: 'Удача' },
    ],
  },
  {
    label: 'Эмоции',
    stickers: [
      { emoji: '😀', label: 'Улыбка' },
      { emoji: '😍', label: 'Любовь' },
      { emoji: '🥰', label: 'Нежность' },
      { emoji: '😎', label: 'Крутой' },
      { emoji: '🤩', label: 'Восторг' },
      { emoji: '😤', label: 'Злость' },
      { emoji: '😭', label: 'Плач' },
      { emoji: '😱', label: 'Ужас' },
      { emoji: '🤔', label: 'Думаю' },
      { emoji: '😴', label: 'Сплю' },
      { emoji: '🥳', label: 'Вечеринка' },
      { emoji: '😈', label: 'Чертик' },
    ],
  },
  {
    label: 'Жесты',
    stickers: [
      { emoji: '👋', label: 'Привет' },
      { emoji: '🙏', label: 'Молитва' },
      { emoji: '👀', label: 'Глаза' },
      { emoji: '🫶', label: 'Сердечки' },
      { emoji: '🤘', label: 'Рок' },
      { emoji: '👆', label: 'Вверх' },
      { emoji: '👇', label: 'Вниз' },
      { emoji: '👈', label: 'Влево' },
      { emoji: '👉', label: 'Вправо' },
      { emoji: '✊', label: 'Кулак' },
      { emoji: '👊', label: 'Удар' },
      { emoji: '🫡', label: 'Салют' },
    ],
  },
  {
    label: 'Объекты',
    stickers: [
      { emoji: '🚀', label: 'Ракета' },
      { emoji: '⚡', label: 'Молния' },
      { emoji: '🌟', label: 'Звезда' },
      { emoji: '💎', label: 'Бриллиант' },
      { emoji: '🏆', label: 'Кубок' },
      { emoji: '🎯', label: 'Мишень' },
      { emoji: '💡', label: 'Идея' },
      { emoji: '🔮', label: 'Шар' },
      { emoji: '🎵', label: 'Нота' },
      { emoji: '🎬', label: 'Кино' },
      { emoji: '📱', label: 'Телефон' },
      { emoji: '💻', label: 'Компьютер' },
    ],
  },
  {
    label: 'Природа',
    stickers: [
      { emoji: '☀️', label: 'Солнце' },
      { emoji: '🌙', label: 'Луна' },
      { emoji: '⭐', label: 'Звезда' },
      { emoji: '🌈', label: 'Радуга' },
      { emoji: '❄️', label: 'Снег' },
      { emoji: '🌸', label: 'Цветок' },
      { emoji: '🍀', label: 'Клевер' },
      { emoji: '🐱', label: 'Кот' },
      { emoji: '🐶', label: 'Собака' },
      { emoji: '🦊', label: 'Лиса' },
      { emoji: '🐻', label: 'Мишка' },
      { emoji: '🦄', label: 'Единорог' },
    ],
  },
];

// CSS animation classes for stickers
const stickerAnimations = `
@keyframes stickerBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
@keyframes stickerPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
}
@keyframes stickerShake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}
.sticker-hover:hover {
  animation: stickerBounce 0.4s ease;
}
.sticker-sent {
  animation: stickerPulse 0.6s ease;
}
`;

// Inject CSS
if (typeof document !== 'undefined' && !document.getElementById('sticker-animations')) {
  const style = document.createElement('style');
  style.id = 'sticker-animations';
  style.textContent = stickerAnimations;
  document.head.appendChild(style);
}

export default function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute bottom-full right-0 mb-2 w-80 rounded-xl overflow-hidden z-50"
      style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[10px] font-mono tracking-wider" style={{ color: 'var(--color-primary)' }}>СТИКЕРЫ</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5"><X className="w-3.5 h-3.5" style={{ color: '#5a5a70' }} /></button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto">
        {STICKER_CATEGORIES.map((cat, i) => (
          <button key={cat.label} onClick={() => setActiveCategory(i)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap transition-all"
            style={activeCategory === i
              ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }
              : { color: '#5a5a70', border: '1px solid transparent' }}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sticker grid */}
      <div className="h-56 overflow-y-auto p-2">
        <div className="grid grid-cols-6 gap-1">
          {STICKER_CATEGORIES[activeCategory].stickers.map((sticker) => (
            <button key={sticker.emoji} onClick={() => onSelect(sticker.emoji)}
              className="sticker-hover flex items-center justify-center p-2 rounded-lg transition-all hover:bg-white/5"
              title={sticker.label}>
              <span className="text-3xl">{sticker.emoji}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
