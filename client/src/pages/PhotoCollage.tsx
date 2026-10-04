import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Grid2x2, Grid3x3, LayoutGrid, Image as ImageIcon, Move } from 'lucide-react';
import { showToast } from '../components/ui/NexusModal';

type LayoutId = 'auto' | 'grid2' | 'grid3' | 'row' | 'col' | 'hero';

const LAYOUTS: { id: LayoutId; label: string; icon: typeof Grid2x2; desc: string }[] = [
  { id: 'auto', label: 'Авто', icon: LayoutGrid, desc: 'Сетка под количество' },
  { id: 'grid2', label: '2×2', icon: Grid2x2, desc: 'Квадрат 2×2' },
  { id: 'grid3', label: '3×3', icon: Grid3x3, desc: 'Квадрат 3×3' },
  { id: 'row', label: 'Горизонталь', icon: LayoutGrid, desc: 'В один ряд' },
  { id: 'col', label: 'Вертикаль', icon: LayoutGrid, desc: 'В одну колонку' },
  { id: 'hero', label: '1+2', icon: LayoutGrid, desc: 'Крупная слева + остальные справа' },
];

interface ImgItem {
  id: string;
  file: File;
  preview: string;
  img?: HTMLImageElement;
}

/** Grid cell in abstract grid units (col/row spans) */
interface Cell { col: number; row: number; colSpan: number; rowSpan: number }

const MAX_IMAGES = 9;
const CELL = 400; // export cell size in px

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Compute grid geometry for N images and a layout. Shared by preview + export. */
function computeCells(count: number, layout: LayoutId): { cols: number; rows: number; cells: Cell[] } {
  if (count <= 0) return { cols: 1, rows: 1, cells: [] };
  const n = count;

  if (layout === 'row') {
    return { cols: n, rows: 1, cells: Array.from({ length: n }, (_, i) => ({ col: i, row: 0, colSpan: 1, rowSpan: 1 })) };
  }
  if (layout === 'col') {
    return { cols: 1, rows: n, cells: Array.from({ length: n }, (_, i) => ({ col: 0, row: i, colSpan: 1, rowSpan: 1 })) };
  }
  if (layout === 'hero') {
    // big cell on the left spanning all rows, remaining images stacked in the right column
    const rows = Math.max(2, n - 1);
    const cells: Cell[] = [{ col: 0, row: 0, colSpan: 1, rowSpan: rows }];
    for (let i = 1; i < n; i++) {
      cells.push({ col: 1, row: i - 1, colSpan: 1, rowSpan: 1 });
    }
    return { cols: 2, rows, cells };
  }
  if (layout === 'grid2') {
    const cols = 2;
    const rows = Math.ceil(n / cols);
    return {
      cols, rows,
      cells: Array.from({ length: n }, (_, i) => ({ col: i % cols, row: Math.floor(i / cols), colSpan: 1, rowSpan: 1 })),
    };
  }
  if (layout === 'grid3') {
    const cols = 3;
    const rows = Math.ceil(n / cols);
    return {
      cols, rows,
      cells: Array.from({ length: n }, (_, i) => ({ col: i % cols, row: Math.floor(i / cols), colSpan: 1, rowSpan: 1 })),
    };
  }
  // auto
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return {
    cols, rows,
    cells: Array.from({ length: n }, (_, i) => ({ col: i % cols, row: Math.floor(i / cols), colSpan: 1, rowSpan: 1 })),
  };
}

export default function PhotoCollage() {
  const [images, setImages] = useState<ImgItem[]>([]);
  const [layout, setLayout] = useState<LayoutId>('auto');
  const [gap, setGap] = useState(8);
  const [bgColor, setBgColor] = useState('#0a0a0f');
  const [isBusy, setIsBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // swap-by-tap (touch devices): first tap selects, second tap swaps
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { cols, rows, cells } = useMemo(() => computeCells(images.length, layout), [images.length, layout]);

  // Live preview canvas
  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 0.5; // preview cell = 200px
    const cw = CELL * scale;
    const g = gap * scale;
    const W = cols * cw + (cols + 1) * g;
    const H = rows * cw + (rows + 1) * g;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    const drawCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
      const s = Math.max(w / img.width, h / img.height);
      const sw = img.width * s;
      const sh = img.height * s;
      ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
    };

    images.forEach((item, i) => {
      const im = item.img;
      const cell = cells[i];
      if (!im || !cell) return;
      const x = g + cell.col * (cw + g);
      const y = g + cell.row * (cw + g);
      const w = cell.colSpan * cw + (cell.colSpan - 1) * g;
      const h = cell.rowSpan * cw + (cell.rowSpan - 1) * g;
      drawCover(im, x, y, w, h);
    });
  }, [images, layout, gap, bgColor, cols, rows, cells]);

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
    setSelectedIdx(null);
  };

  /** Swap two images in place (order = position in collage) */
  const swapItems = (a: number, b: number) => {
    if (a === b) return;
    setImages(prev => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  const handleTapCell = (idx: number) => {
    if (selectedIdx === null) {
      setSelectedIdx(idx);
    } else if (selectedIdx === idx) {
      setSelectedIdx(null);
    } else {
      swapItems(selectedIdx, idx);
      setSelectedIdx(null);
    }
  };

  const buildCollage = async () => {
    if (images.length < 2) { showToast('Нужно минимум 2 изображения', 'error'); return; }
    setIsBusy(true);
    try {
      const loaded = images.filter(i => i.img);
      if (loaded.length < 2) throw new Error('Изображения не загрузились');

      const g = gap;
      const geometry = computeCells(loaded.length, layout);
      const canvas = document.createElement('canvas');
      canvas.width = geometry.cols * CELL + (geometry.cols + 1) * g;
      canvas.height = geometry.rows * CELL + (geometry.rows + 1) * g;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas недоступен');

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
        const s = Math.max(w / img.width, h / img.height);
        const sw = img.width * s;
        const sh = img.height * s;
        ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
      };

      loaded.forEach((item, i) => {
        const im = item.img;
        const cell = geometry.cells[i];
        if (!im || !cell) return;
        const x = g + cell.col * (CELL + g);
        const y = g + cell.row * (CELL + g);
        const w = cell.colSpan * CELL + (cell.colSpan - 1) * g;
        const h = cell.rowSpan * CELL + (cell.rowSpan - 1) * g;
        drawCover(im, x, y, w, h);
      });

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

      {/* ── LIVE PREVIEW with drag & swap ── */}
      {images.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-mono text-xs text-gray-500 flex items-center gap-2">
              <Move className="w-3.5 h-3.5" /> ПРЕВЬЮ — ПЕРЕТАСКИВАЙТЕ ИЛИ ТАПАЙТЕ ДЛЯ СМЕНЫ МЕСТ
            </label>
            <span className="font-mono text-[10px] text-gray-600">{cols}×{rows}</span>
          </div>

          {/* Real collage layout — each cell is a droppable target */}
          <div
            className="grid w-full max-w-2xl mx-auto rounded-xl overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gap: `${Math.max(2, gap / 4)}px`,
              background: bgColor,
              aspectRatio: `${cols} / ${rows}`,
            }}
          >
            {cells.map((cell, i) => {
              const im = images[i];
              const isSelected = selectedIdx === i;
              const isDragging = dragIdx === i;
              return (
                <div
                  key={im?.id ?? `empty-${i}`}
                  draggable={!!im}
                  onDragStart={e => {
                    if (!im) return;
                    e.dataTransfer.setData('text/plain', String(i));
                    e.dataTransfer.effectAllowed = 'move';
                    setDragIdx(i);
                  }}
                  onDragEnd={() => setDragIdx(null)}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={e => {
                    e.preventDefault();
                    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    if (!isNaN(from) && from !== i) swapItems(from, i);
                    setDragIdx(null);
                  }}
                  onClick={() => im && handleTapCell(i)}
                  style={{
                    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                    opacity: isDragging ? 0.4 : 1,
                    outline: isSelected ? '3px solid var(--color-primary)' : 'none',
                    outlineOffset: '-3px',
                    cursor: im ? (isSelected ? 'grabbing' : 'grab') : 'default',
                    position: 'relative',
                  }}
                  className="overflow-hidden transition-all hover:brightness-110"
                >
                  {im ? (
                    <>
                      <img src={im.preview} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" />
                      <span className="absolute bottom-1 left-1 font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-white pointer-events-none">
                        {i + 1}
                      </span>
                      <button onClick={e => { e.stopPropagation(); removeItem(im.id); }}
                        className="absolute top-1 right-1 p-0.5 rounded bg-black/60 hover:bg-black/80" aria-label="Удалить">
                        <X className="w-3 h-3 text-white" />
                      </button>
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="font-mono text-[9px] px-2 py-1 rounded bg-black/70 text-white">ТАПНИ ДРУГОЕ</span>
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <ImageIcon className="w-5 h-5 opacity-30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Export preview canvas (what will be saved) */}
          <div className="text-center space-y-2">
            <label className="font-mono text-[10px] text-gray-500 block">ИТОГ (400px/ЯЧЕЙКА)</label>
            <canvas ref={previewRef} className="max-w-full max-h-64 rounded-lg border border-white/10 inline-block" />
          </div>

          <div className="flex gap-2 pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={buildCollage} disabled={isBusy || images.length < 2}
              className="flex-1 py-2.5 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: '#000' }}>
              {isBusy ? 'СБОРКА...' : `СКАЧАТЬ PNG (${images.length})`}
            </motion.button>
            <button onClick={() => { images.forEach(i => URL.revokeObjectURL(i.preview)); setImages([]); setSelectedIdx(null); }}
              className="px-4 py-2.5 rounded-xl glass text-gray-400 hover:text-gray-200 font-mono text-sm">
              ОЧИСТИТЬ
            </button>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <p className="font-mono text-[10px] text-gray-600">
          {formatFileSize(images.reduce((s, i) => s + i.file.size, 0))} исходников • PNG • {cols}×{rows}
        </p>
      )}
    </div>
  );
}
