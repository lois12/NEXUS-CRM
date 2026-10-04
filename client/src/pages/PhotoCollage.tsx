import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Square, Circle, Diamond, PenTool, Image as ImageIcon, X, Download,
  Trash2, Copy, Layers, Move, Maximize2, Minimize2, Type,
} from 'lucide-react';
import { showToast } from '../components/ui/NexusModal';

// ── Types ─────────────────────────────────────────────────────
type ShapeType = 'rect' | 'circle' | 'ellipse' | 'diamond' | 'polygon' | 'text';
type FitMode = 'cover' | 'contain';
type TextAlign = 'left' | 'center' | 'right';

interface Pt { x: number; y: number } // normalized 0..1 of canvas

interface Zone {
  id: string;
  type: ShapeType;
  x: number; y: number; w: number; h: number; // normalized bbox
  radius: number;      // 0..50 (% of half min-side) for rect
  imgRadius: number;   // 0..50 — rounding of the IMAGE inside the zone
  fit: FitMode;
  points?: Pt[];       // for polygon (normalized)
  imgId?: string | null;
  // text layer
  text?: string;
  fontFamily?: string;
  fontSize?: number;   // fraction of canvas height (0.02..0.2)
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
  align?: TextAlign;
}

interface ImgItem {
  id: string;
  file: File;
  preview: string;
  img?: HTMLImageElement;
}

type CanvasFormat = 'square' | 'landscape' | 'portrait';

const FORMATS: Record<CanvasFormat, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: '1:1 Квадрат' },
  landscape: { w: 1200, h: 800, label: '3:2 Альбом' },
  portrait: { w: 800, h: 1200, label: '2:3 Книга' },
};

/** 20 beautiful Cyrillic-capable fonts (Google Fonts) */
const FONTS = [
  'Montserrat', 'Play', 'Ubuntu', 'Fira Sans', 'Rubik', 'Roboto', 'Open Sans',
  'Noto Sans', 'PT Sans', 'PT Serif', 'Golos Text', 'Onest', 'Unbounded',
  'Manrope', 'Commissioner', 'Jost', 'Ruda', 'Underdog', 'Ruslan Display',
  'Cormorant Garamond',
];

const FONT_STYLES: Record<string, string> = {
  'Montserrat': 'Montserrat:wght@400;700',
  'Play': 'Play:wght@400;700',
  'Ubuntu': 'Ubuntu:wght@400;700',
  'Fira Sans': 'Fira+Sans:wght@400;700',
  'Rubik': 'Rubik:wght@400;700',
  'Roboto': 'Roboto:wght@400;700',
  'Open Sans': 'Open+Sans:wght@400;700',
  'Noto Sans': 'Noto+Sans:wght@400;700',
  'PT Sans': 'PT+Sans:wght@400;700',
  'PT Serif': 'PT+Serif:wght@400;700',
  'Golos Text': 'Golos+Text:wght@400;700',
  'Onest': 'Onest:wght@400;700',
  'Unbounded': 'Unbounded:wght@400;700',
  'Manrope': 'Manrope:wght@400;700',
  'Commissioner': 'Commissioner:wght@400;700',
  'Jost': 'Jost:wght@400;700',
  'Ruda': 'Ruda:wght@400;700',
  'Underdog': 'Underdog',
  'Ruslan Display': 'Ruslan+Display',
  'Cormorant Garamond': 'Cormorant+Garamond:wght@400;700',
};

// inject Google Fonts (Cyrillic subsets included by default via css2)
if (typeof document !== 'undefined' && !document.getElementById('collage-fonts')) {
  const link = document.createElement('link');
  link.id = 'collage-fonts';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${
    Object.values(FONT_STYLES).map(s => `family=${s}`).join('&')
  }&display=swap`;
  document.head.appendChild(link);
}

const PRESETS: { id: string; label: string; build: () => Zone[] }[] = [
  {
    id: 'grid2', label: '2×2',
    build: () => {
      const mk = (x: number, y: number): Zone => ({ id: uid(), type: 'rect', x, y, w: 0.49, h: 0.49, radius: 0, imgRadius: 0, fit: 'cover', imgId: null });
      return [mk(0.005, 0.005), mk(0.505, 0.005), mk(0.005, 0.505), mk(0.505, 0.505)];
    },
  },
  {
    id: 'grid3', label: '3×3',
    build: () => {
      const out: Zone[] = [];
      const s = 0.326;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        out.push({ id: uid(), type: 'rect', x: 0.005 + c * 0.331, y: 0.005 + r * 0.331, w: s, h: s, radius: 0, imgRadius: 0, fit: 'cover', imgId: null });
      }
      return out;
    },
  },
  {
    id: 'hero', label: '1+2',
    build: () => [
      { id: uid(), type: 'rect', x: 0.005, y: 0.005, w: 0.6, h: 0.99, radius: 0, imgRadius: 0, fit: 'cover', imgId: null },
      { id: uid(), type: 'rect', x: 0.615, y: 0.005, w: 0.38, h: 0.49, radius: 0, imgRadius: 0, fit: 'cover', imgId: null },
      { id: uid(), type: 'rect', x: 0.615, y: 0.505, w: 0.38, h: 0.49, radius: 0, imgRadius: 0, fit: 'cover', imgId: null },
    ],
  },
  {
    id: 'circles', label: '4 круга',
    build: () => {
      const mk = (x: number, y: number): Zone => ({ id: uid(), type: 'circle', x, y, w: 0.48, h: 0.48, radius: 0, imgRadius: 0, fit: 'cover', imgId: null });
      return [mk(0.01, 0.01), mk(0.51, 0.01), mk(0.01, 0.51), mk(0.51, 0.51)];
    },
  },
];

const uid = () => Math.random().toString(36).slice(2);

function clamp(v: number, a: number, b: number) { return Math.min(b, Math.max(a, v)); }

/** CSS clip-path for non-rect shapes (preview) */
function clipPathFor(z: Zone): string | undefined {
  if (z.type === 'circle') return 'circle(50% at 50% 50%)';
  if (z.type === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  if (z.type === 'diamond') return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  if (z.type === 'polygon' && z.points?.length) {
    return `polygon(${z.points.map(p => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`).join(', ')})`;
  }
  return undefined;
}

/** Trace shape onto a canvas ctx as a clip path (normalized coords × W/H) */
function traceShape(ctx: CanvasRenderingContext2D, z: Zone, W: number, H: number) {
  const x = z.x * W;
  const y = z.y * H;
  const w = z.w * W;
  const h = z.h * H;
  ctx.beginPath();
  if (z.type === 'rect') {
    const r = (z.radius / 100) * Math.min(w, h) / 2;
    if (r > 0 && typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else if (r > 0) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    } else {
      ctx.rect(x, y, w, h);
    }
  } else if (z.type === 'circle' || z.type === 'ellipse') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else if (z.type === 'diamond') {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
  } else if (z.points?.length) {
    // points are ZONE-relative (0..1) — map into canvas coords via the bbox
    z.points.forEach((p, i) => {
      const px = (z.x + p.x * z.w) * W;
      const py = (z.y + p.y * z.h) * H;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }
}

/** Rounded-rect clip path for image rounding (imgRadius) */
function traceImgRound(ctx: CanvasRenderingContext2D, z: Zone, W: number, H: number) {
  const x = z.x * W;
  const y = z.y * H;
  const w = z.w * W;
  const h = z.h * H;
  const r = (z.imgRadius / 100) * Math.min(w, h) / 2;
  ctx.beginPath();
  if (r > 0 && typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, r);
  } else if (r > 0) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  } else {
    ctx.rect(x, y, w, h);
  }
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  fit: FitMode
) {
  const scale = fit === 'cover'
    ? Math.max(w / img.width, h / img.height)
    : Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = (text || '').split('\n');
  const out: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = line + ' ' + words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}


// ── Component ─────────────────────────────────────────────────
export default function PhotoCollage() {
  const [format, setFormat] = useState<CanvasFormat>('square');
  const [bgColor, setBgColor] = useState('#0a0a0f');
  const [outerRadius, setOuterRadius] = useState(0);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [images, setImages] = useState<ImgItem[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawPts, setDrawPts] = useState<Pt[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; zone: Zone; startX: number; startY: number; orig: Zone } | null>(null);

  const fmt = FORMATS[format];
  const sel = zones.find(z => z.id === selId) || null;

  useEffect(() => {
    const h = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const addImage = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    const newItems: ImgItem[] = [];
    for (const f of arr) {
      const preview = URL.createObjectURL(f);
      const img = new Image();
      await new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); img.src = preview; });
      newItems.push({ id: uid(), file: f, preview, img });
    }
    setImages(prev => [...prev, ...newItems]);
  }, []);

  const updateZone = (id: string, patch: Partial<Zone>) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z));
  };

  const addShape = (type: ShapeType) => {
    const z: Zone = type === 'polygon' && drawPts.length >= 3
      ? {
          id: uid(), type, x: 0, y: 0, w: 1, h: 1, radius: 0, imgRadius: 0, fit: 'cover', imgId: null,
          points: drawPts.map(p => ({ ...p })),
        }
      : {
          id: uid(), type, x: 0.2, y: 0.2, w: 0.5, h: 0.5,
          radius: 0, imgRadius: 0, fit: 'cover', imgId: null,
        };
    // For polygon: normalize points to the bbox (0..1 within the zone) so
    // CSS clip-path (%) and canvas trace agree — otherwise the shape distorts
    if (type === 'polygon' && z.points?.length) {
      const xs = z.points.map(p => p.x);
      const ys = z.points.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = Math.max(maxX - minX, 0.01);
      const bh = Math.max(maxY - minY, 0.01);
      z.x = minX; z.y = minY; z.w = bw; z.h = bh;
      z.points = drawPts.map(p => ({ x: (p.x - minX) / bw, y: (p.y - minY) / bh }));
    }
    setZones(prev => [...prev, z]);
    setSelId(z.id);
    setDrawing(false);
    setDrawPts([]);
  };

  const addTextZone = () => {
    const z: Zone = {
      id: uid(), type: 'text',
      x: 0.15, y: 0.4, w: 0.7, h: 0.15,
      radius: 0, imgRadius: 0, fit: 'cover', imgId: null,
      text: 'Ваш текст', fontFamily: 'Montserrat', fontSize: 0.06,
      fontColor: '#ffffff', fontWeight: 'bold', align: 'center',
    };
    setZones(prev => [...prev, z]);
    setSelId(z.id);
  };

  // z-index = array order (last drawn on top). Reorder helpers:
  const bringForward = (id: string) => {
    setZones(prev => {
      const i = prev.findIndex(z => z.id === id);
      if (i < 0 || i === prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  };
  const sendBackward = (id: string) => {
    setZones(prev => {
      const i = prev.findIndex(z => z.id === id);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i], next[i - 1]] = [next[i - 1], next[i]];
      return next;
    });
  };
  const bringToFront = (id: string) => {
    setZones(prev => {
      const z = prev.find(x => x.id === id);
      if (!z) return prev;
      return [...prev.filter(x => x.id !== id), z];
    });
  };
  const sendToBack = (id: string) => {
    setZones(prev => {
      const z = prev.find(x => x.id === id);
      if (!z) return prev;
      return [z, ...prev.filter(x => x.id !== id)];
    });
  };

  const removeZone = (id: string) => {
    setZones(prev => prev.filter(z => z.id !== id));
    if (selId === id) setSelId(null);
  };

  const duplicateZone = (z: Zone) => {
    const copy: Zone = { ...z, id: uid(), x: clamp(z.x + 0.02, 0, 1 - z.w), y: clamp(z.y + 0.02, 0, 1 - z.h), points: z.points?.map(p => ({ ...p })) };
    setZones(prev => [...prev, copy]);
    setSelId(copy.id);
  };

  // ── Pointer interaction (move / resize) — works with touch via pointer events
  const onZonePointerDown = (e: React.PointerEvent, z: Zone, mode: 'move' | 'resize') => {
    if (drawing) return;
    e.stopPropagation();
    setSelId(z.id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, zone: z, startX: e.clientX, startY: e.clientY, orig: { ...z } };
  };

  const onZonePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    if (d.mode === 'move') {
      updateZone(d.zone.id, {
        x: clamp(d.orig.x + dx, -d.orig.w + 0.02, 0.98),
        y: clamp(d.orig.y + dy, -d.orig.h + 0.02, 0.98),
      });
    } else {
      updateZone(d.zone.id, {
        w: clamp(d.orig.w + dx, 0.05, 1.5),
        h: clamp(d.orig.h + dy, 0.05, 1.5),
      });
    }
  };

  const onZonePointerUp = () => { dragRef.current = null; };

  // ── Drawing a freeform polygon on the canvas
  const onCanvasClick = (e: React.MouseEvent) => {
    if (!drawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    setDrawPts(prev => [...prev, { x, y }]);
  };

  const finishPolygon = () => {
    if (drawPts.length < 3) { showToast('Нужно минимум 3 точки', 'error'); return; }
    addShape('polygon');
  };

  // ── Export ───────────────────────────────────────────────────
  const exportPng = async () => {
    if (zones.length === 0) { showToast('Добавьте хотя бы одну зону', 'error'); return; }
    setIsBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = fmt.w;
      canvas.height = fmt.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas недоступен');

      // background with optional outer radius clip
      const outerR = (outerRadius / 100) * Math.min(fmt.w, fmt.h) / 2;
      if (outerR > 0) {
        traceShape(ctx, { id: '', type: 'rect', x: 0, y: 0, w: 1, h: 1, radius: outerRadius, imgRadius: 0, fit: 'cover' }, fmt.w, fmt.h);
        ctx.clip();
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, fmt.w, fmt.h);

      for (const z of zones) {
        ctx.save();
        if (z.type === 'text') {
          // Text layer — no clipping
          const px = (z.fontSize || 0.06) * fmt.h;
          const family = z.fontFamily || 'Montserrat';
          ctx.font = `${z.fontWeight === 'bold' ? '700' : '400'} ${px}px "${family}", sans-serif`;
          ctx.fillStyle = z.fontColor || '#ffffff';
          ctx.textBaseline = 'top';
          const maxW = z.w * fmt.w;
          const lines = wrapText(ctx, z.text || '', maxW);
          const align = z.align || 'left';
          ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
          const tx = z.x * fmt.w + (align === 'center' ? maxW / 2 : align === 'right' ? maxW : 0);
          lines.forEach((line, li) => {
            ctx.fillText(line, tx, z.y * fmt.h + li * px * 1.15);
          });
          ctx.restore();
          continue;
        }
        // Shape zone: clip to shape, then to image-round rect, then draw
        traceShape(ctx, z, fmt.w, fmt.h);
        ctx.clip();
        const imgItem = z.imgId ? images.find(i => i.id === z.imgId) : null;
        if (imgItem?.img) {
          if (z.imgRadius > 0) {
            // nested clip: image rounded independently of zone shape
            ctx.save();
            traceImgRound(ctx, z, fmt.w, fmt.h);
            ctx.clip();
            drawFitted(ctx, imgItem.img, z.x * fmt.w, z.y * fmt.h, z.w * fmt.w, z.h * fmt.h, z.fit);
            ctx.restore();
          } else {
            drawFitted(ctx, imgItem.img, z.x * fmt.w, z.y * fmt.h, z.w * fmt.w, z.h * fmt.h, z.fit);
          }
        } else {
          // empty zone: subtle placeholder
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fill();
        }
        ctx.restore();
      }

      canvas.toBlob(blob => {
        if (!blob) { showToast('Ошибка экспорта', 'error'); setIsBusy(false); return; }
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

  // keyboard: Enter finishes polygon, Delete removes selected zone
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (drawing && e.key === 'Enter') { e.preventDefault(); finishPolygon(); }
      if (!drawing && selId && (e.key === 'Delete' || e.key === 'Backspace')) {
        // don't steal backspace from inputs
        const t = e.target as HTMLElement;
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') removeZone(selId);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, drawPts, selId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
          <Layers className="w-7 h-7" /> КОЛЛАЖ — РЕДАКТОР ЗОН
        </h1>
        <p className="text-gray-400 mt-1 font-mono text-sm">// ФИГУРЫ, РИСОВАНИЕ, СВОБОДНЫЕ РАЗМЕРЫ</p>
      </div>

      {/* Toolbar */}
      <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-gray-500">ЗОНА:</span>
        {([
          ['rect', Square, 'Прямоугольник'], ['circle', Circle, 'Круг'],
          ['ellipse', Circle, 'Эллипс'], ['diamond', Diamond, 'Ромб'],
        ] as const).map(([t, Icon, lbl]) => (
          <button key={t} onClick={() => addShape(t)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all"
            title={lbl}>
            <Icon className="w-3.5 h-3.5" /> {lbl}
          </button>
        ))}
        <button onClick={() => { setDrawing(v => !v); setDrawPts([]); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs transition-all"
          style={drawing ? { background: 'var(--color-primary)', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
          title="Нарисовать произвольную зону">
          <PenTool className="w-3.5 h-3.5" /> Рисовать {drawing ? `(${drawPts.length} точек)` : ''}
        </button>
        <button onClick={addTextZone}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all"
          title="Добавить текст">
          <Type className="w-3.5 h-3.5" /> Текст
        </button>
        {drawing && (
          <>
            <button onClick={finishPolygon} disabled={drawPts.length < 3}
              className="px-3 py-2 rounded-lg font-mono text-xs font-bold disabled:opacity-40"
              style={{ background: 'var(--color-primary)', color: '#000' }}>ГОТОВО</button>
            <button onClick={() => { setDrawing(false); setDrawPts([]); }}
              className="px-3 py-2 rounded-lg font-mono text-xs glass text-gray-400">ОТМЕНА</button>
          </>
        )}

        <div className="w-px h-6 bg-white/10 mx-1" />

        <span className="font-mono text-[10px] text-gray-500">ФОРМАТ:</span>
        {(Object.keys(FORMATS) as CanvasFormat[]).map(f => (
          <button key={f} onClick={() => setFormat(f)}
            className="px-3 py-2 rounded-lg font-mono text-xs transition-all"
            style={format === f ? { background: 'var(--color-primary)', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
            {FORMATS[f].label}
          </button>
        ))}

        <div className="w-px h-6 bg-white/10 mx-1" />

        <span className="font-mono text-[10px] text-gray-500">ШАБЛОН:</span>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => { setZones(p.build()); setSelId(null); }}
            className="px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">{p.label}</button>
        ))}
      </div>

      <div id="collage-editor" className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Canvas */}
        <div className="lg:col-span-3 space-y-4">
          <div
            ref={canvasRef}
            onClick={drawing ? onCanvasClick : undefined}
            id="collage-canvas"
            className="relative mx-auto rounded-xl overflow-hidden select-none"
            style={{
              width: '100%',
              // fullscreen: fill available height (kills the dead zone at the bottom)
              maxWidth: isFull ? `min(100%, calc((100vh - 220px) * ${fmt.w / fmt.h}))` : 560,
              maxHeight: isFull ? 'calc(100vh - 220px)' : undefined,
              aspectRatio: `${fmt.w} / ${fmt.h}`,
              background: bgColor,
              borderRadius: `${outerRadius}%`,
              cursor: drawing ? 'crosshair' : 'default',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onPointerMove={onZonePointerMove}
            onPointerUp={onZonePointerUp}
          >
            {/* zones */}
            {zones.map(z => {
              const imgItem = z.imgId ? images.find(i => i.id === z.imgId) : null;
              const selected = z.id === selId;

              // TEXT zone — rendered as styled div
              if (z.type === 'text') {
                return (
                  <div
                    key={z.id}
                    onPointerDown={e => onZonePointerDown(e, z, 'move')}
                    style={{
                      position: 'absolute',
                      left: `${z.x * 100}%`, top: `${z.y * 100}%`,
                      width: `${z.w * 100}%`, height: `${z.h * 100}%`,
                      cursor: 'move',
                      touchAction: 'none',
                      outline: selected ? '2px dashed var(--color-primary)' : '1px dashed rgba(255,255,255,0.15)',
                      outlineOffset: 2,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: z.align === 'center' ? 'center' : z.align === 'right' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: `"${z.fontFamily || 'Montserrat'}", sans-serif`,
                        fontSize: `${(z.fontSize || 0.06) * 100}cqh`,
                        color: z.fontColor || '#ffffff',
                        fontWeight: z.fontWeight === 'bold' ? 700 : 400,
                        lineHeight: 1.15,
                        textAlign: z.align || 'left',
                        width: '100%',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                        textShadow: '0 1px 4px rgba(0,0,0,0.35)',
                        pointerEvents: 'none',
                      }}
                    >
                      {z.text || 'Ваш текст'}
                    </p>
                    {selected && (
                      <div
                        onPointerDown={e => onZonePointerDown(e, z, 'resize')}
                        style={{
                          position: 'absolute', right: -7, bottom: -7,
                          width: 14, height: 14, borderRadius: 4,
                          background: 'var(--color-primary)', cursor: 'nwse-resize', touchAction: 'none',
                          zIndex: 5,
                        }}
                      />
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={z.id}
                  onPointerDown={e => onZonePointerDown(e, z, 'move')}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const photoId = e.dataTransfer.getData('text/photo');
                    if (photoId) updateZone(z.id, { imgId: photoId });
                  }}
                  style={{
                    position: 'absolute',
                    left: `${z.x * 100}%`, top: `${z.y * 100}%`,
                    width: `${z.w * 100}%`, height: `${z.h * 100}%`,
                    cursor: 'move',
                    touchAction: 'none',
                    outline: selected ? '2px dashed var(--color-primary)' : '1px dashed rgba(255,255,255,0.25)',
                    outlineOffset: 2,
                  }}
                >
                  {/* clipped visual surface — keeps the resize handle OUTSIDE overflow */}
                  <div
                    style={{
                      width: '100%', height: '100%',
                      clipPath: clipPathFor(z),
                      borderRadius: z.type === 'rect' ? `${z.radius}%` : 0,
                      overflow: 'hidden',
                      background: imgItem ? 'transparent' : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    {imgItem?.img ? (
                      <img
                        src={imgItem.preview}
                        alt=""
                        draggable={false}
                        style={{
                          width: '100%', height: '100%',
                          objectFit: z.fit === 'cover' ? 'cover' : 'contain',
                          // image corner rounding — independent of zone shape
                          borderRadius: z.imgRadius > 0 ? `${z.imgRadius}%` : 0,
                          pointerEvents: 'none',
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none gap-1">
                        <ImageIcon className="w-6 h-6 text-gray-600 opacity-40" />
                        <span className="font-mono text-[8px] text-gray-600">перетащите фото</span>
                      </div>
                    )}
                  </div>
                  {/* resize handle — outside the overflow:hidden surface */}
                  {selected && (
                    <div
                      onPointerDown={e => onZonePointerDown(e, z, 'resize')}
                      style={{
                        position: 'absolute', right: -7, bottom: -7,
                        width: 14, height: 14, borderRadius: 4,
                        background: 'var(--color-primary)', cursor: 'nwse-resize', touchAction: 'none',
                        zIndex: 5,
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* polygon drawing overlay — viewBox 0..100 (SVG points can't use %) */}
            {drawing && drawPts.length > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ zIndex: 50 }}
              >
                <polyline
                  points={drawPts.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
                  fill={drawPts.length >= 3 ? 'rgba(0,255,136,0.12)' : 'none'}
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {drawPts.length >= 3 && (
                  <line
                    x1={drawPts[drawPts.length - 1].x * 100} y1={drawPts[drawPts.length - 1].y * 100}
                    x2={drawPts[0].x * 100} y2={drawPts[0].y * 100}
                    stroke="var(--color-primary)" strokeOpacity="0.5" strokeDasharray="4 4"
                    strokeWidth="2" vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            )}
            {drawing && drawPts.map((p, i) => (
              <div
                key={`pt-${i}`}
                onClick={i === 0 && drawPts.length >= 3 ? (e) => { e.stopPropagation(); finishPolygon(); } : undefined}
                style={{
                  position: 'absolute',
                  left: `${p.x * 100}%`, top: `${p.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 12, height: 12,
                  borderRadius: '50%',
                  background: i === 0 && drawPts.length >= 3 ? '#fff' : 'var(--color-primary)',
                  border: '2px solid #000',
                  zIndex: 51,
                  pointerEvents: 'auto',
                  cursor: i === 0 && drawPts.length >= 3 ? 'pointer' : 'default',
                }}
                title={i === 0 && drawPts.length >= 3 ? 'Нажмите, чтобы закрыть фигуру' : `Точка ${i + 1}`}
              />
            ))}
          </div>

          {drawing && (
            <p className="font-mono text-[10px] text-gray-500 text-center">
              кликайте по канвасу чтобы добавить точки → «ГОТОВО» или Enter чтобы закрыть фигуру
            </p>
          )}

          {/* Photo tray */}
          <div className="glass rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="font-mono text-xs text-gray-500 flex items-center gap-2">
                <Move className="w-3.5 h-3.5" /> ФОТО ({images.length}) — ПЕРЕТАЩИТЕ НА ЗОНУ ИЛИ КЛИКНИТЕ
              </label>
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg font-mono text-xs glass hover:bg-white/10 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> ДОБАВИТЬ
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById('collage-editor');
                    if (!document.fullscreenElement) el?.requestFullscreen?.();
                    else document.exitFullscreen?.();
                  }}
                  className="px-3 py-1.5 rounded-lg font-mono text-xs glass hover:bg-white/10 flex items-center gap-1"
                  title="Во весь экран">
                  {isFull ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  {isFull ? 'СВЕРНУТЬ' : 'НА ВЕСЬ ЭКРАН'}
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) addImage(e.target.files); e.target.value = ''; }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {images.map(im => (
                <div
                  key={im.id}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/photo', im.id); }}
                  onClick={() => { if (selId) updateZone(selId, { imgId: im.id }); else showToast('Сначала выберите зону', 'error'); }}
                  className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing hover:border-[var(--color-primary)] transition-colors"
                >
                  <img src={im.preview} alt="" className="w-full h-full object-cover pointer-events-none" />
                </div>
              ))}
              {images.length === 0 && (
                <p className="font-mono text-[10px] text-gray-600">добавьте фото, затем перетащите на зону</p>
              )}
            </div>
          </div>
        </div>

        {/* Inspector */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 space-y-3">
            <label className="font-mono text-xs text-gray-500 block">КАНВАС</label>
            <div>
              <label className="font-mono text-[10px] text-gray-500 mb-1 block">ФОН</label>
              <div className="flex items-center gap-2">
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                  className="w-9 h-9 rounded cursor-pointer bg-transparent border border-white/10" />
                <input value={bgColor} onChange={e => setBgColor(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] text-gray-500 mb-1 block">ЗАКРУГЛЕНИЕ КАРТИНКИ: {outerRadius}%</label>
              <input type="range" min={0} max={50} value={outerRadius} onChange={e => setOuterRadius(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
            </div>
          </div>

          {sel ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-4 space-y-3">
              <label className="font-mono text-xs text-gray-500 block">ЗОНА — {sel.type.toUpperCase()}</label>

              {/* TEXT settings */}
              {sel.type === 'text' && (
                <>
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">ТЕКСТ</label>
                    <textarea value={sel.text || ''} rows={3}
                      onChange={e => updateZone(sel.id, { text: e.target.value })}
                      className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">ШРИФТ (кириллица)</label>
                    <select value={sel.fontFamily || 'Montserrat'}
                      onChange={e => updateZone(sel.id, { fontFamily: e.target.value })}
                      className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                      {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                    </select>
                    <p className="mt-1 px-2 py-1 rounded text-sm" style={{ fontFamily: sel.fontFamily || 'Montserrat', color: sel.fontColor }}>
                      Пример: Нексус CRM 123
                    </p>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">РАЗМЕР: {Math.round((sel.fontSize || 0.06) * 1000) / 10}%</label>
                    <input type="range" min={20} max={200} value={Math.round((sel.fontSize || 0.06) * 1000)}
                      onChange={e => updateZone(sel.id, { fontSize: +e.target.value / 1000 })}
                      className="w-full accent-[var(--color-primary)]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-mono text-[10px] text-gray-500 mb-1 block">ЦВЕТ</label>
                      <input type="color" value={sel.fontColor || '#ffffff'}
                        onChange={e => updateZone(sel.id, { fontColor: e.target.value })}
                        className="w-full h-9 rounded cursor-pointer bg-transparent border border-white/10" />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] text-gray-500 mb-1 block">НАЧЕРТАНИЕ</label>
                      <select value={sel.fontWeight || 'normal'}
                        onChange={e => updateZone(sel.id, { fontWeight: e.target.value as 'normal' | 'bold' })}
                        className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                        <option value="normal">Обычное</option>
                        <option value="bold">Жирное</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">ВЫРАВНИВАНИЕ</label>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as TextAlign[]).map(a => (
                        <button key={a} onClick={() => updateZone(sel.id, { align: a })}
                          className="flex-1 py-1.5 rounded font-mono text-[10px] transition-all"
                          style={(sel.align || 'center') === a
                            ? { background: 'var(--color-primary)', color: '#000' }
                            : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
                          {a === 'left' ? '←' : a === 'center' ? '↔' : '→'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* IMAGE settings (non-text zones) */}
              {sel.type !== 'text' && (
                <>
                  {sel.type === 'rect' && (
                    <div>
                      <label className="font-mono text-[10px] text-gray-500 mb-1 block">СКРУГЛЕНИЕ УГЛОВ ЗОНЫ: {sel.radius}%</label>
                      <input type="range" min={0} max={50} value={sel.radius}
                        onChange={e => updateZone(sel.id, { radius: +e.target.value })}
                        className="w-full accent-[var(--color-primary)]" />
                    </div>
                  )}
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">СКРУГЛЕНИЕ КАРТИНКИ: {sel.imgRadius}%</label>
                    <input type="range" min={0} max={50} value={sel.imgRadius}
                      onChange={e => updateZone(sel.id, { imgRadius: +e.target.value })}
                      className="w-full accent-[var(--color-primary)]" />
                    <p className="font-mono text-[9px] text-gray-600 mt-1">мягкий угол самой фотографии</p>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">ЗАЛИВКА ФОТО</label>
                    <select value={sel.fit} onChange={e => updateZone(sel.id, { fit: e.target.value as FitMode })}
                      className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                      <option value="cover">Заполнить (cover)</option>
                      <option value="contain">Вместить (contain)</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="font-mono text-[10px] text-gray-500 mb-1 block">РАЗМЕР</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="font-mono text-[9px] text-gray-500">Ш
                    <input type="range" min={5} max={100} value={Math.round(sel.w * 100)}
                      onChange={e => updateZone(sel.id, { w: +e.target.value / 100 })}
                      className="w-full accent-[var(--color-primary)]" />
                  </label>
                  <label className="font-mono text-[9px] text-gray-500">В
                    <input type="range" min={5} max={100} value={Math.round(sel.h * 100)}
                      onChange={e => updateZone(sel.id, { h: +e.target.value / 100 })}
                      className="w-full accent-[var(--color-primary)]" />
                  </label>
                </div>
              </div>

              {/* Z-INDEX: layer order */}
              <div>
                <label className="font-mono text-[10px] text-gray-500 mb-1 block">СЛОЙ (порядок поверх фото)</label>
                <div className="grid grid-cols-4 gap-1">
                  <button onClick={() => sendToBack(sel.id)} title="Назад всех"
                    className="py-1.5 rounded font-mono text-[9px] glass hover:bg-white/10">⇤ НИЗ</button>
                  <button onClick={() => sendBackward(sel.id)} title="Ниже"
                    className="py-1.5 rounded font-mono text-[9px] glass hover:bg-white/10">↓ НИЖЕ</button>
                  <button onClick={() => bringForward(sel.id)} title="Выше"
                    className="py-1.5 rounded font-mono text-[9px] glass hover:bg-white/10">↑ ВЫШЕ</button>
                  <button onClick={() => bringToFront(sel.id)} title="Вперёд всех"
                    className="py-1.5 rounded font-mono text-[9px] glass hover:bg-white/10">⇥ ВЕРХ</button>
                </div>
                <p className="font-mono text-[9px] text-gray-600 mt-1">
                  слой {zones.findIndex(z => z.id === sel.id) + 1} из {zones.length}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => duplicateZone(sel)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">
                  <Copy className="w-3 h-3" /> ДУБЛЬ
                </button>
                <button onClick={() => removeZone(sel.id)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg font-mono text-xs hover:bg-red-500/10 text-red-400">
                  <Trash2 className="w-3 h-3" /> УДАЛИТЬ
                </button>
              </div>
              {sel.imgId && (
                <button onClick={() => updateZone(sel.id, { imgId: null })}
                  className="w-full px-2 py-2 rounded-lg font-mono text-xs glass text-gray-400 hover:text-gray-200">
                  УБРАТЬ ФОТО
                </button>
              )}
            </motion.div>
          ) : (
            <div className="glass rounded-xl p-4">
              <p className="font-mono text-[10px] text-gray-600">
                выберите зону кликом — здесь появятся настройки (закругления, размер, фото, слои)
              </p>
            </div>
          )}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={exportPng} disabled={isBusy || zones.length === 0}
            className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'var(--color-primary)', color: '#000' }}>
            <Download className="w-4 h-4" /> {isBusy ? 'ЭКСПОРТ...' : `СКАЧАТЬ PNG (${fmt.w}×${fmt.h})`}
          </motion.button>

          {zones.length > 0 && (
            <button onClick={() => { setZones([]); setSelId(null); }}
              className="w-full py-2 rounded-xl glass text-gray-400 hover:text-gray-200 font-mono text-xs flex items-center justify-center gap-2">
              <X className="w-3.5 h-3.5" /> ОЧИСТИТЬ ВСЕ ЗОНЫ
            </button>
          )}

          <div className="glass rounded-xl p-3">
            <p className="font-mono text-[9px] text-gray-600 leading-relaxed">
              <Maximize2 className="w-3 h-3 inline mr-1" />
              Зоны можно перетаскивать и ресайзить мышью/пальцем. Delete — удалить выбранную. Формы: круг, эллипс, ромб, кастомный полигон.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
