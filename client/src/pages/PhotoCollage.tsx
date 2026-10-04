import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Grid2x2, Grid3x3, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { showToast } from '../components/ui/NexusModal';

type LayoutId = 'auto' | 'grid2' | 'grid3' | 'row' | 'col' | 'hero';

const LAYOUTS: { id: LayoutId; label: string; icon: typeof Grid2x2; desc: string }[] = [
  { id: 'auto', label: 'Авто', icon: LayoutGrid, desc: 'Сетка под количество' },
  { id: 'grid2', label: '2×2', icon: Grid2x2, desc: 'Квадрат 2×2' },
  { id: 'grid3', label: '3×3', icon: Grid3x3, desc: 'Квадрат 3×3' },
  { id: 'row', label: 'Горизонталь', icon: LayoutGrid, desc: 'В один ряд' },
  { id: 'col', label: 'Вертикаль', icon: LayoutGrid, desc: 'В одну колонку' },
  { id: 'hero', label: '1+2', icon: LayoutGrid, desc: 'Крупная + две' },
];

interface ImgItem {
  id: string;
  file: File;
  preview: string;
  img?: HTMLImageElement;
}

const MAX_IMAGES = 9;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function PhotoCollage() {
  const [images, setImages] = useState<ImgItem[]>([]);
  const [layout, setLayout] = useState<LayoutId>('auto');
  const [gap, setGap] = useState(8);
  const [bgColor, setBgColor] = useState('#0a0a0f');
  const [isBusy, setIsBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { showToast(`Максимум ${MAX_IMAGES} изображений`, 'error'); return; }
    const toAdd = arr.slice(0, remaining);

    const newItems: ImgItem[] = [];
    for (const f of toAdd) {
      const preview = URL.createObjectURL(f);
      const img = new Image();
      await new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = preview;
      });
      newItems.push({ id: Math.random().toString(36).slice(2), file: f, preview, img });
    }
    setImages(prev => [...prev, ...newItems]);
  }, [images.length]);

  const removeItem = (id: string) => {
    setImages(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const moveItem = (from: number, to: number) => {
    setImages(prev => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  const buildCollage = async () => {
    if (images.length < 2) { showToast('Нужно минимум 2 изображения', 'error'); return; }
    setIsBusy(true);
    try {
      const loaded = images.filter(i => i.img);
      if (loaded.length < 2) throw new Error('Изображения не загрузились');

      // Determine grid
      const n = loaded.length;
      let cols: number;
      let rows: number;
      if (layout === 'grid2') { cols = 2; rows = 2; }
      else if (layout === 'grid3') { cols = 3; rows = 3; }
      else if (layout === 'row') { cols = n; rows = 1; }
      else if (layout === 'col') { cols = 1; rows = n; }
      else if (layout === 'hero') { cols = 2; rows = 2; }
      else {
        cols = Math.ceil(Math.sqrt(n));
        rows = Math.ceil(n / cols);
      }

      const cellW = 400;
      const cellH = 400;
      const canvas = document.createElement('canvas');
      canvas.width = cols * cellW + (cols + 1) * gap;
      canvas.height = rows * cellH + (rows + 1) * gap;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas недоступен');

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
        const scale = Math.max(w / img.width, h / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
      };

      if (layout === 'hero' && loaded[0]?.img && loaded[1]?.img) {
        // 1 big left + up to 2 stacked right
        const bigW = cellW + gap / 2;
        drawCover(loaded[0].img, gap, gap, bigW, rows * cellH + gap);
        for (let i = 1; i < Math.min(loaded.length, 3); i++) {
          const r = i - 1;
          const im = loaded[i].img;
          if (im) drawCover(im, bigW + gap * 2, gap + r * (cellH + gap), cellW / 2, cellH);
        }
        // leftover images fill remaining cells in the right column if any
      } else {
        loaded.forEach((item, i) => {
          const im = item.img;
          if (!im) return;
          const c = i % cols;
          const r = Math.floor(i / cols);
          const x = gap + c * (cellW + gap);
          const y = gap + r * (cellH + gap);
          drawCover(im, x, y, cellW, cellH);
        });
      }

      canvas.toBlob(blob => {
        if (!blob) { showToast('Ошибка сборки', 'error'); setIsBusy(false); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collage_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Коллаж сохранён', 'success');
        setIsBusy(false);
      }, 'image/png');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
          <LayoutGrid className="w-7 h-7 md:w-8 md:h-8" /> КОЛЛАЖ ИЗ ФОТО
        </h1>
        <p className="text-gray-400 mt-1 font-mono text-sm">// СЕТКА ИЗ 2–9 ИЗОБРАЖЕНИЙ</p>
      </div>

      {/* Layout picker */}
      <div className="glass rounded-xl p-4">
        <label className="font-mono text-xs text-gray-500 mb-2 block">РАСКЛАДКА</label>
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map(l => (
            <button key={l.id} onClick={() => setLayout(l.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs transition-all"
              style={layout === l.id
                ? { background: 'var(--color-primary)', color: '#000' }
                : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
              title={l.desc}>
              <l.icon className="w-3.5 h-3.5" /> {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="glass rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-xs text-gray-500 mb-2 block">ОТСТУП: {gap}px</label>
          <input type="range" min={0} max={32} value={gap} onChange={e => setGap(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
        </div>
        <div>
          <label className="font-mono text-xs text-gray-500 mb-2 block">ФОН</label>
          <div className="flex items-center gap-2">
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer bg-transparent border border-white/10" />
            <input value={bgColor} onChange={e => setBgColor(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="glass rounded-2xl p-8 text-center cursor-pointer transition-all"
        style={dragOver ? { borderColor: 'var(--color-primary)', background: 'rgba(0,255,136,0.05)' } : {}}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
      >
        <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: 'var(--color-primary)' }} />
        <p className="font-mono text-sm text-gray-300">ДОБАВЬТЕ ФОТО (2–9)</p>
        <p className="font-mono text-[10px] text-gray-600 mt-1">перетащите или нажмите</p>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {/* Preview strip with reorder */}
      {images.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <label className="font-mono text-xs text-gray-500 block">ИЗОБРАЖЕНИЯ ({images.length}) — ПЕРЕТАСКИВАЙТЕ ДЛЯ ПОРЯДКА</label>
          <div className="flex flex-wrap gap-2">
            {images.map((im, i) => (
              <div key={im.id} draggable
                onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                  if (!isNaN(from) && from !== i) moveItem(from, i);
                }}
                className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing">
                <img src={im.preview} alt="" className="w-full h-full object-cover pointer-events-none" />
                <button onClick={() => removeItem(im.id)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 hover:bg-black/80" aria-label="Удалить">
                  <X className="w-3 h-3 text-white" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-center font-mono text-[8px] bg-black/50 text-white">{i + 1}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={buildCollage} disabled={isBusy || images.length < 2}
              className="flex-1 py-2.5 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: '#000' }}>
              {isBusy ? 'СБОРКА...' : `СОБРАТЬ КОЛЛАЖ (${images.length})`}
            </motion.button>
            <button onClick={() => { images.forEach(i => URL.revokeObjectURL(i.preview)); setImages([]); }}
              className="px-4 py-2.5 rounded-xl glass text-gray-400 hover:text-gray-200 font-mono text-sm">
              ОЧИСТИТЬ
            </button>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <p className="font-mono text-[10px] text-gray-600">
          {formatFileSize(images.reduce((s, i) => s + i.file.size, 0))} исходников • вывод PNG 400px/ячейка
        </p>
      )}
    </div>
  );
}
