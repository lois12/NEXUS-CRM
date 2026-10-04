import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Square, Circle, Diamond, PenTool, Image as ImageIcon, X, Download,
  Trash2, Copy, Layers, Move, Maximize2,
} from 'lucide-react';
import { showToast } from '../components/ui/NexusModal';

// ── Types ─────────────────────────────────────────────────────
type ShapeType = 'rect' | 'circle' | 'ellipse' | 'diamond' | 'polygon';
type FitMode = 'cover' | 'contain';

interface Pt { x: number; y: number } // normalized 0..1 of canvas

interface Zone {
  id: string;
  type: ShapeType;
  x: number; y: number; w: number; h: number; // normalized bbox
  radius: number;      // 0..50 (% of half min-side) for rect
  fit: FitMode;
  points?: Pt[];       // for polygon (normalized)
  imgId?: string | null;
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

const PRESETS: { id: string; label: string; build: () => Zone[] }[] = [
  {
    id: 'grid2', label: '2×2',
    build: () => {
      const mk = (x: number, y: number): Zone => ({ id: uid(), type: 'rect', x, y, w: 0.49, h: 0.49, radius: 0, fit: 'cover', imgId: null });
      return [mk(0.005, 0.005), mk(0.505, 0.005), mk(0.005, 0.505), mk(0.505, 0.505)];
    },
  },
  {
    id: 'grid3', label: '3×3',
    build: () => {
      const out: Zone[] = [];
      const s = 0.326;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        out.push({ id: uid(), type: 'rect', x: 0.005 + c * 0.331, y: 0.005 + r * 0.331, w: s, h: s, radius: 0, fit: 'cover', imgId: null });
      }
      return out;
    },
  },
  {
    id: 'hero', label: '1+2',
    build: () => [
      { id: uid(), type: 'rect', x: 0.005, y: 0.005, w: 0.6, h: 0.99, radius: 0, fit: 'cover', imgId: null },
      { id: uid(), type: 'rect', x: 0.615, y: 0.005, w: 0.38, h: 0.49, radius: 0, fit: 'cover', imgId: null },
      { id: uid(), type: 'rect', x: 0.615, y: 0.505, w: 0.38, h: 0.49, radius: 0, fit: 'cover', imgId: null },
    ],
  },
  {
    id: 'circles', label: '4 круга',
    build: () => {
      const mk = (x: number, y: number): Zone => ({ id: uid(), type: 'circle', x, y, w: 0.48, h: 0.48, radius: 0, fit: 'cover', imgId: null });
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
    z.points.forEach((p, i) => {
      const px = p.x * W;
      const py = p.y * H;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; zone: Zone; startX: number; startY: number; orig: Zone } | null>(null);

  const fmt = FORMATS[format];
  const sel = zones.find(z => z.id === selId) || null;

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
          id: uid(), type, x: 0, y: 0, w: 1, h: 1, radius: 0, fit: 'cover', imgId: null,
          points: drawPts.map(p => ({ ...p })),
        }
      : {
          id: uid(), type, x: 0.2, y: 0.2, w: 0.5, h: 0.5,
          radius: type === 'rect' ? 0 : 0, fit: 'cover', imgId: null,
        };
    // For polygon compute bbox so move/resize math stays uniform
    if (type === 'polygon' && z.points?.length) {
      const xs = z.points.map(p => p.x);
      const ys = z.points.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      z.x = minX; z.y = minY; z.w = Math.max(maxX - minX, 0.01); z.h = Math.max(maxY - minY, 0.01);
    }
    setZones(prev => [...prev, z]);
    setSelId(z.id);
    setDrawing(false);
    setDrawPts([]);
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
        traceShape(ctx, { id: '', type: 'rect', x: 0, y: 0, w: 1, h: 1, radius: outerRadius, fit: 'cover' }, fmt.w, fmt.h);
        ctx.clip();
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, fmt.w, fmt.h);

      for (const z of zones) {
        ctx.save();
        traceShape(ctx, z, fmt.w, fmt.h);
        ctx.clip();
        const imgItem = z.imgId ? images.find(i => i.id === z.imgId) : null;
        if (imgItem?.img) {
          drawFitted(ctx, imgItem.img, z.x * fmt.w, z.y * fmt.h, z.w * fmt.w, z.h * fmt.h, z.fit);
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Canvas */}
        <div className="lg:col-span-3 space-y-4">
          <div
            ref={canvasRef}
            onClick={drawing ? onCanvasClick : undefined}
            className="relative mx-auto rounded-xl overflow-hidden select-none"
            style={{
              width: '100%',
              maxWidth: 560,
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
              return (
                <div
                  key={z.id}
                  onPointerDown={e => onZonePointerDown(e, z, 'move')}
                  style={{
                    position: 'absolute',
                    left: `${z.x * 100}%`, top: `${z.y * 100}%`,
                    width: `${z.w * 100}%`, height: `${z.h * 100}%`,
                    clipPath: clipPathFor(z),
                    borderRadius: z.type === 'rect' ? `${z.radius}%` : 0,
                    outline: selected ? '2px dashed var(--color-primary)' : '1px dashed rgba(255,255,255,0.25)',
                    outlineOffset: 2,
                    overflow: 'hidden',
                    cursor: 'move',
                    touchAction: 'none',
                    background: imgItem ? 'transparent' : 'rgba(255,255,255,0.05)',
                  }}
                >
                  {imgItem?.img && (
                    <img
                      src={imgItem.preview}
                      alt=""
                      draggable={false}
                      style={{
                        width: '100%', height: '100%',
                        objectFit: z.fit === 'cover' ? 'cover' : 'contain',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {!imgItem && (
                    <div className="w-full h-full flex items-center justify-center pointer-events-none">
                      <ImageIcon className="w-6 h-6 text-gray-600 opacity-40" />
                    </div>
                  )}
                  {/* resize handle */}
                  {selected && (
                    <div
                      onPointerDown={e => onZonePointerDown(e, z, 'resize')}
                      style={{
                        position: 'absolute', right: -6, bottom: -6,
                        width: 14, height: 14, borderRadius: 4,
                        background: 'var(--color-primary)', cursor: 'nwse-resize', touchAction: 'none',
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* polygon drawing overlay */}
            {drawing && drawPts.length > 0 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 50 }}>
                <polyline
                  points={drawPts.map(p => `${p.x * 100}% ${p.y * 100}%`).join(' ')}
                  fill="none" stroke="var(--color-primary)" strokeWidth="2"
                />
                {drawPts.map((p, i) => (
                  <circle key={i} cx={`${p.x * 100}%`} cy={`${p.y * 100}%`} r="5" fill="var(--color-primary)" stroke="#000" strokeWidth="1" />
                ))}
              </svg>
            )}
          </div>

          {drawing && (
            <p className="font-mono text-[10px] text-gray-500 text-center">
              кликайте по канвасу чтобы добавить точки → «ГОТОВО» или Enter чтобы закрыть фигуру
            </p>
          )}

          {/* Photo tray */}
          <div className="glass rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-xs text-gray-500 flex items-center gap-2">
                <Move className="w-3.5 h-3.5" /> ФОТО ({images.length}) — ПЕРЕТАЩИТЕ НА ЗОНУ ИЛИ КЛИКНИТЕ
              </label>
              <button onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg font-mono text-xs glass hover:bg-white/10 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> ДОБАВИТЬ
              </button>
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
              {sel.type === 'rect' && (
                <div>
                  <label className="font-mono text-[10px] text-gray-500 mb-1 block">СКРУГЛЕНИЕ УГЛОВ: {sel.radius}%</label>
                  <input type="range" min={0} max={50} value={sel.radius}
                    onChange={e => updateZone(sel.id, { radius: +e.target.value })}
                    className="w-full accent-[var(--color-primary)]" />
                </div>
              )}
              <div>
                <label className="font-mono text-[10px] text-gray-500 mb-1 block">ЗАЛИВКА ФОТО</label>
                <select value={sel.fit} onChange={e => updateZone(sel.id, { fit: e.target.value as FitMode })}
                  className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                  <option value="cover">Заполнить (cover)</option>
                  <option value="contain">Вместить (contain)</option>
                </select>
              </div>
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
                выберите зону кликом — здесь появятся настройки (закругления, размер, фото)
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
