import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Image as ImageIcon, X, Trash2, Copy, Layers, Maximize2, Minimize2, Pencil, ArrowLeft,
} from 'lucide-react';
import JSZip from 'jszip';
import { showToast } from '../components/ui/NexusModal';
import CollageLobby from '../components/CollageLobby';
import {
  getProject, saveProject, patchProjectMeta, formatRuDate,
  fileToDataUrl, dataUrlToImage, addProjectVersion, deleteProjectVersion,
  type ProjectVersion,
} from '../utils/collageStore';
import { canvasToBlob, exportPdf, exportPptx, downloadBlob, type ImageFormat } from '../utils/collageExport';
import { CLIPART } from '../utils/collageArt';

import {
  type ShapeType, type BgTexture, type Pt,
  type Zone, type ImgItem, type FormatId, type Orientation, type CollagePage,
  FORMATS, resolveSize, createPage, withHistory,
  resolvePt, exportPixelSize, uid,
} from '../collage/types';
import { cssFilter, cssTextShadow, applySmallCaps } from '../collage/textDraw';
import { clamp, isPolyShape, clipPathFor, borderRadii, shapePoints } from '../collage/geometry';
import { renderPageToCanvas } from '../collage/render';
import { CHECKER_BG } from '../collage/constants';
import { PageThumb } from '../collage/ui';
import { CollageToolbar } from '../collage/CollageToolbar';
import { CollageInspector } from '../collage/CollageInspector';
import type { CollageUIProps } from '../collage/editorProps';

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
  /** draw | lasso | brush (mask paint) */
  const [toolMode, setToolMode] = useState<'draw' | 'lasso' | 'brush'>('draw');
  const [imgFormat, setImgFormat] = useState<ImageFormat>('png');
  const [imgQuality, setImgQuality] = useState(92);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [wm, setWm] = useState<{ dataUrl: string; opacity: number; corner: 'tl' | 'tr' | 'bl' | 'br' | 'center'; scale: number; img?: HTMLImageElement } | null>(null);
  const wmInputRef = useRef<HTMLInputElement>(null);
  /** 1 = saved just now */
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showThirds, setShowThirds] = useState(false);
  const [gridStep, setGridStep] = useState(5); // percent of canvas
  const [comparePct, setComparePct] = useState<number | null>(null); // 0..100 split
  const [pathDraft, setPathDraft] = useState<Pt[] | null>(null);
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
        setVersions(p.versions || []);
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
        setLastSavedAt(Date.now());
      } catch {
        /* silent — next change retries */
      }
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, images, loaded, projectId]);

  // Ctrl+S force save + Space pan + tick relative save label
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveProject({
          id: projectId,
          name: projectMeta?.name || '',
          description: projectMeta?.description || '',
          updatedAt: Date.now(),
          pageCount: pages.length,
          pagesJson: JSON.stringify(pages.map(({ history: _h, histIdx: _i, ...rest }) => rest)),
          images: images.filter(i => i.dataUrl).map(i => ({ id: i.id, dataUrl: i.dataUrl! })),
        }).then(() => setLastSavedAt(Date.now())).catch(() => {});
        showToast('Сохранено', 'success');
      }
      if (e.code === 'Space' && !(e.target as HTMLElement)?.closest('input,textarea,select,button')) {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.key === 'Escape') setComparePct(null);
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectMeta, pages, images]);

  // zoom via wheel+Alt (plain wheel = photo zoom)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      setViewZoom(z => clamp(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.5, 4));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const fitView = () => { setViewZoom(1); setViewPan({ x: 0, y: 0 }); };
  const zoomAtCenter = (factor: number) => {
    setViewZoom(z => clamp(z * factor, 0.5, 4));
  };

  const page = pages[Math.min(activeIdx, pages.length - 1)] ?? pages[0];
  const {
    format, orient, customW, customH, bgColor, bgTransparent, outerRadius,
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
  const setBgColor = (v: string) => patchPage(page.id, { bgColor: v, bgTransparent: false });
  const setBgTransparent = (v: boolean) => patchPage(page.id, { bgTransparent: v });
  const setBgTexture = (v: BgTexture) => patchPage(page.id, { bgTexture: v });
  const setOuterRadius = (v: number) => patchPage(page.id, { outerRadius: v });

  // ── align (selected zone to canvas edges/center) ─────────────
  const alignZone = (id: string, how: 'l' | 'c' | 'r' | 't' | 'm' | 'b') => {
    const z = zones.find(x => x.id === id);
    if (!z || z.locked) return;
    let { x, y } = z;
    if (how === 'l') x = 0;
    if (how === 'c') x = (1 - z.w) / 2;
    if (how === 'r') x = 1 - z.w;
    if (how === 't') y = 0;
    if (how === 'm') y = (1 - z.h) / 2;
    if (how === 'b') y = 1 - z.h;
    updateZone(id, { x, y });
  };

  const distributeZones = (axis: 'x' | 'y') => {
    const list = zones.filter(z => !z.locked && z.type !== 'text');
    if (list.length < 3) { showToast('Нужно 3+ зоны', 'error'); return; }
    const sorted = [...list].sort((a, b) => axis === 'x' ? a.x - b.x : a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const start = axis === 'x' ? first.x : first.y;
    const end = axis === 'x' ? last.x + last.w : last.y + last.h;
    const totalSize = sorted.reduce((s, z) => s + (axis === 'x' ? z.w : z.h), 0);
    const gap = (end - start - totalSize) / (sorted.length - 1);
    let cur = start;
    const patches = new Map<string, Partial<Zone>>();
    for (const z of sorted) {
      if (axis === 'x') {
        patches.set(z.id, { x: cur });
        cur += z.w + gap;
      } else {
        patches.set(z.id, { y: cur });
        cur += z.h + gap;
      }
    }
    setZones(prev => prev.map(z => patches.has(z.id) ? { ...z, ...patches.get(z.id) } : z), true);
  };

  // ── lasso / brush → mask-polygon zone from freehand stroke ───
  const strokeToPolygon = (pts: Pt[], width: number): Pt[] => {
    if (pts.length < 2) return pts;
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const nx = -dy * width / 2;
      const ny = dx * width / 2;
      left.push({ x: p.x + nx, y: p.y + ny });
      right.push({ x: p.x - nx, y: p.y - ny });
    }
    return [...left, ...right.reverse()];
  };

  const addFreehandZone = (rawPts: Pt[], asBrush: boolean) => {
    if (rawPts.length < 3) { showToast('Слишком короткий штрих', 'error'); return; }
    // smooth lasso: light chaikin-ish resample
    let pts = rawPts;
    if (!asBrush && rawPts.length > 4) {
      pts = rawPts.filter((_, i) => i % 2 === 0 || i === rawPts.length - 1);
    }
    const poly = asBrush ? strokeToPolygon(pts, 0.12) : pts;
    // normalize to bbox
    const xs = poly.map(p => p.x);
    const ys = poly.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const bw = Math.max(maxX - minX, 0.01);
    const bh = Math.max(maxY - minY, 0.01);
    const z: Zone = {
      id: uid(),
      type: 'mask',
      x: minX, y: minY, w: bw, h: bh,
      radius: 0, imgRadius: 0, fit: 'cover', imgId: null,
      points: poly.map((p: any) => ({ x: (p.x - minX) / bw, y: (p.y - minY) / bh })),
      name: asBrush ? 'Мазок' : 'Лассо',
    };
    setZones(prev => [...prev, z], true);
    setSelId(z.id);
    setDrawing(false);
    setDrawPts([]);
    setToolMode('draw');
  };

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
          bgTransparent: page.bgTransparent,
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
          points: drawPts.map((p: Pt) => ({ ...p })),
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
      z.points = drawPts.map((p: any) => ({ x: (p.x - minX) / bw, y: (p.y - minY) / bh }));
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

  /** ready «дата · место» badge like on posters */
  const addBadgeZone = () => {
    const d = new Date();
    const date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase();
    const z: Zone = {
      id: uid(), type: 'text',
      x: 0.18, y: 0.72, w: 0.64, h: 0.1,
      radius: 0, imgRadius: 0, fit: 'cover', imgId: null,
      text: `${date} · 19:00 · ПЛОЩАДКА`,
      fontFamily: 'Montserrat', fontSize: 0.035,
      fontColor: '#ffffff', fontWeight: 'bold', align: 'center',
      letterSpacing: 0.14,
      smallCaps: true,
      textBg: { color: 'rgba(0,0,0,0.72)', padX: 0.7, padY: 0.35, radius: 0.5 },
      name: 'Бейдж',
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

  // ── Pointer interaction (move / resize / photo-pan) — works with touch
  const onZonePointerDown = (e: React.PointerEvent, z: Zone, mode: 'move' | 'resize' | 'photo-pan') => {
    if (drawing || z.locked || z.hidden) return;
    e.stopPropagation();
    // never start a drag unless the pointer is inside the canvas artboard
    const cv = canvasRef.current;
    if (cv) {
      const r = cv.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    }
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

  // wheel: zoom WORKSPACE toward cursor; Shift+wheel / photo-mode = zoom photo in zone
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;

      // photo zoom: Shift+wheel, or wheel while in photo-adjust mode over that zone
      const node = (e.target as HTMLElement)?.closest('[data-zone-id]') as HTMLElement | null;
      const zid = node?.dataset.zoneId;
      const z = zid ? zones.find(x => x.id === zid) : null;
      const wantPhoto = (e.shiftKey || !!photoEditId) && z?.imgId && (e.shiftKey || photoEditId === z.id);
      if (wantPhoto && zid) {
        zoomPhoto(zid, factor, false);
        if (t) clearTimeout(t);
        t = setTimeout(() => commitHistory(zones), 200);
        return;
      }

      // workspace zoom toward cursor
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // content point under cursor in untransformed coords
      const contentX = (e.clientX - cx - viewPan.x) / viewZoom;
      const contentY = (e.clientY - cy - viewPan.y) / viewZoom;
      const nz = clamp(viewZoom * factor, 0.5, 4);
      const npx = e.clientX - cx - contentX * nz;
      const npy = e.clientY - cy - contentY * nz;
      setViewZoom(nz);
      setViewPan({ x: npx, y: npy });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, images, photoEditId, viewZoom, viewPan]);

  // Esc exits photo-adjust mode
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && photoEditId) setPhotoEditId(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [photoEditId]);

  // ── Drawing a freeform polygon on the canvas (click points)
  const onCanvasClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    // text-path drafting on selected text zone
    if (pathDraft !== null && sel?.type === 'text') {
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const cy = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      const rel: Pt = {
        x: clamp((cx - sel.x) / Math.max(sel.w, 0.01), 0, 1),
        y: clamp((cy - sel.y) / Math.max(sel.h, 0.01), 0, 1),
      };
      setPathDraft(prev => [...(prev || []), rel]);
      return;
    }
    if (toolMode !== 'draw' || !drawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    setDrawPts(prev => [...prev, { x, y }]);
  };

  // freehand lasso / brush stroke
  const lassoRef = useRef<Pt[] | null>(null);
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (toolMode === 'draw' || !canvasRef.current) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    lassoRef.current = [{ x, y }];
    setDrawPts([{ x, y }]);
  };
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (!lassoRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    lassoRef.current.push({ x, y });
    setDrawPts([...lassoRef.current]);
  };
  const onCanvasPointerUp = () => {
    if (!lassoRef.current) return;
    const pts = lassoRef.current;
    lassoRef.current = null;
    addFreehandZone(pts, toolMode === 'brush');
  };

  const finishPolygon = () => {
    if (drawPts.length < 3) { showToast('Нужно минимум 3 точки', 'error'); return; }
    addShape('polygon');
  };

  // ── Export ───────────────────────────────────────────────────
  const wmSpec = useMemo(() => {
    if (!wm?.img) return undefined;
    return { img: wm.img, opacity: wm.opacity, corner: wm.corner, scale: wm.scale };
  }, [wm]);

  const exportImage = async () => {
    const p = page;
    if (p.zones.filter(z => !z.hidden).length === 0) { showToast('Добавьте хотя бы одну зону', 'error'); return; }
    // JPEG has no alpha channel — cannot be transparent
    const fmtOut: ImageFormat = p.bgTransparent && imgFormat === 'jpeg' ? 'png' : imgFormat;
    if (p.bgTransparent && imgFormat === 'jpeg') {
      showToast('JPEG не хранит прозрачность — экспортирую PNG', 'warning');
    }
    setIsBusy(true);
    try {
      const ex = exportPixelSize(p, exportScale);
      const canvas = renderPageToCanvas(p, images, ex.scale, wmSpec);
      const blob = await canvasToBlob(canvas, fmtOut, imgQuality / 100);
      const ext = fmtOut === 'jpeg' ? 'jpg' : fmtOut;
      downloadBlob(blob, `collage_${Date.now()}.${ext}`);
      showToast(
        p.bgTransparent
          ? `${fmtDef.label} · ${ex.outW}×${ex.outH} · прозрачный (${fmtOut.toUpperCase()})`
          : `${fmtDef.label} · ${ex.outW}×${ex.outH}`,
        'success',
      );
    } catch (e: any) {
      showToast(e?.message || 'Ошибка', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const exportZip = async () => {
    const withContent = pages.filter(p => p.zones.filter(z => !z.hidden).length > 0);
    if (withContent.length === 0) { showToast('Нет страниц с зонами', 'error'); return; }
    setIsBusy(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const ex = exportPixelSize(p, exportScale);
        const canvas = renderPageToCanvas(p, images, ex.scale, wmSpec);
        const blob = await canvasToBlob(canvas, imgFormat, imgQuality / 100);
        const ext = imgFormat === 'jpeg' ? 'jpg' : imgFormat;
        zip.file(`page_${String(i + 1).padStart(2, '0')}_${p.name.replace(/[^\wа-яё-]+/gi, '_')}.${ext}`, blob);
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

  const buildPageRasters = (list: CollagePage[], wantScale: number) =>
    list.map(p => {
      const ex = exportPixelSize(p, wantScale);
      const canvas = renderPageToCanvas(p, images, ex.scale, wmSpec);
      const pt = resolvePt(p);
      return { canvas, wPt: pt.w, hPt: pt.h, transparent: !!p.bgTransparent };
    });

  const pickScale = (_list?: CollagePage[]): number => exportScale;

  const exportPdfScope = async (scope: 'current' | 'all') => {
    const list = scope === 'all' ? pages : [page];
    if (list.every(p => p.zones.filter(z => !z.hidden).length === 0)) { showToast('Нет страниц с зонами', 'error'); return; }
    setIsBusy(true);
    try {
      await exportPdf(buildPageRasters(list, pickScale(list)),
        `collage_${scope === 'all' ? 'all_pages' : 'page'}.pdf`);
      showToast(scope === 'all' ? `PDF: ${list.length} стр.` : 'PDF сохранён', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка PDF', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const exportPptxScope = async (scope: 'current' | 'all') => {
    const list = scope === 'all' ? pages : [page];
    if (list.every(p => p.zones.filter(z => !z.hidden).length === 0)) { showToast('Нет страниц с зонами', 'error'); return; }
    setIsBusy(true);
    try {
      await exportPptx(buildPageRasters(list, pickScale(list)),
        `collage_${scope === 'all' ? 'all_pages' : 'page'}.pptx`);
      showToast(scope === 'all' ? `PPTX: ${list.length} слайдов` : 'PPTX сохранён', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Ошибка PPTX', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const saveVersion = async () => {
    try {
      const name = `v${(versions.length + 1)} · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      await saveProject({
        id: projectId,
        name: projectMeta?.name || '',
        description: projectMeta?.description || '',
        updatedAt: Date.now(),
        pageCount: pages.length,
        pagesJson: JSON.stringify(pages.map(({ history: _h, histIdx: _i, ...rest }) => rest)),
        images: images.filter(i => i.dataUrl).map(i => ({ id: i.id, dataUrl: i.dataUrl! })),
      });
      await addProjectVersion(projectId, name);
      const cur = await getProject(projectId);
      setVersions(cur?.versions || []);
      setLastSavedAt(Date.now());
      showToast(`Версия «${name}»`, 'success');
    } catch {
      showToast('Не удалось сохранить версию', 'error');
    }
  };

  const addArtZone = (key: string) => {
    const z: Zone = {
      id: uid(), type: 'art',
      x: 0.3, y: 0.3, w: 0.35, h: 0.35,
      radius: 0, imgRadius: 0, fit: 'cover', imgId: null,
      artKey: key, fillColor: '#00ff88',
      name: CLIPART.find(a => a.key === key)?.label || 'Арт',
    };
    setZones(prev => [...prev, z], true);
    setSelId(z.id);
  };

  const restoreVersion = async (v: ProjectVersion) => {
    try {
      const parsed = JSON.parse(v.pagesJson) as CollagePage[];
      setPages(parsed.map(pg => ({ ...pg, history: [pg.zones.map(z => ({ ...z }))], histIdx: 0 })));
      const imgs: ImgItem[] = [];
      for (const s of v.images) {
        try {
          const img = await dataUrlToImage(s.dataUrl);
          imgs.push({ id: s.id, preview: s.dataUrl, dataUrl: s.dataUrl, img });
        } catch { /* skip */ }
      }
      setImages(imgs);
      setActiveIdx(0);
      setSelId(null);
      showToast(`Откат к «${v.name}»`, 'success');
    } catch {
      showToast('Ошибка отката', 'error');
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

  const ui: CollageUIProps = {
    page, pages, fmt, fmtDef, canFlip, format, orient, customW, customH,
    formatMenuOpen, orientMenuOpen, setFormatMenuOpen, setOrientMenuOpen,
    setFormat, setOrient, setCustomW, setCustomH,
    toolMode, setToolMode, drawing, setDrawing, drawPts, setDrawPts,
    finishPolygon, addShape, addTextZone, addBadgeZone, addArtZone,
    shapeMenuOpen, setShapeMenuOpen,
    undo, redo, histIdx, history,
    zones, sel, selId, setSelId, updateZone, setZones, removeZone,
    bringForward, sendBackward, bringToFront, sendToBack,
    alignZone, distributeZones,
    photoEditId, setPhotoEditId, zoomPhoto,
    bgColor, bgTransparent: !!bgTransparent, outerRadius, setBgColor, setBgTransparent, setBgTexture, setOuterRadius,
    exportScale, setExportScale,
    pathDraft, setPathDraft,
    versions, saveVersion, restoreVersion,
    deleteVersion: async (id: string) => {
      await deleteProjectVersion(projectId, id);
      const cur = await getProject(projectId);
      setVersions(cur?.versions || []);
    },
    wm, setWm, wmInputRef,
    exportMenuOpen, setExportMenuOpen, imgFormat, setImgFormat, imgQuality, setImgQuality,
    exportImage, exportPdfScope, exportPptxScope, exportZip, isBusy,
    comparePct, setComparePct,
    viewZoom, zoomAtCenter, fitView,
    showGrid, setShowGrid, showThirds, setShowThirds, gridStep, setGridStep,
    images,
  };

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
            {projectMeta ? `изм. ${formatRuDate(projectMeta.updatedAt)}` : ''}
            {lastSavedAt ? ` · сохранено ${Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000))}с` : ''}
            {' '}· ФИГУРЫ, ФОТО, СТРАНИЦЫ, PDF/ZIP
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

      <CollageToolbar {...ui} />

      {/* two columns: canvas stays put (desktop), inspector has its own scroll */}
      <div
        id="collage-editor"
        className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:h-[calc(100dvh-210px)] lg:overflow-hidden"
      >
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

        {/* Canvas column — photo tray on TOP (always visible), canvas below */}
        <div className="lg:col-span-3 flex flex-col gap-2 min-h-0 lg:overflow-y-auto lg:overscroll-contain">
          {/* Photo tray — compact strip above canvas */}
          <div className="glass rounded-xl p-2 shrink-0 flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()}
              className="shrink-0 px-2.5 py-2 rounded-lg font-mono text-[10px] glass hover:bg-white/10 flex items-center gap-1"
              title="Загрузить фото">
              <ImageIcon className="w-3.5 h-3.5" /> + ФОТО
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { if (e.target.files) addImage(e.target.files); e.target.value = ''; }} />
            <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto">
              {images.map(im => (
                <div
                  key={im.id}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/photo', im.id); }}
                  onClick={() => { if (selId) updateZone(selId, { imgId: im.id }); else showToast('Сначала выберите зону', 'error'); }}
                  className="relative shrink-0 w-10 h-10 rounded-md overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing hover:border-[var(--color-primary)] transition-colors"
                  title="Перетащите на зону или клик — в выбранную"
                >
                  <img src={im.preview} alt="" className="w-full h-full object-cover pointer-events-none" />
                </div>
              ))}
              {images.length === 0 && (
                <span className="font-mono text-[9px] text-gray-600 self-center">
                  {images.length} фото · перетащите на зону или клик по миниатюре
                </span>
              )}
            </div>
            <span className="shrink-0 font-mono text-[9px] text-gray-500 hidden sm:inline">({images.length})</span>
            <button
              onClick={() => {
                const el = document.getElementById('collage-editor');
                if (!document.fullscreenElement) el?.requestFullscreen?.();
                else document.exitFullscreen?.();
              }}
              className="shrink-0 p-2 rounded-lg font-mono glass hover:bg-white/10"
              title="Во весь экран">
              {isFull ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div
            ref={canvasRef}
            onClick={drawing || pathDraft !== null ? onCanvasClick : undefined}
            onPointerDown={toolMode !== 'draw' ? onCanvasPointerDown : undefined}
            onPointerMove={toolMode !== 'draw' ? onCanvasPointerMove : onZonePointerMove}
            onPointerUp={toolMode !== 'draw' ? onCanvasPointerUp : onZonePointerUp}
            id="collage-canvas"
            className={`relative mx-auto rounded-xl overflow-hidden select-none sticky top-0 z-20 lg:sticky ${spaceDown ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{
              // definite width (auto + aspect-ratio alone collapses — all kids are absolute)
              width: isFull
                ? `min(100%, calc((100vh - 220px) * ${fmt.w / fmt.h}))`
                : `min(100%, 560px, calc(min(70dvh, 100dvh - 260px) * ${fmt.w / fmt.h}))`,
              height: 'auto',
              aspectRatio: `${fmt.w} / ${fmt.h}`,
              background: bgTransparent ? CHECKER_BG : bgColor,
              backgroundSize: bgTransparent ? '16px 16px' : undefined,
              borderRadius: `${outerRadius}%`,
              cursor: spaceDown ? 'grab' : toolMode === 'draw' ? (drawing ? 'crosshair' : 'default') : 'crosshair',
              border: '1px solid rgba(255,255,255,0.1)',
              touchAction: 'none',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {/* floating workspace zoom controls */}
            <div
              className="absolute left-2 top-2 z-[60] flex items-center gap-0.5 rounded-lg px-1 py-0.5 pointer-events-auto"
              style={{ background: 'rgba(10,10,20,0.85)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <button onClick={e => { e.stopPropagation(); zoomAtCenter(1 / 1.2); }}
                onPointerDown={e => e.stopPropagation()}
                className="w-7 h-7 rounded font-mono text-sm text-gray-300 hover:bg-white/10">−</button>
              <button onClick={e => { e.stopPropagation(); fitView(); }}
                onPointerDown={e => e.stopPropagation()}
                className="px-1.5 h-7 rounded font-mono text-[10px] text-gray-300 hover:bg-white/10 min-w-[42px]"
                title="Сбросить зум / пан">
                {Math.round(viewZoom * 100)}%
              </button>
              <button onClick={e => { e.stopPropagation(); zoomAtCenter(1.2); }}
                onPointerDown={e => e.stopPropagation()}
                className="w-7 h-7 rounded font-mono text-sm text-gray-300 hover:bg-white/10">+</button>
            </div>

            {/* zoom/pan layer */}
            <div
              style={{
                position: 'absolute', inset: 0,
                transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${viewZoom})`,
                transformOrigin: 'center center',
              }}
              onPointerDown={spaceDown ? (e => {
                e.preventDefault();
                const sx = e.clientX - viewPan.x;
                const sy = e.clientY - viewPan.y;
                const move = (ev: PointerEvent) => setViewPan({ x: ev.clientX - sx, y: ev.clientY - sy });
                const up = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }) : undefined}
            >
            {/* zones */}
            {zones.map(z => {
              if (z.hidden) return null;
              const imgItem = z.imgId ? images.find(i => i.id === z.imgId) : null;
              const selected = z.id === selId;

              // TEXT zone — rendered as styled div
              if (z.type === 'text') {
                const useCurve = !!z.curve && Math.abs(z.curve) >= 2;
                const shadow = cssTextShadow(z);
                const bodyStyle: React.CSSProperties = {
                  fontFamily: `"${z.fontFamily || 'Montserrat'}", sans-serif`,
                  fontSize: `${(z.fontSize || 0.06) * 100}cqh`,
                  color: z.textGradient ? 'transparent' : (z.fontColor || '#ffffff'),
                  fontWeight: z.fontWeight === 'bold' ? 700 : 400,
                  lineHeight: z.lineHeight || 1.15,
                  letterSpacing: z.letterSpacing ? `${z.letterSpacing}em` : undefined,
                  fontVariant: z.smallCaps ? 'small-caps' : undefined,
                  textAlign: z.align || 'left',
                  width: '100%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  transform: useCurve ? undefined : `rotate(${z.rotation || 0}deg)`,
                  WebkitTextStroke: z.stroke && z.stroke.width > 0
                    ? `${z.stroke.width * (z.fontSize || 0.06) * 200}px ${z.stroke.color}`
                    : undefined,
                  paintOrder: 'stroke fill',
                  textShadow: shadow,
                  backgroundImage: z.textGradient
                    ? `linear-gradient(${z.textGradient.angle}deg, ${z.textGradient.from}, ${z.textGradient.to})`
                    : undefined,
                  WebkitBackgroundClip: z.textGradient ? 'text' : undefined,
                  backgroundClip: z.textGradient ? 'text' as const : undefined,
                  pointerEvents: 'none',
                };
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
                      transform: useCurve ? `rotate(${z.rotation || 0}deg)` : undefined,
                    }}
                  >
                    {z.textBg && (
                      <div style={{
                        position: 'absolute',
                        left: `${-z.textBg.padX * 20}%`, right: `${-z.textBg.padX * 20}%`,
                        top: `${-z.textBg.padY * 20}%`, bottom: `${-z.textBg.padY * 20}%`,
                        background: z.textBg.color,
                        borderRadius: `${z.textBg.radius * 20}px`,
                        pointerEvents: 'none',
                      }} />
                    )}
                    {useCurve ? (
                      <p style={bodyStyle} aria-hidden>
                        {[...(z.text || 'Ваш текст')].map((ch, i, arr) => {
                          const t = (i + 0.5) / arr.length - 0.5;
                          const ang = t * (z.curve || 0);
                          return (
                            <span key={i} style={{
                              display: 'inline-block',
                              transform: `rotate(${ang}deg)`,
                              transformOrigin: '50% 120%',
                              whiteSpace: 'pre',
                            }}>{ch}</span>
                          );
                        })}
                      </p>
                    ) : (
                      <p style={bodyStyle}>
                        {applySmallCaps(z.text || 'Ваш текст', z.smallCaps)}
                      </p>
                    )}
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
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const photoId = e.dataTransfer.getData('text/photo');
                    if (photoId && !z.locked) updateZone(z.id, { imgId: photoId });
                  }}
                  style={{
                    position: 'absolute',
                    left: `${z.x * 100}%`, top: `${z.y * 100}%`,
                    width: `${z.w * 100}%`, height: `${z.h * 100}%`,
                    // parent is a hit-test shell only — actual grab target is the clipped surface
                    pointerEvents: 'none',
                  }}
                >
                  {/* clipped visual surface = ONLY interactive region (shape-bounded) */}
                  <div
                    onPointerDown={e => onZonePointerDown(e, z, 'move')}
                    onDoubleClick={() => { if (z.imgId) { setSelId(z.id); setPhotoEditId(v => v === z.id ? null : z.id); } }}
                    style={{
                      width: '100%', height: '100%',
                      clipPath: clipPathFor(z, zones),
                      borderRadius: isPolyShape(z.type) ? 0 : borderRadii(z),
                      overflow: 'hidden',
                      background: imgItem ? 'transparent' : 'rgba(255,255,255,0.05)',
                      cursor: photoEditId === z.id && z.imgId ? 'grab' : (z.locked ? 'not-allowed' : 'move'),
                      touchAction: 'none',
                      outline: photoEditId === z.id && z.imgId
                        ? '2px solid var(--color-primary)'
                        : selected ? '2px dashed var(--color-primary)' : '1px dashed rgba(255,255,255,0.25)',
                      outlineOffset: 2,
                      pointerEvents: 'auto',
                    }}
                  >
                    {imgItem?.img ? (
                      <>
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
                          opacity: z.imgOpacity ?? 1,
                          filter: cssFilter(z.filters),
                          pointerEvents: 'none',
                        }}
                      />
                      {/* before/after split: left = original, right = filtered (filter already on base) */}
                      {comparePct !== null && z.id === selId && (
                        <img
                          src={imgItem.preview}
                          alt=""
                          draggable={false}
                          style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%',
                            objectFit: z.fit === 'cover' ? 'cover' : 'contain',
                            borderRadius: z.imgRadius > 0 ? `${z.imgRadius}%` : 0,
                            transform: `scale(${z.imgZoom || 1}) translate(${(z.imgX || 0) * 30}%, ${(z.imgY || 0) * 30}%)`,
                            opacity: z.imgOpacity ?? 1,
                            filter: 'none',
                            clipPath: `inset(0 ${100 - comparePct}% 0 0)`,
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                      {comparePct !== null && z.id === selId && (
                        <div style={{
                          position: 'absolute', top: 0, bottom: 0,
                          left: `${comparePct}%`, width: 2,
                          background: 'var(--color-primary)',
                          pointerEvents: 'none', zIndex: 6,
                        }} />
                      )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none gap-1">
                        <ImageIcon className="w-6 h-6 text-gray-600 opacity-40" />
                        <span className="font-mono text-[8px] text-gray-600">перетащите фото</span>
                      </div>
                    )}
                  </div>
                  {/* art clipart (no photo) */}
                  {z.type === 'art' && (() => {
                    const item = CLIPART.find(a => a.key === z.artKey);
                    if (!item) return null;
                    return (
                      <svg
                        viewBox="0 0 24 24"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ zIndex: 3 }}
                      >
                        <path d={item.path} fill={z.fillColor || 'var(--color-primary)'} />
                      </svg>
                    );
                  })()}
                  {/* border stroke along the shape */}
                  {z.border && z.border.width > 0 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex: 4 }}>
                      {z.type === 'circle' || z.type === 'ellipse' ? (
                        <ellipse cx="50" cy="50" rx="50" ry="50" fill="none"
                          stroke={z.border.color} strokeWidth={z.border.width * 2} vectorEffect="non-scaling-stroke" />
                      ) : (() => {
                        const pts = (z.type === 'polygon' || z.type === 'mask') ? z.points : shapePoints(z.type);
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
                  {/* resize handle — outside the clipped surface, still inside shell */}
                  {selected && !z.locked && (
                    <div
                      onPointerDown={e => onZonePointerDown(e, z, 'resize')}
                      style={{
                        position: 'absolute', right: -7, bottom: -7,
                        width: 14, height: 14, borderRadius: 4,
                        background: 'var(--color-primary)', cursor: 'nwse-resize', touchAction: 'none',
                        zIndex: 5,
                        pointerEvents: 'auto',
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* grid + thirds guides */}
            {(showGrid || showThirds) && (
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 45 }}>
                {showGrid && (
                  <>
                    {Array.from({ length: Math.max(1, Math.floor(100 / gridStep) - 1) }, (_, i) => {
                      const pct = (i + 1) * gridStep;
                      return (
                        <div key={`gv${pct}`} className="absolute top-0 bottom-0 w-px"
                          style={{ left: `${pct}%`, background: 'rgba(255,255,255,0.12)' }} />
                      );
                    })}
                    {Array.from({ length: Math.max(1, Math.floor(100 / gridStep) - 1) }, (_, i) => {
                      const pct = (i + 1) * gridStep;
                      return (
                        <div key={`gh${pct}`} className="absolute left-0 right-0 h-px"
                          style={{ top: `${pct}%`, background: 'rgba(255,255,255,0.12)' }} />
                      );
                    })}
                  </>
                )}
                {showThirds && (
                  <>
                    {[33.33, 66.67].map(pct => (
                      <div key={`t${pct}`} className="absolute top-0 bottom-0 w-px"
                        style={{ left: `${pct}%`, background: 'rgba(0,255,136,0.35)' }} />
                    ))}
                    {[33.33, 66.67].map(pct => (
                      <div key={`tt${pct}`} className="absolute left-0 right-0 h-px"
                        style={{ top: `${pct}%`, background: 'rgba(0,255,136,0.35)' }} />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* alignment guides (while dragging) */}
            {guides.v !== null && (
              <div className="absolute top-0 bottom-0 w-px pointer-events-none" style={{ left: `${guides.v}%`, background: 'var(--color-primary)', boxShadow: '0 0 6px var(--color-primary)', zIndex: 40 }} />
            )}
            {guides.h !== null && (
              <div className="absolute left-0 right-0 h-px pointer-events-none" style={{ top: `${guides.h}%`, background: 'var(--color-primary)', boxShadow: '0 0 6px var(--color-primary)', zIndex: 40 }} />
            )}
            {/* polygon drawing overlay — viewBox 0..100 (SVG points can't use %) */}
            {(drawing || toolMode !== 'draw') && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ zIndex: 50 }}
              >
                <polyline
                  points={drawPts.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
                  fill={toolMode === 'draw' && drawPts.length >= 3 ? 'rgba(0,255,136,0.12)' : 'none'}
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {toolMode === 'draw' && drawPts.length >= 3 && (
                  <line
                    x1={drawPts[drawPts.length - 1].x * 100} y1={drawPts[drawPts.length - 1].y * 100}
                    x2={drawPts[0].x * 100} y2={drawPts[0].y * 100}
                    stroke="var(--color-primary)" strokeOpacity="0.5" strokeDasharray="4 4"
                    strokeWidth="2" vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            )}
            {(drawing || toolMode !== 'draw') && drawPts.map((p, i) => {
              if (toolMode !== 'draw' && i % 4 !== 0 && i !== drawPts.length - 1) return null;
              return (
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
              );
            })}
            </div>{/* /zoom-pan layer */}
          </div>

          {drawing && (
            <p className="font-mono text-[10px] text-gray-500 text-center">
              кликайте по канвасу чтобы добавить точки → «ГОТОВО» или Enter чтобы закрыть фигуру
            </p>
          )}
          {photoEditId && (
            <div className="glass rounded-lg px-3 py-2 flex items-center justify-between gap-3 flex-wrap shrink-0">
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
        </div>

        <CollageInspector {...ui} />
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
