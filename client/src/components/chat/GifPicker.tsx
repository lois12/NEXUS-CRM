import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2 } from 'lucide-react';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

// Popular GIF categories (no API key needed - using placeholder approach)
const GIF_CATEGORIES = [
  { label: 'Смех', emoji: '😂', query: 'laughing' },
  { label: 'Аплодисменты', emoji: '👏', query: 'applause' },
  { label: 'Ого', emoji: '😮', query: 'surprised' },
  { label: 'Сердце', emoji: '❤️', query: 'heart' },
  { label: 'Танец', emoji: '💃', query: 'dance' },
  { label: 'Кот', emoji: '🐱', query: 'cat' },
  { label: 'Собака', emoji: '🐶', query: 'dog' },
  { label: 'Огонь', emoji: '🔥', query: 'fire' },
  { label: 'Победа', emoji: '🎉', query: 'celebration' },
  { label: 'Грусть', emoji: '😢', query: 'sad' },
  { label: 'Злость', emoji: '😤', query: 'angry' },
  { label: 'Любовь', emoji: '🥰', query: 'love' },
];

// Built-in emoji stickers (large emojis as stickers)
const STICKER_EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎',
  '🤩', '🥳', '😤', '😭', '😱', '🤔', '🤫', '😴',
  '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪',
  '❤️', '🔥', '⭐', '✅', '❌', '💯', '🎉', '🏆',
  '🚀', '⚡', '🌟', '💎', '🔮', '🎮', '🎵', '🎬',
  '😈', '👻', '💀', '🤖', '👽', '🎃', '🌈', '☀️',
];

export default function GifPicker({ onSelect, onClose: _onClose }: GifPickerProps) {
  const [tab, setTab] = useState<'stickers' | 'gif'>('stickers');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [gifs, setGifs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search GIFs via Tenor API (free, no key required for basic)
  useEffect(() => {
    if (tab !== 'gif' || searchQuery.length < 2) {
      setGifs([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        // Use Tenor's public API
        const res = await fetch(
          `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(searchQuery)}&key=AIzaSyDzXMYpR8kYXwLgmD1L-7bEAoRY3cYkMOk&limit=20&media_filter=tinygif`
        );
        const data = await res.json();
        if (data.results) {
          setGifs(data.results.map((r: any) => r.media_formats.tinygif.url));
        }
      } catch {
        // Fallback: show emoji stickers only
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, tab]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute bottom-full right-0 mb-2 w-72 rounded-xl overflow-hidden z-50"
      style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
    >
      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => setTab('stickers')}
          className="flex-1 py-2.5 text-[10px] font-mono tracking-wider transition-colors"
          style={tab === 'stickers' ? { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)', background: 'rgba(0,255,136,0.05)' } : { color: '#5a5a70' }}>
          СТИКЕРЫ
        </button>
        <button onClick={() => { setTab('gif'); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="flex-1 py-2.5 text-[10px] font-mono tracking-wider transition-colors"
          style={tab === 'gif' ? { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)', background: 'rgba(0,255,136,0.05)' } : { color: '#5a5a70' }}>
          GIF
        </button>
      </div>

      {/* Search for GIF tab */}
      {tab === 'gif' && (
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#4a4a60' }} />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск GIF..."
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#e0e0e0' }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="h-52 overflow-y-auto p-2">
        {tab === 'stickers' ? (
          <div className="grid grid-cols-8 gap-1">
            {STICKER_EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => onSelect(emoji)}
                className="text-2xl p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                {emoji}
              </button>
            ))}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : gifs.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((url, i) => (
              <button key={i} onClick={() => onSelect(url)}
                className="rounded-lg overflow-hidden hover:ring-2 hover:ring-green-500/50 transition-all">
                <img loading="lazy" decoding="async" src={url} alt="" className="w-full h-20 object-cover" />
              </button>
            ))}
          </div>
        ) : searchQuery.length >= 2 ? (
          <div className="flex items-center justify-center h-full text-[10px] font-mono" style={{ color: '#4a4a60' }}>
            Не найдено
          </div>
        ) : (
          <>
            <div className="px-1 py-1.5">
              <span className="text-[10px] font-mono" style={{ color: '#5a5a70' }}>КАТЕГОРИИ</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {GIF_CATEGORIES.map(cat => (
                <button key={cat.query} onClick={() => setSearchQuery(cat.query)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[9px] font-mono" style={{ color: '#8a8aa0' }}>{cat.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
