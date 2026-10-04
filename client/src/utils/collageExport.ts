import { PDFDocument, rgb } from 'pdf-lib';
import PptxGenJS from 'pptxgenjs';

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface WatermarkSpec {
  dataUrl: string;
  opacity: number; // 0..1
  corner: 'tl' | 'tr' | 'bl' | 'br' | 'center';
  /** size as fraction of min(pageW, pageH) */
  scale: number;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Flatten alpha onto white (JPEG has no alpha) */
function flattenOnWhite(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality = 0.92): Promise<Blob> {
  // PNG and WebP keep alpha — only JPEG has no transparency
  const src = format === 'jpeg' ? flattenOnWhite(canvas) : canvas;
  const mime = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  return new Promise((resolve, reject) => {
    src.toBlob(b => b ? resolve(b) : reject(new Error('Canvas → blob failed')), mime, quality);
  });
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, format: ImageFormat, quality = 0.92): string {
  const src = format === 'jpeg' ? flattenOnWhite(canvas) : canvas;
  const mime = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  return src.toDataURL(mime, quality);
}

/** Draw watermark/logo over the page (call after all zones) */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  wm: WatermarkSpec,
  img: HTMLImageElement,
) {
  const minSide = Math.min(W, H);
  const w = minSide * wm.scale;
  const h = w * (img.height / img.width || 1);
  const pad = minSide * 0.03;
  let x = pad, y = pad;
  if (wm.corner === 'tr') { x = W - w - pad; y = pad; }
  else if (wm.corner === 'bl') { x = pad; y = H - h - pad; }
  else if (wm.corner === 'br') { x = W - w - pad; y = H - h - pad; }
  else if (wm.corner === 'center') { x = (W - w) / 2; y = (H - h) / 2; }
  ctx.save();
  ctx.globalAlpha = wm.opacity;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

export async function exportPdf(
  pages: { canvas: HTMLCanvasElement; wPt: number; hPt: number; transparent?: boolean }[],
  name: string,
) {
  const pdf = await PDFDocument.create();
  for (const p of pages) {
    const png = await canvasToBlob(p.canvas, 'png');
    const bytes = new Uint8Array(await png.arrayBuffer());
    const img = await pdf.embedPng(bytes);
    const pg = pdf.addPage([p.wPt, p.hPt]);
    if (p.transparent) {
      pg.drawRectangle({ x: 0, y: 0, width: p.wPt, height: p.hPt, color: rgb(1, 1, 1) });
    }
    pg.drawImage(img, { x: 0, y: 0, width: p.wPt, height: p.hPt });
  }
  const out = await pdf.save();
  downloadBlob(new Blob([out as unknown as BlobPart], { type: 'application/pdf' }), name);
}

/** PPTX: one slide per page, image full-bleed. Layout = first page size. */
export async function exportPptx(
  pages: { canvas: HTMLCanvasElement; wPt: number; hPt: number }[],
  name: string,
) {
  const pptx = new PptxGenJS();
  const first = pages[0];
  const layoutW = first.wPt / 72; // pt → inches
  const layoutH = first.hPt / 72;
  pptx.defineLayout({ name: 'COLLAGE', width: layoutW, height: layoutH });
  pptx.layout = 'COLLAGE';

  for (const p of pages) {
    const slide = pptx.addSlide();
    const data = canvasToDataUrl(p.canvas, 'png');
    // fit into slide keeping aspect (mixed page sizes)
    const sw = p.wPt / 72;
    const sh = p.hPt / 72;
    const scale = Math.min(layoutW / sw, layoutH / sh, 1);
    const iw = sw * scale;
    const ih = sh * scale;
    slide.addImage({
      data,
      x: (layoutW - iw) / 2,
      y: (layoutH - ih) / 2,
      w: iw,
      h: ih,
    });
  }
  await pptx.writeFile({ fileName: name });
}
