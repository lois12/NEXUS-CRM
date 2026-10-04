import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Square, PenTool, Image as ImageIcon, X, Download,
  Trash2, Copy, Layers, Move, Maximize2, Minimize2, Type, Pencil,
  ArrowLeft,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { showToast } from '../components/ui/NexusModal';
import CollageLobby from '../components/CollageLobby';
import {
  getProject, saveProject, patchProjectMeta, formatRuDate,
  fileToDataUrl, dataUrlToImage,
} from '../utils/collageStore';

// ── Types ─────────────────────────────────────────────────────
type ShapeType =
  | 'rect' | 'circle' | 'ellipse' | 'polygon' | 'text'
  | 'triangle' | 'star' | 'heart' | 'hexagon' | 'arch' | 'diamond'
  | 'semicircle' | 'cloud' | 'drop' | 'cross' | 'arrowR' | 'arrowU'
  | 'pentagon' | 'octagon' | 'squircle' | 'spark' | 'blob' | 'bolt' | 'flower' | 'chevron';
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
  points?: Pt[];       // for polygon (zone-relative 0..1)
  imgId?: string | null;
  // per-corner rounding (rect) — falls back to `radius` when unset
  corners?: { tl: number; tr: number; br: number; bl: number };
  // photo pan/zoom inside the zone
  imgZoom?: number;    // 1..3
  imgX?: number;       // -1..1 offset (fraction of zone size)
  imgY?: number;
  // border stroke along the shape
  border?: { width: number; color: string }; // width % of half min-side (0..20)
  // text layer
  text?: string;
  fontFamily?: string;
  fontSize?: number;   // fraction of canvas height (0.02..0.2)
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
  align?: TextAlign;
  rotation?: number;   // -45..45 deg
  stroke?: { width: number; color: string }; // text outline (width in em, 0..0.3)
}

interface ImgItem {
  id: string;
  preview: string;
  dataUrl?: string; // for project persistence
  img?: HTMLImageElement;
}

type FormatId =
  | 'a1' | 'a2' | 'a3' | 'a4' | 'a5'
  | 'square' | 'album32' | 'book23' | 'igPost' | 'igStories' | 'vkCover' | 'youtube'
  | 'custom';
type Orientation = 'portrait' | 'landscape';

interface FormatDef {
  w: number;
  h: number;
  label: string;
  group: 'paper' | 'social' | 'custom';
  /** W/H swap allowed via orientation dropdown */
  flippable?: boolean;
  /** locked orientation (when not flippable and not square) */
  locked?: Orientation;
}

/** px sizes @ 150dpi for paper; social sizes are native */
const FORMATS: Record<FormatId, FormatDef> = {
  a1:      { w: 4967, h: 7022, label: 'A1',           group: 'paper',  flippable: true },
  a2:      { w: 3508, h: 4967, label: 'A2',           group: 'paper',  flippable: true },
  a3:      { w: 2480, h: 3508, label: 'A3',           group: 'paper',  flippable: true },
  a4:      { w: 1654, h: 2339, label: 'A4',           group: 'paper',  flippable: true },
  a5:      { w: 1169, h: 1654, label: 'A5',           group: 'paper',  flippable: true },
  square:  { w: 2048, h: 2048, label: 'Квадрат 1:1',  group: 'social' },
  album32: { w: 2048, h: 1365, label: 'Альбом 3:2',   group: 'social', locked: 'landscape' },
  book23:  { w: 1365, h: 2048, label: 'Книга 2:3',    group: 'social', locked: 'portrait' },
  igPost:  { w: 1080, h: 1080, label: 'IG пост',      group: 'social' },
  igStories: { w: 1080, h: 1920, label: 'IG Stories', group: 'social', locked: 'portrait' },
  vkCover: { w: 1200, h: 630,  label: 'VK обложка',   group: 'social', flippable: true },
  youtube: { w: 1280, h: 720,  label: 'YouTube',      group: 'social', flippable: true },
  custom:  { w: 1080, h: 1080, label: 'Кастом',      group: 'custom', flippable: true },
};

const FORMAT_GROUPS: { key: FormatDef['group']; title: string; ids: FormatId[] }[] = [
  { key: 'paper',  title: 'Бумага (A1–A5)', ids: ['a1', 'a2', 'a3', 'a4', 'a5'] },
  { key: 'social', title: 'Соцсети',        ids: ['square', 'album32', 'book23', 'igPost', 'igStories', 'vkCover', 'youtube'] },
  { key: 'custom', title: 'Кастом WxH',     ids: ['custom'] },
];

/** effective canvas size — applies orientation flip */
function resolveSize(id: FormatId, o: Orientation, customW: number, customH: number) {
  if (id === 'custom') {
    const w = Math.max(16, Math.min(8000, Math.round(customW) || 1080));
    const h = Math.max(16, Math.min(8000, Math.round(customH) || 1080));
    return o === 'landscape' ? { w: Math.max(w, h), h: Math.min(w, h) } : { w: Math.min(w, h), h: Math.max(w, h) };
  }
  const d = FORMATS[id];
  if (d.flippable) {
    return o === 'landscape' ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
  }
  return { w: d.w, h: d.h };
}

// ── Pages (multi-page project) ────────────────────────────────
interface CollagePage {
  id: string;
  name: string;
  format: FormatId;
  orient: Orientation;
  customW: number;
  customH: number;
  bgColor: string;
  outerRadius: number;
  zones: Zone[];
  /** per-page undo stack (zone snapshots) */
  history: Zone[][];
  histIdx: number;
}

function createPage(name: string, from?: CollagePage): CollagePage {
  if (from) {
    return {
      ...from,
      id: uid(),
      name,
      zones: from.zones.map(z => ({ ...z, id: uid(), points: z.points?.map(p => ({ ...p })), corners: z.corners ? { ...z.corners } : undefined, border: z.border ? { ...z.border } : undefined, stroke: z.stroke ? { ...z.stroke } : undefined })),
      history: [[]],
      histIdx: 0,
    };
  }
  return {
    id: uid(),
    name,
    format: 'a4',
    orient: 'portrait',
    customW: 1080,
    customH: 1080,
    bgColor: '#0a0a0f',
    outerRadius: 0,
    zones: [],
    history: [[]],
    histIdx: 0,
  };
}

/** snapshot zones into the page undo stack */
function withHistory(p: CollagePage, zones: Zone[]): CollagePage {
  const history = [...p.history.slice(0, p.histIdx + 1), zones.map(z => ({ ...z }))];
  return { ...p, zones, history, histIdx: history.length - 1 };
}

/** ISO paper size in PDF points (portrait base) */
const PAPER_PT: Partial<Record<FormatId, { w: number; h: number }>> = {
  a1: { w: 1684, h: 2384 },
  a2: { w: 1191, h: 1684 },
  a3: { w: 842, h: 1191 },
  a4: { w: 595, h: 842 },
  a5: { w: 420, h: 595 },
};

/** page size in PDF points (orientation-aware) */
function resolvePt(p: Pick<CollagePage, 'format' | 'orient' | 'customW' | 'customH'>) {
  const paper = PAPER_PT[p.format];
  if (paper) {
    return p.orient === 'landscape' ? { w: paper.h, h: paper.w } : { w: paper.w, h: paper.h };
  }
  const sz = resolveSize(p.format, p.orient, p.customW, p.customH);
  // social/custom px @ 150dpi → pt
  return { w: sz.w * 72 / 150, h: sz.h * 72 / 150 };
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas → PNG failed')), 'image/png');
  });
}

/** Render a page (any format/zones) to an offscreen canvas at `scale` */
function renderPageToCanvas(
  p: Pick<CollagePage, 'format' | 'orient' | 'customW' | 'customH' | 'bgColor' | 'outerRadius' | 'zones'>,
  images: ImgItem[],
  scale: number,
): HTMLCanvasElement {
  const sz = resolveSize(p.format, p.orient, p.customW, p.customH);
  const W = sz.w * scale;
  const H = sz.h * scale;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // background with optional outer radius clip
  if (p.outerRadius > 0) {
    traceShape(ctx, { id: '', type: 'rect', x: 0, y: 0, w: 1, h: 1, radius: p.outerRadius, imgRadius: 0, fit: 'cover' }, W, H);
    ctx.clip();
  }
  ctx.fillStyle = p.bgColor;
  ctx.fillRect(0, 0, W, H);

  for (const z of p.zones) {
    ctx.save();
    if (z.type === 'text') {
      const px = (z.fontSize || 0.06) * sz.h * scale;
      const family = z.fontFamily || 'Montserrat';
      ctx.font = `${z.fontWeight === 'bold' ? '700' : '400'} ${px}px "${family}", sans-serif`;
      ctx.textBaseline = 'top';
      const maxW = z.w * sz.w * scale;
      const lines = wrapText(ctx, z.text || '', maxW);
      const align = z.align || 'left';
      ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
      const baseX = z.x * sz.w * scale + (align === 'center' ? maxW / 2 : align === 'right' ? maxW : 0);
      const baseY = z.y * sz.h * scale;

      const cx = z.x * sz.w * scale + (z.w * sz.w * scale) / 2;
      const cy = z.y * sz.h * scale + (z.h * sz.h * scale) / 2;
      ctx.translate(cx, cy);
      ctx.rotate(((z.rotation || 0) * Math.PI) / 180);
      ctx.translate(-cx, -cy);

      const strokeCfg = z.stroke;
      if (strokeCfg && strokeCfg.width > 0) {
        lines.forEach((line, li) => {
          ctx.lineJoin = 'round';
          ctx.lineWidth = strokeCfg.width * px * 2;
          ctx.strokeStyle = strokeCfg.color;
          ctx.strokeText(line, baseX, baseY + li * px * 1.15);
        });
      }
      lines.forEach((line, li) => {
        ctx.fillStyle = z.fontColor || '#ffffff';
        ctx.fillText(line, baseX, baseY + li * px * 1.15);
      });
      ctx.restore();
      continue;
    }
    // Shape zone: clip to shape, then to image-round rect, then draw
    traceShape(ctx, z, sz.w * scale, sz.h * scale);
    ctx.clip();
    const imgItem = z.imgId ? images.find(i => i.id === z.imgId) : null;
    if (imgItem?.img) {
      ctx.save();
      if (z.imgRadius > 0) {
        traceImgRound(ctx, z, sz.w * scale, sz.h * scale);
        ctx.clip();
      }
      const zx = z.x * sz.w * scale;
      const zy = z.y * sz.h * scale;
      const zw = z.w * sz.w * scale;
      const zh = z.h * sz.h * scale;
      ctx.translate(zx + zw / 2, zy + zh / 2);
      ctx.scale(z.imgZoom || 1, z.imgZoom || 1);
      ctx.translate((z.imgX || 0) * zw * 0.3, (z.imgY || 0) * zh * 0.3);
      ctx.translate(-(zx + zw / 2), -(zy + zh / 2));
      drawFitted(ctx, imgItem.img, zx, zy, zw, zh, z.fit);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
    }
    ctx.restore();

    // border stroke along the shape (outside the clip)
    if (z.border && z.border.width > 0) {
      ctx.save();
      traceShape(ctx, z, sz.w * scale, sz.h * scale);
      ctx.strokeStyle = z.border.color;
      ctx.lineWidth = (z.border.width / 100) * Math.min(sz.w, sz.h) * scale / 2;
      ctx.stroke();
      ctx.restore();
    }
  }
  return canvas;
}

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

/** sample a closed parametric curve t∈[0,1) into polygon points */
function sampleCurve(fn: (t: number) => Pt, n = 48): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) pts.push(fn(i / n));
  return pts;
}

function regularPoly(n: number, rot = -Math.PI / 2, r = 0.5): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + rot;
    pts.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) });
  }
  return pts;
}

function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return pts;
}

/** Unit-shape polygon points (0..1 inside the zone bbox) for decorative shapes */
function shapePoints(type: ShapeType): Pt[] {
  switch (type) {
    case 'triangle':
      return [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    case 'diamond':
      return [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }];
    case 'hexagon':
      return regularPoly(6, -Math.PI / 2);
    case 'pentagon':
      return regularPoly(5, -Math.PI / 2);
    case 'octagon':
      return regularPoly(8, -Math.PI / 8);
    case 'star': {
      const pts: Pt[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.22;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) });
      }
      return pts;
    }
    case 'heart': {
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = (i / 24) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        pts.push({ x: 0.5 + hx / 36, y: 0.5 + hy / 34 });
      }
      return pts;
    }
    case 'arch': {
      // rounded-top "window" shape
      const pts: Pt[] = [{ x: 0, y: 1 }, { x: 0, y: 0.5 }];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (Math.PI * i) / 16; // π → 2π (top arc)
        pts.push({ x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) });
      }
      pts.push({ x: 1, y: 1 });
      return pts;
    }
    case 'semicircle': {
      // flat bottom, dome top
      const pts: Pt[] = [];
      for (let i = 0; i <= 32; i++) {
        const t = (i / 32) * Math.PI;
        pts.push({ x: 0.5 + 0.5 * Math.cos(t), y: 1 - Math.sin(t) });
      }
      return pts;
    }
    case 'cloud': {
      // cartoon cloud: flat-ish bottom + three lobes
      return [
        { x: 0.1, y: 0.82 },
        { x: 0.9, y: 0.82 },
        ...arcPts(0.72, 0.58, 0.2, 0.26, 0, -Math.PI, 12),
        ...arcPts(0.5, 0.42, 0.26, 0.3, 0, -Math.PI, 14),
        ...arcPts(0.28, 0.58, 0.2, 0.26, 0, -Math.PI, 12),
      ];
    }
    case 'drop': {
      // teardrop: tip at top, round bulb at bottom
      return [
        { x: 0.5, y: 0.02 },
        { x: 0.62, y: 0.18 },
        { x: 0.78, y: 0.4 },
        ...arcPts(0.5, 0.62, 0.32, 0.36, 0.2, Math.PI - 0.2, 18),
        { x: 0.22, y: 0.4 },
        { x: 0.38, y: 0.18 },
      ];
    }
    case 'cross':
      return [
        { x: 0.35, y: 0 }, { x: 0.65, y: 0 }, { x: 0.65, y: 0.35 },
        { x: 1, y: 0.35 }, { x: 1, y: 0.65 }, { x: 0.65, y: 0.65 },
        { x: 0.65, y: 1 }, { x: 0.35, y: 1 }, { x: 0.35, y: 0.65 },
        { x: 0, y: 0.65 }, { x: 0, y: 0.35 }, { x: 0.35, y: 0.35 },
      ];
    case 'arrowR':
      return [
        { x: 0, y: 0.32 }, { x: 0.58, y: 0.32 }, { x: 0.58, y: 0.08 },
        { x: 1, y: 0.5 }, { x: 0.58, y: 0.92 }, { x: 0.58, y: 0.68 }, { x: 0, y: 0.68 },
      ];
    case 'arrowU':
      return [
        { x: 0.32, y: 1 }, { x: 0.32, y: 0.42 }, { x: 0.08, y: 0.42 },
        { x: 0.5, y: 0 }, { x: 0.92, y: 0.42 }, { x: 0.68, y: 0.42 }, { x: 0.68, y: 1 },
      ];
    case 'chevron':
      return [
        { x: 0.05, y: 0.12 }, { x: 0.5, y: 0.5 }, { x: 0.05, y: 0.88 },
        { x: 0.32, y: 0.88 }, { x: 0.78, y: 0.5 }, { x: 0.32, y: 0.12 },
      ];
    case 'squircle': {
      // superellipse |x|^4 + |y|^4 = 1 (iOS-style continuous corner)
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        const e = 0.5; // 2/n with n=4
        return {
          x: 0.5 + 0.5 * Math.sign(c) * Math.pow(Math.abs(c), e),
          y: 0.5 + 0.5 * Math.sign(s) * Math.pow(Math.abs(s), e),
        };
      }, 64);
    }
    case 'spark': {
      // 4-point sparkle with concave sides
      return sampleCurve(t => {
        const a = t * Math.PI * 2 - Math.PI / 2;
        // sharp at axes, pinched between
        const lobe = Math.pow(Math.abs(Math.cos(2 * a)), 0.35);
        const r = 0.08 + 0.42 * lobe;
        return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
      }, 64);
    }
    case 'blob': {
      // organic pebble
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const r = 0.4 + 0.08 * Math.sin(3 * a) + 0.05 * Math.cos(5 * a) + 0.03 * Math.sin(7 * a);
        return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
      }, 56);
    }
    case 'bolt':
      // lightning
      return [
        { x: 0.58, y: 0 }, { x: 0.22, y: 0.52 }, { x: 0.44, y: 0.52 },
        { x: 0.32, y: 1 }, { x: 0.82, y: 0.42 }, { x: 0.56, y: 0.42 }, { x: 0.78, y: 0 },
      ];
    case 'flower': {
      // 6-petal rosette
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const r = 0.22 + 0.28 * Math.abs(Math.cos(3 * a));
        return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
      }, 72);
    }
    case 'polygon':
      return []; // uses z.points
    default:
      return [];
  }
}

function isPolyShape(t: ShapeType): boolean {
  return t !== 'rect' && t !== 'circle' && t !== 'ellipse' && t !== 'text';
}

/** CSS clip-path for non-rect shapes (preview) */
function clipPathFor(z: Zone): string | undefined {
  if (z.type === 'circle') return 'circle(50% at 50% 50%)';
  if (z.type === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  const pts = z.type === 'polygon' ? z.points : shapePoints(z.type);
  if (pts?.length) {
    return `polygon(${pts.map(p => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`).join(', ')})`;
  }
  return undefined;
}

function borderRadii(z: Zone): string {
  if (z.type !== 'rect') return '0';
  const c = z.corners;
  if (!c) return `${z.radius}%`;
  return `${c.tl}% ${c.tr}% ${c.br}% ${c.bl}%`;
}

/** Trace shape onto a canvas ctx as a clip path (normalized coords × W/H) */
function traceShape(ctx: CanvasRenderingContext2D, z: Zone, W: number, H: number) {
  const x = z.x * W;
  const y = z.y * H;
  const w = z.w * W;
  const h = z.h * H;
  ctx.beginPath();
  if (z.type === 'rect') {
    // per-corner radius via arcTo chain
    const c = z.corners || { tl: z.radius, tr: z.radius, br: z.radius, bl: z.radius };
    const half = Math.min(w, h) / 2 / 100;
    const rTL = c.tl * half, rTR = c.tr * half, rBR = c.br * half, rBL = c.bl * half;
    if ((rTL + rTR) > w) { /* clamp handled by arcTo naturally */ }
    ctx.moveTo(x + rTL, y);
    ctx.lineTo(x + w - rTR, y);
    if (rTR > 0) ctx.arcTo(x + w, y, x + w, y + rTR, rTR); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - rBR);
    if (rBR > 0) ctx.arcTo(x + w, y + h, x + w - rBR, y + h, rBR); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + rBL, y + h);
    if (rBL > 0) ctx.arcTo(x, y + h, x, y + h - rBL, rBL); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + rTL);
    if (rTL > 0) ctx.arcTo(x, y, x + rTL, y, rTL); else ctx.lineTo(x, y);
    ctx.closePath();
  } else if (z.type === 'circle' || z.type === 'ellipse') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else {
    const pts = z.type === 'polygon' ? z.points : shapePoints(z.type);
    if (pts?.length) {
      pts.forEach((p, i) => {
        const px = (z.x + p.x * z.w) * W;
        const py = (z.y + p.y * z.h) * H;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
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

  // Quality fix: single-step downscale of a 4000px photo to ~500px aliases hard.
  // Halve progressively through intermediate canvases (mip-mapping by hand),
  // then do the final draw with high smoothing.
  let source: CanvasImageSource = img;
  let sw = img.width;
  let sh = img.height;
  if (scale < 0.5 && sw > 256 && sh > 256) {
    let cur: HTMLCanvasElement | null = null;
    while (sw * 0.5 > dw && sh * 0.5 > dh) {
      const next = document.createElement('canvas');
      next.width = Math.max(1, Math.round(sw / 2));
      next.height = Math.max(1, Math.round(sh / 2));
      const nctx = next.getContext('2d');
      if (!nctx) break;
      nctx.imageSmoothingEnabled = true;
      nctx.imageSmoothingQuality = 'high';
      nctx.drawImage(source, 0, 0, next.width, next.height);
      source = next;
      sw = next.width;
      sh = next.height;
      cur = next;
    }
    void cur;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
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


/** Mini page preview for the page navigator / sheet */
function PageThumb({ page: p, images, height }: { page: CollagePage; images: ImgItem[]; height: number }) {
  const sz = resolveSize(p.format, p.orient, p.customW, p.customH);
  const w = Math.max(40, Math.round(height * sz.w / sz.h));
  return (
    <div
      style={{
        background: p.bgColor,
        width: '100%',
        height,
        maxWidth: w,
        margin: '0 auto',
        borderRadius: Math.min(8, (p.outerRadius / 100) * 8),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {p.zones.map(z => {
        const imgItem = z.imgId ? images.find(im => im.id === z.imgId) : null;
        return (
          <div key={z.id} style={{
            position: 'absolute',
            left: `${z.x * 100}%`, top: `${z.y * 100}%`,
            width: `${Math.min(z.w, 1) * 100}%`, height: `${Math.min(z.h, 1) * 100}%`,
            background: imgItem ? `url(${imgItem.preview}) center/cover no-repeat` : (z.type === 'text' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'),
            borderRadius: z.type === 'circle' || z.type === 'ellipse' ? '50%' : 1,
            clipPath: z.type === 'text' ? undefined : clipPathFor(z),
          }} />
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────
function CollageEditor({ projectId, onExit }: { projectId: string; onExit: () => void }) {
  const [pages, setPages] = useState<CollagePage[]>(() => [createPage('Страница 1')]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [orientMenuOpen, setOrientMenuOpen] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [images, setImages] = useState<ImgItem[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawPts, setDrawPts] = useState<Pt[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [exportScale, setExportScale] = useState<1 | 2>(2);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageDragIdx, setPageDragIdx] = useState<number | null>(null);
  const [pagesSheetOpen, setPagesSheetOpen] = useState(false);
  /** zone id in "adjust photo inside" mode (drag = pan photo, not move zone) */
  const [photoEditId, setPhotoEditId] = useState<string | null>(null);
  const [projectMeta, setProjectMeta] = useState<{ name: string; description: string; updatedAt: number } | null>(null);
  const [metaDraft, setMetaDraft] = useState<{ name: string; description: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // alignment guides shown while dragging (snap to center/edges)
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize' | 'photo-pan'; zone: Zone; startX: number; startY: number; orig: Zone } | null>(null);

  // load project from IndexedDB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getProject(projectId);
        if (cancelled) return;
        if (!p) {
          showToast('Проект не найден', 'error');
          onExit();
          return;
        }
        const parsed = JSON.parse(p.pagesJson) as CollagePage[];
        const restored = parsed.map(pg => ({
          ...pg,
          history: [pg.zones.map(z => ({ ...z }))],
          histIdx: 0,
        }));
        const imgs: ImgItem[] = [];
        for (const s of p.images) {
          try {
            const img = await dataUrlToImage(s.dataUrl);
            imgs.push({ id: s.id, preview: s.dataUrl, dataUrl: s.dataUrl, img });
          } catch { /* skip broken */ }
        }
        if (cancelled) return;
        setPages(restored.length ? restored : [createPage('Страница 1')]);
        setActiveIdx(0);
        setImages(imgs);
        setProjectMeta({ name: p.name, description: p.description, updatedAt: p.updatedAt });
      } catch {
        showToast('Ошибка загрузки проекта', 'error');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, onExit]);

  // debounced autosave
  useEffect(() => {
    if (!loaded || !projectMeta) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveProject({
          id: projectId,
          name: projectMeta.name,
          description: projectMeta.description,
          updatedAt: Date.now(),
          pageCount: pages.length,
          pagesJson: JSON.stringify(pages.map(({ history: _h, histIdx: _i, ...rest }) => rest)),
          images: images.filter(i => i.dataUrl).map(i => ({ id: i.id, dataUrl: i.dataUrl! })),
        });
        setProjectMeta(m => m ? { ...m, updatedAt: Date.now() } : m);
      } catch {
        /* silent — next change retries */
      }
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, images, loaded, projectId]);

  const page = pages[Math.min(activeIdx, pages.length - 1)] ?? pages[0];
  const {
    format, orient, customW, customH, bgColor, outerRadius,
    zones, history, histIdx,
  } = page;

  const fmt = resolveSize(format, orient, customW, customH);
  const fmtDef = FORMATS[format];
  const canFlip = !!fmtDef.flippable;
  const sel = zones.find(z => z.id === selId) || null;

  // ── page-aware updaters ─────────────────────────────────────
  const patchPage = (id: string, patch: Partial<CollagePage>) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  };

  /** replace zones on the active page; commit=true pushes undo snapshot */
  const setZones = (updater: Zone[] | ((prev: Zone[]) => Zone[]), commit = false) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== activeIdx) return p;
      const next = typeof updater === 'function' ? updater(p.zones) : updater;
      return commit ? withHistory(p, next) : { ...p, zones: next };
    }));
  };

  // snapshot zones into history (call after every committed change)
  const commitHistory = (next: Zone[]) => {
    setPages(prev => prev.map((p, i) => i === activeIdx ? withHistory(p, next) : p));
  };

  const setFormat = (f: FormatId) => patchPage(page.id, { format: f });
  const setOrient = (o: Orientation) => patchPage(page.id, { orient: o });
  const setCustomW = (v: number) => patchPage(page.id, { customW: v, format: 'custom' });
  const setCustomH = (v: number) => patchPage(page.id, { customH: v, format: 'custom' });
  const setBgColor = (v: string) => patchPage(page.id, { bgColor: v });
  const setOuterRadius = (v: number) => patchPage(page.id, { outerRadius: v });

  const switchPage = (idx: number) => {
    if (idx === activeIdx) return;
    setActiveIdx(idx);
    setSelId(null);
    setDrawing(false);
    setDrawPts([]);
  };

  const addPage = (duplicate = false) => {
    const name = `Страница ${pages.length + 1}`;
    const np = duplicate
      ? createPage(name, page)
      : {
          ...createPage(name),
          format: page.format,
          orient: page.orient,
          customW: page.customW,
          customH: page.customH,
          bgColor: page.bgColor,
          outerRadius: page.outerRadius,
        };
    setPages(prev => [...prev, np]);
    setActiveIdx(pages.length);
    setSelId(null);
    setDrawing(false);
    setDrawPts([]);
  };

  const removePage = (idx: number) => {
    if (pages.length <= 1) { showToast('Нельзя удалить последнюю страницу', 'error'); return; }
    setPages(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(i => {
      if (idx > i) return i;
      if (idx < i) return i - 1;
      return Math.min(i, pages.length - 2);
    });
    setSelId(null);
  };

  const renamePage = (id: string, name: string) => {
    patchPage(id, { name: name.trim() || 'Страница' });
    setEditingPageId(null);
  };

  const movePage = (from: number, to: number) => {
    if (from === to) return;
    setPages(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setActiveIdx(cur => {
      if (cur === from) return to;
      if (from < cur && to >= cur) return cur - 1;
      if (from > cur && to <= cur) return cur + 1;
      return cur;
    });
  };

  const undo = () => {
    if (histIdx <= 0) return;
    const snap = history[histIdx - 1];
    setPages(prev => prev.map((p, i) => i === activeIdx
      ? { ...p, zones: snap.map(z => ({ ...z })), histIdx: histIdx - 1 }
      : p));
    if (selId && !snap.some(z => z.id === selId)) setSelId(null);
  };
  const redo = () => {
    if (histIdx >= history.length - 1) return;
    const snap = history[histIdx + 1];
    setPages(prev => prev.map((p, i) => i === activeIdx
      ? { ...p, zones: snap.map(z => ({ ...z })), histIdx: histIdx + 1 }
      : p));
    if (selId && !snap.some(z => z.id === selId)) setSelId(null);
  };

  useEffect(() => {
    const h = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const addImage = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    const newItems: ImgItem[] = [];
    for (const f of arr) {
      const dataUrl = await fileToDataUrl(f);
      const img = new Image();
      await new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); img.src = dataUrl; });
      newItems.push({ id: uid(), preview: dataUrl, dataUrl, img });
    }
    setImages(prev => [...prev, ...newItems]);
  }, []);

  const updateZone = (id: string, patch: Partial<Zone>, commit = true) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z), commit);
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
    setZones(prev => [...prev, z], true);
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
    setZones(prev => [...prev, z], true);
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
    }, true);
  };
  const sendBackward = (id: string) => {
    setZones(prev => {
      const i = prev.findIndex(z => z.id === id);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i], next[i - 1]] = [next[i - 1], next[i]];
      return next;
    }, true);
  };
  const bringToFront = (id: string) => {
    setZones(prev => {
      const z = prev.find(x => x.id === id);
      if (!z) return prev;
      return [...prev.filter(x => x.id !== id), z];
    }, true);
  };
  const sendToBack = (id: string) => {
    setZones(prev => {
      const z = prev.find(x => x.id === id);
      if (!z) return prev;
      return [z, ...prev.filter(x => x.id !== id)];
    }, true);
  };

  const removeZone = (id: string) => {
    setZones(prev => prev.filter(z => z.id !== id), true);
    if (selId === id) setSelId(null);
  };

  const duplicateZone = (z: Zone) => {
    const copy: Zone = { ...z, id: uid(), x: clamp(z.x + 0.02, 0, 1 - z.w), y: clamp(z.y + 0.02, 0, 1 - z.h), points: z.points?.map(p => ({ ...p })) };
    setZones(prev => [...prev, copy], true);
    setSelId(copy.id);
  };

  // ── Pointer interaction (move / resize / photo-pan) — works with touch
  const onZonePointerDown = (e: React.PointerEvent, z: Zone, mode: 'move' | 'resize' | 'photo-pan') => {
    if (drawing) return;
    e.stopPropagation();
    setSelId(z.id);
    // Shift+drag or photo-adjust mode → pan the photo inside the zone
    if (mode === 'move' && z.imgId && (photoEditId === z.id || e.shiftKey)) {
      mode = 'photo-pan';
    }
    if (mode === 'photo-pan' && !z.imgId) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, zone: z, startX: e.clientX, startY: e.clientY, orig: { ...z } };
  };

  const onZonePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    if (d.mode === 'photo-pan') {
      // keep image under the finger: CSS `scale(s) translate(t%)` moves by s*t
      const zoom = d.orig.imgZoom || 1;
      const imgX = clamp((d.orig.imgX || 0) + dx / (zoom * 0.3 * Math.max(d.orig.w, 0.05)), -1, 1);
      const imgY = clamp((d.orig.imgY || 0) + dy / (zoom * 0.3 * Math.max(d.orig.h, 0.05)), -1, 1);
      updateZone(d.zone.id, { imgX, imgY }, false);
      return;
    }
    if (d.mode === 'move') {
      let nx = clamp(d.orig.x + dx, -d.orig.w + 0.02, 0.98);
      let ny = clamp(d.orig.y + dy, -d.orig.h + 0.02, 0.98);
      // snap to center / edges — show alignment guides
      const SNAP = 0.015;
      const cx = nx + d.orig.w / 2;
      const cy = ny + d.orig.h / 2;
      let gv: number | null = null;
      let gh: number | null = null;
      if (Math.abs(cx - 0.5) < SNAP) { nx = 0.5 - d.orig.w / 2; gv = 50; }
      else if (Math.abs(nx) < SNAP) { nx = 0; gv = 0; }
      else if (Math.abs(nx + d.orig.w - 1) < SNAP) { nx = 1 - d.orig.w; gv = 100; }
      if (Math.abs(cy - 0.5) < SNAP) { ny = 0.5 - d.orig.h / 2; gh = 50; }
      else if (Math.abs(ny) < SNAP) { ny = 0; gh = 0; }
      else if (Math.abs(ny + d.orig.h - 1) < SNAP) { ny = 1 - d.orig.h; gh = 100; }
      setGuides({ v: gv, h: gh });
      updateZone(d.zone.id, { x: nx, y: ny }, false);
    } else {
      updateZone(d.zone.id, {
        w: clamp(d.orig.w + dx, 0.05, 1.5),
        h: clamp(d.orig.h + dy, 0.05, 1.5),
      }, false);
    }
  };

  const onZonePointerUp = () => {
    // commit one undo step for the whole drag
    if (dragRef.current) {
      const z = zones.find(x => x.id === dragRef.current!.zone.id);
      if (z) commitHistory(zones);
    }
    dragRef.current = null;
    setGuides({ v: null, h: null });
  };

  /** zoom photo inside a zone (wheel / buttons). factor > 1 = zoom in */
  const zoomPhoto = (id: string, factor: number, commit = true) => {
    const z = zones.find(x => x.id === id);
    if (!z?.imgId) return;
    const zoom = clamp((z.imgZoom || 1) * factor, 1, 5);
    updateZone(id, { imgZoom: zoom }, commit);
  };

  // wheel = zoom photo under cursor (native listener so we can preventDefault)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      const node = (e.target as HTMLElement)?.closest('[data-zone-id]') as HTMLElement | null;
      const zid = node?.dataset.zoneId;
      if (!zid) return;
      const z = zones.find(x => x.id === zid);
      if (!z?.imgId) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      zoomPhoto(zid, factor, false);
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        const zz = zones.find(x => x.id === zid);
        if (zz) commitHistory(zones);
      }, 200);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, images]);

  // Esc exits photo-adjust mode
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && photoEditId) setPhotoEditId(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [photoEditId]);

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
      const canvas = renderPageToCanvas(page, images, exportScale);
      const blob = await canvasToPngBlob(canvas);
      downloadBlob(blob, `collage_${Date.now()}.png`);
      showToast('Коллаж сохранён', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const exportZip = async () => {
    const withContent = pages.filter(p => p.zones.length > 0);
    if (withContent.length === 0) { showToast('Нет страниц с зонами', 'error'); return; }
    setIsBusy(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const canvas = renderPageToCanvas(p, images, exportScale);
        const blob = await canvasToPngBlob(canvas);
        zip.file(`page_${String(i + 1).padStart(2, '0')}_${p.name.replace(/[^\wа-яё-]+/gi, '_')}.png`, blob);
      }
      const out = await zip.generateAsync({ type: 'blob' });
      downloadBlob(out, `collage_pages_${Date.now()}.zip`);
      showToast(`ZIP: ${pages.length} стр.`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка ZIP', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const exportPdf = async (scope: 'current' | 'all') => {
    const list = scope === 'all' ? pages : [page];
    const withContent = list.filter(p => p.zones.length > 0);
    if (withContent.length === 0) { showToast('Нет страниц с зонами', 'error'); return; }
    setIsBusy(true);
    try {
      const pdf = await PDFDocument.create();
      // 2x for print quality, but cap huge paper at 1x to avoid canvas limits
      const useScale: 1 | 2 = list.some(p => {
        const sz = resolveSize(p.format, p.orient, p.customW, p.customH);
        return sz.w * 2 * sz.h * 2 > 40_000_000; // ~40MP
      }) ? 1 : exportScale;

      for (const p of list) {
        const canvas = renderPageToCanvas(p, images, useScale);
        const png = await canvasToPngBlob(canvas);
        const bytes = new Uint8Array(await png.arrayBuffer());
        const img = await pdf.embedPng(bytes);
        const pt = resolvePt(p);
        const pg = pdf.addPage([pt.w, pt.h]);
        pg.drawImage(img, { x: 0, y: 0, width: pt.w, height: pt.h });
      }
      const out = await pdf.save();
      downloadBlob(new Blob([out as unknown as BlobPart], { type: 'application/pdf' }),
        `collage_${scope === 'all' ? 'all_pages' : 'page'}.pdf`);
      showToast(scope === 'all' ? `PDF: ${list.length} стр.` : 'PDF сохранён', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка PDF', 'error');
    } finally {
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onExit}
              className="px-2.5 py-1.5 rounded-lg font-mono text-xs glass hover:bg-white/10 flex items-center gap-1"
              title="К списку проектов"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> ПРОЕКТЫ
            </button>
            <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3 min-w-0" style={{ color: 'var(--color-primary)' }}>
              <Layers className="w-7 h-7 shrink-0" />
              <span className="truncate">{projectMeta?.name || 'КОЛЛАЖ'}</span>
            </h1>
            <button
              onClick={() => setMetaDraft({
                name: projectMeta?.name || '',
                description: projectMeta?.description || '',
              })}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-200"
              title="Имя / описание проекта"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
          {projectMeta?.description && (
            <p className="text-gray-400 mt-1 font-mono text-xs">{projectMeta.description}</p>
          )}
          <p className="text-gray-500 mt-0.5 font-mono text-[10px]">
            {projectMeta ? `изм. ${formatRuDate(projectMeta.updatedAt)}` : ''} · ФИГУРЫ, ФОТО, СТРАНИЦЫ, PDF/ZIP
          </p>
        </div>
      </div>

      {/* project meta editor */}
      {metaDraft && projectMeta && (
        <div className="glass rounded-xl p-4 space-y-3">
          <label className="font-mono text-xs text-gray-500 block">ПРОЕКТ</label>
          <div>
            <label className="font-mono text-[10px] text-gray-500 mb-1 block">ИМЯ</label>
            <input
              value={metaDraft.name}
              onChange={e => setMetaDraft(d => d ? { ...d, name: e.target.value } : d)}
              className="w-full px-2 py-2 rounded font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] text-gray-500 mb-1 block">ОПИСАНИЕ</label>
            <textarea
              value={metaDraft.description}
              onChange={e => setMetaDraft(d => d ? { ...d, description: e.target.value } : d)}
              rows={3}
              className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMetaDraft(null)}
              className="flex-1 py-2 rounded-lg font-mono text-xs glass text-gray-400">ОТМЕНА</button>
            <button
              onClick={async () => {
                const name = metaDraft.name.trim() || projectMeta.name;
                const description = metaDraft.description.trim();
                try {
                  await patchProjectMeta(projectId, { name, description });
                  setProjectMeta({ name, description, updatedAt: Date.now() });
                  setMetaDraft(null);
                  showToast('Сохранено', 'success');
                } catch {
                  showToast('Ошибка', 'error');
                }
              }}
              className="flex-1 py-2 rounded-lg font-mono text-xs font-bold"
              style={{ background: 'var(--color-primary)', color: '#000' }}
            >
              СОХРАНИТЬ
            </button>
          </div>
        </div>
      )}

      {/* Toolbar — z above page strip (.glass creates stacking contexts via backdrop-filter) */}
      <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-2 relative z-50">
        <span className="font-mono text-[10px] text-gray-500">ЗОНА:</span>
        {/* Undo / Redo arrows */}
        <button onClick={undo} disabled={histIdx <= 0}
          className="px-2.5 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 disabled:opacity-30"
          title="Отменить (назад)">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h13a4 4 0 0 1 0 8h-3" /><path d="M7 6l-4 4 4 4" /></svg>
        </button>
        <button onClick={redo} disabled={histIdx >= history.length - 1}
          className="px-2.5 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 disabled:opacity-30"
          title="Вернуть (вперёд)">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H8a4 4 0 0 0 0 8h3" /><path d="M17 6l4 4-4 4" /></svg>
        </button>

        <div className="relative">
          <button onClick={() => setShapeMenuOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all"
            title="Добавить фигуру">
            <Square className="w-3.5 h-3.5" /> ▾
          </button>
          {shapeMenuOpen && (
            <div className="absolute left-0 top-full mt-1 z-[999] p-2 rounded-xl"
              style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 280, maxHeight: 360, overflowY: 'auto' }}>
              <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">Фигуры</div>
              <div className="grid grid-cols-4 gap-1">
                {([
                  ['rect', 'Прямоугольник', 'M4 4h16v16H4z'],
                  ['circle', 'Круг', 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z'],
                  ['ellipse', 'Эллипс', 'M12 5c4.4 0 8 2.7 8 6s-3.6 6-8 6-8-2.7-8-6 3.6-6 8-6z'],
                  ['squircle', 'Скруглённый квадрат', 'M7 4h10c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3z'],
                  ['diamond', 'Ромб', 'M12 3l9 9-9 9-9-9z'],
                  ['triangle', 'Треугольник', 'M12 4l9 16H3z'],
                  ['pentagon', 'Пятиугольник', 'M12 3l9 6.5-3.4 10.5H6.4L3 9.5z'],
                  ['hexagon', 'Шестиугольник', 'M12 3l8 4.5v9L12 21l-8-4.5v-9z'],
                  ['octagon', 'Восьмиугольник', 'M8 3h8l5 5v8l-5 5H8l-5-5V8z'],
                  ['semicircle', 'Полукруг', 'M3 17a9 9 0 0 1 18 0z'],
                  ['arch', 'Арка', 'M4 20v-8a8 8 0 0 1 16 0v8z'],
                  ['star', 'Звезда', 'M12 3l2.2 6.2 6.8.2-5.3 4.3 1.9 6.5-5.6-3.8-5.6 3.8 1.9-6.5L3 9.4l6.8-.2z'],
                  ['spark', 'Искра', 'M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z'],
                  ['heart', 'Сердце', 'M12 20s-8-4.7-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.3-8 10-8 10z'],
                  ['flower', 'Цветок', 'M12 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm0-6a3 3 0 0 1 2 5.2A3 3 0 0 1 18 9a3 3 0 0 1-1 5.8A3 3 0 0 1 12 20a3 3 0 0 1-5-5.2A3 3 0 0 1 6 9a3 3 0 0 1 4-3z'],
                  ['cloud', 'Облако', 'M6 18h11a4 4 0 0 0 .5-8 6 6 0 0 0-11.2 2A3.5 3.5 0 0 0 6 18z'],
                  ['drop', 'Капля', 'M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z'],
                  ['blob', 'Пятно', 'M12 3c4 0 8 2.5 8 7.5S17 21 10 21 3 16 4 10 8 3 12 3z'],
                  ['cross', 'Крест', 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'],
                  ['bolt', 'Молния', 'M13 2L5 14h6l-2 8 10-14h-6z'],
                  ['arrowR', 'Стрелка →', 'M3 8h12V5l6 6-6 6v-3H3z'],
                  ['arrowU', 'Стрелка ↑', 'M8 21V9H5l7-8 7 8h-3v12z'],
                  ['chevron', 'Шеврон', 'M5 4l8 8-8 8 3 3 11-11L8 1z'],
                ] as const).map(([t, label, d]) => (
                  <button key={t} onClick={() => { addShape(t); setShapeMenuOpen(false); }}
                    className="p-2 rounded-lg hover:bg-white/10 flex flex-col items-center justify-center gap-0.5"
                    title={label}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" strokeLinejoin="round"><path d={d} /></svg>
                    <span className="font-mono text-[7px] text-gray-500 leading-tight text-center">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
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
        <div className="relative">
          <button onClick={() => { setFormatMenuOpen(v => !v); setOrientMenuOpen(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all"
            title="Формат холста">
            {fmtDef.label} {fmt.w}×{fmt.h} ▾
          </button>
          {formatMenuOpen && (
            <div className="absolute left-0 top-full mt-1 z-[999] p-2 rounded-xl space-y-2"
              style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 280 }}>
              {FORMAT_GROUPS.map(g => (
                <div key={g.key}>
                  <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">{g.title}</div>
                  {g.key === 'custom' ? (
                    <div className="p-2 rounded-lg space-y-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-2">
                        <label className="font-mono text-[9px] text-gray-500 w-6">W</label>
                        <input type="number" min={16} max={8000} value={customW}
                          onChange={e => setCustomW(+e.target.value || 0)}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 font-mono text-xs text-white outline-none focus:border-[var(--color-primary)]" />
                        <label className="font-mono text-[9px] text-gray-500 w-6">H</label>
                        <input type="number" min={16} max={8000} value={customH}
                          onChange={e => setCustomH(+e.target.value || 0)}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 font-mono text-xs text-white outline-none focus:border-[var(--color-primary)]" />
                      </div>
                      <button onClick={() => { setFormat('custom'); setFormatMenuOpen(false); }}
                        className="w-full py-1.5 rounded-lg font-mono text-[10px] font-bold"
                        style={{ background: 'var(--color-primary)', color: '#000' }}>ПРИМЕНИТЬ</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1">
                      {g.ids.map(id => {
                        const d = FORMATS[id];
                        const sz = resolveSize(id, d.flippable ? orient : (d.locked || 'portrait'), customW, customH);
                        const active = format === id;
                        return (
                          <button key={id}
                            onClick={() => {
                              setFormat(id);
                              if (d.locked) setOrient(d.locked);
                              setFormatMenuOpen(false);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-left"
                            style={active ? { background: 'var(--color-primary)', color: '#000' } : {}}>
                            {/* ratio thumb */}
                            <span className="shrink-0 rounded-[2px] border"
                              style={{
                                width: 18, height: 18,
                                borderColor: active ? '#000' : 'var(--color-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                              <span style={{
                                background: active ? '#000' : 'var(--color-primary)',
                                width: Math.max(4, 16 * Math.min(1, sz.w / sz.h)),
                                height: Math.max(4, 16 * Math.min(1, sz.h / sz.w)),
                                borderRadius: 1,
                              }} />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-mono text-[11px] truncate">{d.label}</span>
                              <span className="block font-mono text-[8px] opacity-60">{sz.w}×{sz.h}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orientation — separate dropdown (like shapes/masks) */}
        <div className="relative">
          <button onClick={() => { setOrientMenuOpen(v => !v); setFormatMenuOpen(false); }}
            disabled={!canFlip}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title={canFlip ? 'Ориентация' : 'Формат фиксирован'}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              {orient === 'landscape'
                ? <rect x="3" y="6" width="18" height="12" rx="1.5" />
                : <rect x="7" y="3" width="10" height="18" rx="1.5" />}
            </svg>
            {orient === 'landscape' ? 'Гориз.' : 'Верт.'} ▾
          </button>
          {orientMenuOpen && canFlip && (
            <div className="absolute left-0 top-full mt-1 z-[999] p-2 rounded-xl space-y-1"
              style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 170 }}>
              <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">Ориентация</div>
              {([
                ['portrait', 'Вертикальная', <rect key="p" x="7" y="3" width="10" height="18" rx="1.5" />],
                ['landscape', 'Горизонтальная', <rect key="l" x="3" y="6" width="18" height="12" rx="1.5" />],
              ] as const).map(([o, label, icon]) => (
                <button key={o}
                  onClick={() => { setOrient(o); setOrientMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 text-left font-mono text-[11px]"
                  style={orient === o ? { background: 'var(--color-primary)', color: '#000' } : {}}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">{icon}</svg>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <span className="font-mono text-[10px] text-gray-500">ШАБЛОН:</span>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => { setZones(p.build(), true); setSelId(null); }}
            className="px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">{p.label}</button>
        ))}
      </div>

      <div id="collage-editor" className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Page navigator — compact on mobile, strip on desktop + sheet manager */}
        <div className="lg:col-span-4 glass rounded-xl p-2 sm:p-3 relative z-0">
          {/* always: pager controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => switchPage(Math.max(0, activeIdx - 1))}
              disabled={activeIdx <= 0}
              className="shrink-0 w-10 h-10 rounded-xl font-mono text-sm glass hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
              title="Предыдущая"
            >
              ‹
            </button>
            <button
              onClick={() => setPagesSheetOpen(true)}
              className="flex-1 min-w-0 h-10 px-3 rounded-xl glass hover:bg-white/10 flex items-center gap-2 text-left"
              title="Все страницы"
            >
              <span className="shrink-0 font-mono text-[11px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'var(--color-primary)', color: '#000' }}>
                {activeIdx + 1}/{pages.length}
              </span>
              <span className="flex-1 min-w-0 truncate font-mono text-xs text-gray-200">{page.name}</span>
              <span className="shrink-0 font-mono text-[9px] text-gray-500 hidden sm:inline">{fmt.w}×{fmt.h}</span>
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => switchPage(Math.min(pages.length - 1, activeIdx + 1))}
              disabled={activeIdx >= pages.length - 1}
              className="shrink-0 w-10 h-10 rounded-xl font-mono text-sm glass hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
              title="Следующая"
            >
              ›
            </button>
            <button
              onClick={() => addPage(false)}
              className="shrink-0 h-10 px-3 rounded-xl font-mono text-xs glass hover:bg-white/10"
              title="Новая страница"
            >
              +
            </button>
          </div>

          {/* desktop only: horizontal thumbnail strip */}
          <div className="hidden lg:flex gap-2 overflow-x-auto pb-1 mt-2">
            {pages.map((p, i) => {
              const active = i === activeIdx;
              return (
                <div
                  key={p.id}
                  draggable={editingPageId !== p.id}
                  onDragStart={() => setPageDragIdx(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    if (pageDragIdx !== null) movePage(pageDragIdx, i);
                    setPageDragIdx(null);
                  }}
                  onDragEnd={() => setPageDragIdx(null)}
                  onClick={() => { if (editingPageId !== p.id) switchPage(i); }}
                  className="relative shrink-0 rounded-lg overflow-hidden cursor-pointer border transition-all"
                  style={{
                    width: 64,
                    border: active ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.12)',
                    opacity: pageDragIdx === i ? 0.4 : 1,
                  }}
                  title={`${p.name}`}
                >
                  <PageThumb page={p} images={images} height={44} />
                  <div className="px-1 py-0.5 truncate font-mono text-[8px]"
                    style={{ background: active ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.04)', color: active ? 'var(--color-primary)' : '#888' }}>
                    {i + 1}. {p.name}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="hidden lg:block font-mono text-[8px] text-gray-600 mt-1">
            клик — открыть · перетащить — порядок · «☰» — все страницы и правки
          </p>
        </div>

        {/* Pages sheet — big cards for mobile (and desktop manage) */}
        {pagesSheetOpen && (
          <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={() => setPagesSheetOpen(false)}>
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl p-4 flex flex-col gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <div className="flex items-center justify-between shrink-0">
                <h3 className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                  СТРАНИЦЫ · {pages.length}
                </h3>
                <div className="flex gap-1.5">
                  <button onClick={() => addPage(false)}
                    className="px-2.5 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10">+ НОВАЯ</button>
                  <button onClick={() => addPage(true)}
                    className="px-2.5 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10">
                    <Copy className="w-3 h-3 inline mr-1" />ДУБЛЬ
                  </button>
                  <button onClick={() => setPagesSheetOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 grid grid-cols-2 gap-3 pr-1">
                {pages.map((p, i) => {
                  const active = i === activeIdx;
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl overflow-hidden border cursor-pointer"
                      style={{
                        border: active ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                      onClick={() => { switchPage(i); setPagesSheetOpen(false); }}
                    >
                      <PageThumb page={p} images={images} height={110} />
                      <div className="p-2 space-y-1.5">
                        {editingPageId === p.id ? (
                          <input
                            autoFocus
                            defaultValue={p.name}
                            onFocus={e => e.target.select()}
                            onClick={e => e.stopPropagation()}
                            onBlur={e => { renamePage(p.id, e.target.value); e.stopPropagation(); }}
                            onKeyDown={e => {
                              e.stopPropagation();
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setEditingPageId(null);
                            }}
                            className="w-full bg-black/40 border border-white/15 rounded px-2 py-1.5 font-mono text-xs text-white outline-none"
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="flex-1 min-w-0 truncate font-mono text-xs text-gray-200">
                              <span style={{ color: 'var(--color-primary)' }}>{i + 1}.</span> {p.name}
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); setEditingPageId(p.id); }}
                              className="shrink-0 p-2 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-200"
                              title="Переименовать"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); if (i > 0) movePage(i, i - 1); }}
                            disabled={i === 0}
                            className="flex-1 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10 disabled:opacity-30"
                            title="Левее"
                          >←</button>
                          <button
                            onClick={e => { e.stopPropagation(); if (i < pages.length - 1) movePage(i, i + 1); }}
                            disabled={i === pages.length - 1}
                            className="flex-1 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10 disabled:opacity-30"
                            title="Правее"
                          >→</button>
                          {pages.length > 1 && (
                            <button
                              onClick={e => { e.stopPropagation(); removePage(i); }}
                              className="shrink-0 w-10 py-2 rounded-lg font-mono text-[11px] hover:bg-red-500/15 text-red-400"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="font-mono text-[9px] text-gray-600 shrink-0">
                карточка — открыть · ✎ — имя · ← → — порядок · у каждой страницы свой undo
              </p>
            </motion.div>
          </div>
        )}

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
                        transform: `rotate(${z.rotation || 0}deg)`,
                        WebkitTextStroke: z.stroke && z.stroke.width > 0
                          ? `${z.stroke.width * (z.fontSize || 0.06) * 200}px ${z.stroke.color}`
                          : undefined,
                        paintOrder: 'stroke fill',
                        textShadow: z.stroke && z.stroke.width > 0 ? 'none' : '0 1px 4px rgba(0,0,0,0.35)',
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
                  data-zone-id={z.id}
                  onPointerDown={e => onZonePointerDown(e, z, 'move')}
                  onDoubleClick={() => { if (z.imgId) { setSelId(z.id); setPhotoEditId(v => v === z.id ? null : z.id); } }}
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
                    cursor: photoEditId === z.id && z.imgId ? 'grab' : 'move',
                    touchAction: 'none',
                    outline: photoEditId === z.id && z.imgId
                      ? '2px solid var(--color-primary)'
                      : selected ? '2px dashed var(--color-primary)' : '1px dashed rgba(255,255,255,0.25)',
                    outlineOffset: 2,
                  }}
                >
                  {/* clipped visual surface — keeps the resize handle OUTSIDE overflow */}
                  <div
                    style={{
                      width: '100%', height: '100%',
                      clipPath: clipPathFor(z),
                      borderRadius: isPolyShape(z.type) ? 0 : borderRadii(z),
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
                          // pan/zoom inside the zone
                          transform: `scale(${z.imgZoom || 1}) translate(${(z.imgX || 0) * 30}%, ${(z.imgY || 0) * 30}%)`,
                          transition: 'transform 0.15s ease-out',
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
                  {/* border stroke along the shape */}
                  {z.border && z.border.width > 0 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex: 4 }}>
                      {z.type === 'circle' || z.type === 'ellipse' ? (
                        <ellipse cx="50" cy="50" rx="50" ry="50" fill="none"
                          stroke={z.border.color} strokeWidth={z.border.width * 2} vectorEffect="non-scaling-stroke" />
                      ) : (() => {
                        const pts = z.type === 'polygon' ? z.points : shapePoints(z.type);
                        const list = pts?.length ? pts : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
                        return (
                          <polygon
                            points={list.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
                            fill="none" stroke={z.border.color} strokeWidth={z.border.width * 2}
                            vectorEffect="non-scaling-stroke" strokeLinejoin="round"
                          />
                        );
                      })()}
                    </svg>
                  )}
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

            {/* alignment guides (while dragging) */}
            {guides.v !== null && (
              <div className="absolute top-0 bottom-0 w-px pointer-events-none" style={{ left: `${guides.v}%`, background: 'var(--color-primary)', boxShadow: '0 0 6px var(--color-primary)', zIndex: 40 }} />
            )}
            {guides.h !== null && (
              <div className="absolute left-0 right-0 h-px pointer-events-none" style={{ top: `${guides.h}%`, background: 'var(--color-primary)', boxShadow: '0 0 6px var(--color-primary)', zIndex: 40 }} />
            )}
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
          {photoEditId && (
            <div className="glass rounded-lg px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
              <p className="font-mono text-[10px]" style={{ color: 'var(--color-primary)' }}>
                РЕЖИМ ФОТО: тяните чтобы сдвинуть · колесо — зум · Esc — выход
              </p>
              <div className="flex gap-1">
                <button onClick={() => zoomPhoto(photoEditId, 1 / 1.15)} className="px-2 py-1 rounded font-mono text-[10px] glass hover:bg-white/10">−</button>
                <button onClick={() => zoomPhoto(photoEditId, 1.15)} className="px-2 py-1 rounded font-mono text-[10px] glass hover:bg-white/10">+</button>
                <button onClick={() => setPhotoEditId(null)} className="px-2 py-1 rounded font-mono text-[10px] font-bold" style={{ background: 'var(--color-primary)', color: '#000' }}>ГОТОВО</button>
              </div>
            </div>
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
            <div>
              <label className="font-mono text-[10px] text-gray-500 mb-1 block">КАЧЕСТВО ЭКСПОРТА</label>
              <div className="flex gap-2">
                {([1, 2] as const).map(s => (
                  <button key={s} onClick={() => setExportScale(s)}
                    className="flex-1 py-2 rounded-lg font-mono text-xs transition-all"
                    style={exportScale === s
                      ? { background: 'var(--color-primary)', color: '#000' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
                    {s === 1 ? `1x (${fmt.w}px)` : `2x (${fmt.w * 2}px)`}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[9px] text-gray-600 mt-1">2x — детализация для печати</p>
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
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">НАКЛОН: {sel.rotation || 0}°</label>
                    <input type="range" min={-45} max={45} value={sel.rotation || 0}
                      onChange={e => updateZone(sel.id, { rotation: +e.target.value }, false)}
                      onPointerUp={() => updateZone(sel.id, {})}
                      onMouseUp={() => updateZone(sel.id, {})}
                      className="w-full accent-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">ОБВОДКА ТЕКСТА</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-mono text-[9px] text-gray-500">Толщина {((sel.stroke?.width || 0) * 100).toFixed(0)}%</span>
                        <input type="range" min={0} max={30} value={Math.round((sel.stroke?.width || 0) * 100)}
                          onChange={e => updateZone(sel.id, { stroke: { width: +e.target.value / 100, color: sel.stroke?.color || '#000000' } }, false)}
                          onPointerUp={() => updateZone(sel.id, {})}
                          onMouseUp={() => updateZone(sel.id, {})}
                          className="w-full accent-[var(--color-primary)]" />
                      </div>
                      <div>
                        <span className="font-mono text-[9px] text-gray-500">Цвет</span>
                        <input type="color" value={sel.stroke?.color || '#000000'}
                          onChange={e => updateZone(sel.id, { stroke: { width: sel.stroke?.width || 0.05, color: e.target.value } })}
                          className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/10" />
                      </div>
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
                      onChange={e => updateZone(sel.id, { imgRadius: +e.target.value }, false)}
                      onPointerUp={() => updateZone(sel.id, {})}
                      onMouseUp={() => updateZone(sel.id, {})}
                      className="w-full accent-[var(--color-primary)]" />
                    <p className="font-mono text-[9px] text-gray-600 mt-1">мягкий угол самой фотографии</p>
                  </div>
                  {/* per-corner rounding for rect */}
                  {sel.type === 'rect' && (
                    <div>
                      <label className="font-mono text-[10px] text-gray-500 mb-1 block">УГЛЫ ПО ОТДЕЛЬНОСТИ</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([['tl', '↖'], ['tr', '↗'], ['bl', '↙'], ['br', '↘']] as const).map(([k, arrow]) => (
                          <label key={k} className="font-mono text-[9px] text-gray-500">{arrow}
                            <input type="range" min={0} max={50}
                              value={sel.corners?.[k] ?? sel.radius}
                              onChange={e => {
                                const cur = sel.corners || { tl: sel.radius, tr: sel.radius, br: sel.radius, bl: sel.radius };
                                updateZone(sel.id, { corners: { ...cur, [k]: +e.target.value } }, false);
                              }}
                              onPointerUp={() => updateZone(sel.id, {})}
                              onMouseUp={() => updateZone(sel.id, {})}
                              className="w-full accent-[var(--color-primary)]" />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* border stroke along the shape */}
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">РАМКА ЗОНЫ</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-mono text-[9px] text-gray-500">Толщина {sel.border?.width || 0}%</span>
                        <input type="range" min={0} max={20} value={sel.border?.width || 0}
                          onChange={e => updateZone(sel.id, { border: { width: +e.target.value, color: sel.border?.color || '#00ff88' } }, false)}
                          onPointerUp={() => updateZone(sel.id, {})}
                          onMouseUp={() => updateZone(sel.id, {})}
                          className="w-full accent-[var(--color-primary)]" />
                      </div>
                      <div>
                        <span className="font-mono text-[9px] text-gray-500">Цвет</span>
                        <input type="color" value={sel.border?.color || '#00ff88'}
                          onChange={e => updateZone(sel.id, { border: { width: sel.border?.width || 3, color: e.target.value } })}
                          className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/10" />
                      </div>
                    </div>
                  </div>
                  {/* photo pan/zoom */}
                  <div>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">ФОТО ВНУТРИ ЗОНЫ</label>
                    <button
                      onClick={() => setPhotoEditId(v => (sel.imgId && v !== sel.id) ? sel.id : null)}
                      className="w-full py-2 rounded-lg font-mono text-xs transition-all mb-2"
                      style={photoEditId === sel.id
                        ? { background: 'var(--color-primary)', color: '#000' }
                        : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
                      disabled={!sel.imgId}
                    >
                      {photoEditId === sel.id ? '✓ СДВИГ ФОТО (Esc — выйти)' : 'СДВИГАТЬ ФОТО ВНУТРИ'}
                    </button>
                    <p className="font-mono text-[9px] text-gray-600 mb-2">
                      drag / Shift+drag — сдвиг · колесо — зум · двойной клик по зоне — режим
                    </p>
                    <label className="font-mono text-[10px] text-gray-500 mb-1 block">ЗУМ ФОТО: {(sel.imgZoom || 1).toFixed(2)}×</label>
                    <div className="flex gap-1 mb-1">
                      <button onClick={() => zoomPhoto(sel.id, 1 / 1.15)}
                        className="flex-1 py-1.5 rounded font-mono text-xs glass hover:bg-white/10">− ЗУМ</button>
                      <button onClick={() => zoomPhoto(sel.id, 1.15)}
                        className="flex-1 py-1.5 rounded font-mono text-xs glass hover:bg-white/10">+ ЗУМ</button>
                      <button onClick={() => updateZone(sel.id, { imgZoom: 1, imgX: 0, imgY: 0 })}
                        className="flex-1 py-1.5 rounded font-mono text-xs glass hover:bg-white/10">СБРОС</button>
                    </div>
                    <input type="range" min={100} max={500} value={Math.round((sel.imgZoom || 1) * 100)}
                      onChange={e => updateZone(sel.id, { imgZoom: +e.target.value / 100 }, false)}
                      onPointerUp={() => updateZone(sel.id, {})}
                      onMouseUp={() => updateZone(sel.id, {})}
                      className="w-full accent-[var(--color-primary)]" />
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <label className="font-mono text-[9px] text-gray-500">↔
                        <input type="range" min={-100} max={100} value={Math.round((sel.imgX || 0) * 100)}
                          onChange={e => updateZone(sel.id, { imgX: +e.target.value / 100 }, false)}
                          onPointerUp={() => updateZone(sel.id, {})}
                          onMouseUp={() => updateZone(sel.id, {})}
                          className="w-full accent-[var(--color-primary)]" />
                      </label>
                      <label className="font-mono text-[9px] text-gray-500">↕
                        <input type="range" min={-100} max={100} value={Math.round((sel.imgY || 0) * 100)}
                          onChange={e => updateZone(sel.id, { imgY: +e.target.value / 100 }, false)}
                          onPointerUp={() => updateZone(sel.id, {})}
                          onMouseUp={() => updateZone(sel.id, {})}
                          className="w-full accent-[var(--color-primary)]" />
                      </label>
                    </div>
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

          {/* Export menu — z above neighbouring .glass cards */}
          <div className="relative z-50">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setExportMenuOpen(v => !v)}
              disabled={isBusy}
              className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)', color: '#000' }}>
              <Download className="w-4 h-4" /> {isBusy ? 'ЭКСПОРТ...' : `ЭКСПОРТ ${fmt.w * exportScale}×${fmt.h * exportScale}`} ▾
            </motion.button>
            {exportMenuOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-[999] p-2 rounded-xl space-y-1 w-full"
                style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">Текущая страница</div>
                <button onClick={() => { setExportMenuOpen(false); exportPng(); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  PNG ({fmt.w * exportScale}×{fmt.h * exportScale})
                </button>
                <button onClick={() => { setExportMenuOpen(false); exportPdf('current'); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  PDF (текущая)
                </button>
                <div className="font-mono text-[9px] text-gray-500 px-1 pt-2 pb-1 uppercase tracking-wider">Все страницы ({pages.length})</div>
                <button onClick={() => { setExportMenuOpen(false); exportPdf('all'); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  PDF (все страницы)
                </button>
                <button onClick={() => { setExportMenuOpen(false); exportZip(); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  PNG ZIP (все страницы)
                </button>
              </div>
            )}
          </div>

          {zones.length > 0 && (
            <button onClick={() => { setZones([], true); setSelId(null); }}
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

// ── Page (lobby ↔ editor) ─────────────────────────────────────
export default function PhotoCollage() {
  const [projectId, setProjectId] = useState<string | null>(null);

  if (!projectId) {
    return <CollageLobby onOpen={id => setProjectId(id)} />;
  }
  return (
    <CollageEditor
      key={projectId}
      projectId={projectId}
      onExit={() => setProjectId(null)}
    />
  );
}
