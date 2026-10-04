/**
 * Shared props bag for CollageToolbar / CollageInspector.
 * Keeps PhotoCollage.tsx focused on canvas + state.
 */
import type * as React from 'react';
import type { CollagePage, Zone, ImgItem, FormatId, Orientation, BgTexture, Pt, ShapeType } from './types';
import type { ImageFormat } from '../utils/collageExport';
import type { ProjectVersion } from '../utils/collageStore';

export type Updater<T> = T | ((prev: T) => T);

export interface WatermarkState {
  dataUrl: string;
  opacity: number;
  corner: 'tl' | 'tr' | 'bl' | 'br' | 'center';
  scale: number;
  img?: HTMLImageElement;
}

export interface CollageUIProps {
  // page / formats
  page: CollagePage;
  pages: CollagePage[];
  fmt: { w: number; h: number };
  fmtDef: { label: string; flippable?: boolean; locked?: Orientation };
  canFlip: boolean;
  format: FormatId;
  orient: Orientation;
  customW: number;
  customH: number;
  formatMenuOpen: boolean;
  orientMenuOpen: boolean;
  setFormatMenuOpen: (v: Updater<boolean>) => void;
  setOrientMenuOpen: (v: Updater<boolean>) => void;
  setFormat: (f: FormatId) => void;
  setOrient: (o: Orientation) => void;
  setCustomW: (v: number) => void;
  setCustomH: (v: number) => void;

  // tools / drawing
  toolMode: 'draw' | 'lasso' | 'brush';
  setToolMode: (m: Updater<'draw' | 'lasso' | 'brush'>) => void;
  drawing: boolean;
  setDrawing: (v: Updater<boolean>) => void;
  drawPts: Pt[];
  setDrawPts: (v: Updater<Pt[]>) => void;
  finishPolygon: () => void;
  addShape: (t: ShapeType) => void;
  addTextZone: () => void;
  addBadgeZone: () => void;
  addArtZone: (key: string) => void;
  shapeMenuOpen: boolean;
  setShapeMenuOpen: (v: Updater<boolean>) => void;

  // undo
  undo: () => void;
  redo: () => void;
  histIdx: number;
  history: Zone[][];

  // zones / selection
  zones: Zone[];
  sel: Zone | null;
  selId: string | null;
  setSelId: (id: string | null) => void;
  updateZone: (id: string, patch: Partial<Zone>, commit?: boolean) => void;
  setZones: (u: Zone[] | ((p: Zone[]) => Zone[]), commit?: boolean) => void;
  removeZone: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  alignZone: (id: string, how: 'l' | 'c' | 'r' | 't' | 'm' | 'b') => void;
  distributeZones: (axis: 'x' | 'y') => void;

  // photo / canvas
  photoEditId: string | null;
  setPhotoEditId: (v: Updater<string | null>) => void;
  zoomPhoto: (id: string, factor: number, commit?: boolean) => void;
  bgColor: string;
  bgTransparent: boolean;
  outerRadius: number;
  setBgColor: (v: string) => void;
  setBgTransparent: (v: boolean) => void;
  setBgTexture: (v: BgTexture) => void;
  setOuterRadius: (v: number) => void;
  exportScale: 1 | 2;
  setExportScale: (s: 1 | 2) => void;

  // text extras
  pathDraft: Pt[] | null;
  setPathDraft: (v: Updater<Pt[] | null>) => void;

  // versions / watermark
  versions: ProjectVersion[];
  saveVersion: () => void;
  restoreVersion: (v: ProjectVersion) => void;
  deleteVersion: (id: string) => void;
  wm: WatermarkState | null;
  setWm: (v: Updater<WatermarkState | null>) => void;
  wmInputRef: React.RefObject<HTMLInputElement>;

  // export
  exportMenuOpen: boolean;
  setExportMenuOpen: (v: Updater<boolean>) => void;
  imgFormat: ImageFormat;
  setImgFormat: (f: ImageFormat) => void;
  imgQuality: number;
  setImgQuality: (n: number) => void;
  exportImage: () => void;
  exportPdfScope: (s: 'current' | 'all') => void;
  exportPptxScope: (s: 'current' | 'all') => void;
  exportZip: () => void;
  isBusy: boolean;

  // compare
  comparePct: number | null;
  setComparePct: (v: Updater<number | null>) => void;

  // view
  viewZoom: number;
  zoomAtCenter: (f: number) => void;
  fitView: () => void;
  showGrid: boolean;
  setShowGrid: (v: Updater<boolean>) => void;
  showThirds: boolean;
  setShowThirds: (v: Updater<boolean>) => void;
  gridStep: number;
  setGridStep: (n: number) => void;

  // images
  images: ImgItem[];
}
