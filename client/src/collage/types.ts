// Collage types, formats, page model — extracted from PhotoCollage.tsx
export const uid = () => Math.random().toString(36).slice(2);

// ── Types ─────────────────────────────────────────────────────
export type ShapeType =
  | 'rect' | 'circle' | 'ellipse' | 'polygon' | 'text' | 'mask' | 'art'
  | 'triangle' | 'star' | 'heart' | 'hexagon' | 'arch' | 'diamond'
  | 'semicircle' | 'cloud' | 'drop' | 'cross' | 'arrowR' | 'arrowU'
  | 'pentagon' | 'octagon' | 'squircle' | 'spark' | 'blob' | 'bolt' | 'flower' | 'chevron'
  | 'brushWide' | 'brushDry' | 'splash' | 'ragged';
export type FitMode = 'cover' | 'contain';
export type TextAlign = 'left' | 'center' | 'right';
export type BgTexture = 'none' | 'noise' | 'grid' | 'dots' | 'diag';

export interface Pt { x: number; y: number } // normalized 0..1 of canvas

export interface ZoneFilters {
  brightness: number; // 0..200, 100 = norm
  contrast: number;
  saturate: number;
  sepia: number;
  grayscale: number;
}

export const DEFAULT_FILTERS: ZoneFilters = { brightness: 100, contrast: 100, saturate: 100, sepia: 0, grayscale: 0 };
export interface Zone {
  id: string;
  type: ShapeType;
  x: number; y: number; w: number; h: number; // normalized bbox
  radius: number;      // 0..50 (% of half min-side) for rect
  imgRadius: number;   // 0..50 — rounding of the IMAGE inside the zone
  fit: FitMode;
  points?: Pt[];       // for polygon / mask (zone-relative 0..1)
  imgId?: string | null;
  // per-corner rounding (rect) — falls back to `radius` when unset
  corners?: { tl: number; tr: number; br: number; bl: number };
  // photo pan/zoom inside the zone
  imgZoom?: number;    // 1..5
  imgX?: number;       // -1..1 offset (fraction of zone size)
  imgY?: number;
  /** photo opacity 0..1 */
  imgOpacity?: number;
  /** photo filters */
  filters?: ZoneFilters;
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
  /** extra letter spacing in em, e.g. 0.12 */
  letterSpacing?: number;
  /** line height multiplier, e.g. 1.3 */
  lineHeight?: number;
  /** small caps (kapital) */
  smallCaps?: boolean;
  /** drop shadow under text */
  textShadow?: { x: number; y: number; blur: number; color: string };
  /** gradient fill (overrides fontColor) */
  textGradient?: { from: string; to: string; angle: number };
  /** arc bend in degrees, 0 = straight, + = smile, − = frown */
  curve?: number;
  /** pill/badge background behind text */
  textBg?: { color: string; padX: number; padY: number; radius: number };
  /** freeform path for text (zone-relative 0..1); overrides curve */
  textPath?: Pt[];
  /** clip this zone's photo to another zone's shape */
  clipZoneId?: string | null;
  /** portrait-style blur outside center (0 = off, 1..40 = px-ish) */
  portraitBlur?: number;
  /** art clipart */
  artKey?: string;
  fillColor?: string;
  // layers
  hidden?: boolean;
  locked?: boolean;
  name?: string;
}

export interface ImgItem {
  id: string;
  preview: string;
  dataUrl?: string; // for project persistence
  img?: HTMLImageElement;
}

export type FormatId =
  | 'a1' | 'a2' | 'a3' | 'a4' | 'a5'
  | 'square' | 'album32' | 'book23' | 'igPost' | 'igStories' | 'vkCover' | 'youtube'
  | 'custom';
export type Orientation = 'portrait' | 'landscape';

export interface FormatDef {
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
export const FORMATS: Record<FormatId, FormatDef> = {
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

export const FORMAT_GROUPS: { key: FormatDef['group']; title: string; ids: FormatId[] }[] = [
  { key: 'paper',  title: 'Бумага (A1–A5)', ids: ['a1', 'a2', 'a3', 'a4', 'a5'] },
  { key: 'social', title: 'Соцсети',        ids: ['square', 'album32', 'book23', 'igPost', 'igStories', 'vkCover', 'youtube'] },
  { key: 'custom', title: 'Кастом WxH',     ids: ['custom'] },
];

/** effective canvas size — applies orientation flip */
export function resolveSize(id: FormatId, o: Orientation, customW: number, customH: number) {
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
export interface CollagePage {
  id: string;
  name: string;
  format: FormatId;
  orient: Orientation;
  customW: number;
  customH: number;
  bgColor: string;
  /** transparent page bg (PNG alpha; UI shows checkerboard) */
  bgTransparent?: boolean;
  bgTexture?: BgTexture;
  outerRadius: number;
  zones: Zone[];
  /** per-page undo stack (zone snapshots) */
  history: Zone[][];
  histIdx: number;
}

export function createPage(name: string, from?: CollagePage): CollagePage {
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
    bgTransparent: false,
    bgTexture: 'none',
    outerRadius: 0,
    zones: [],
    history: [[]],
    histIdx: 0,
  };
}

/** snapshot zones into the page undo stack */
export function withHistory(p: CollagePage, zones: Zone[]): CollagePage {
  const history = [...p.history.slice(0, p.histIdx + 1), zones.map(z => ({ ...z }))];
  return { ...p, zones, history, histIdx: history.length - 1 };
}

/** ISO paper size in PDF points (portrait base) */
export const PAPER_PT: Partial<Record<FormatId, { w: number; h: number }>> = {
  a1: { w: 1684, h: 2384 },
  a2: { w: 1191, h: 1684 },
  a3: { w: 842, h: 1191 },
  a4: { w: 595, h: 842 },
  a5: { w: 420, h: 595 },
};

/** page size in PDF points (orientation-aware) */
export function resolvePt(p: Pick<CollagePage, 'format' | 'orient' | 'customW' | 'customH'>) {
  const paper = PAPER_PT[p.format];
  if (paper) {
    return p.orient === 'landscape' ? { w: paper.h, h: paper.w } : { w: paper.w, h: paper.h };
  }
  const sz = resolveSize(p.format, p.orient, p.customW, p.customH);
  // same aspect as the raster: treat px @ 200dpi like paper (A4 1654px → 595pt)
  return { w: sz.w * 72 / 200, h: sz.h * 72 / 200 };
}

/** browsers silently crop huge canvases — clamp export scale */
export const MAX_CANVAS_DIM = 8192;
export const MAX_CANVAS_AREA = 32_000_000; // ~32MP

export function safeExportScale(w: number, h: number, want: number): number {
  let s = want;
  while (s > 0.25 && (w * s > MAX_CANVAS_DIM || h * s > MAX_CANVAS_DIM || w * s * h * s > MAX_CANVAS_AREA)) {
    s = Math.floor(s * 10) / 20; // 2 → 1 → 0.5 …
  }
  return Math.max(0.25, s);
}

export function exportPixelSize(p: Pick<CollagePage, 'format' | 'orient' | 'customW' | 'customH'>, wantScale: number) {
  const sz = resolveSize(p.format, p.orient, p.customW, p.customH);
  const s = safeExportScale(sz.w, sz.h, wantScale);
  return { w: sz.w, h: sz.h, scale: s, outW: Math.round(sz.w * s), outH: Math.round(sz.h * s) };
}
