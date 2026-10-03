import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// ── PDF: merge ──
export async function mergePdfs(files: File[]): Promise<Blob> {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const src = await PDFDocument.load(await file.arrayBuffer());
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  const bytes = await merged.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// ── PDF: split by page ranges, e.g. "1-3,5" ──
export async function splitPdf(file: File, ranges: string): Promise<{ name: string; blob: Blob }[]> {
  const src = await PDFDocument.load(await file.arrayBuffer());
  const total = src.getPageCount();
  const parts = parseRanges(ranges, total);
  const results: { name: string; blob: Blob }[] = [];
  const base = file.name.replace(/\.pdf$/i, '');

  for (const [i, range] of parts.entries()) {
    const out = await PDFDocument.create();
    const indices = range.map(n => n - 1);
    const pages = await out.copyPages(src, indices);
    pages.forEach(p => out.addPage(p));
    const bytes = await out.save();
    results.push({
      name: `${base}_part${i + 1}.pdf`,
      blob: new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }),
    });
  }
  return results;
}

function parseRanges(input: string, total: number): number[][] {
  const groups: number[][] = [];
  for (const chunk of input.split(',').map(s => s.trim()).filter(Boolean)) {
    const pages: number[] = [];
    if (chunk.includes('-')) {
      const [a, b] = chunk.split('-').map(n => parseInt(n.trim(), 10));
      if (isNaN(a) || isNaN(b)) continue;
      for (let i = Math.max(1, a); i <= Math.min(total, b); i++) pages.push(i);
    } else {
      const n = parseInt(chunk, 10);
      if (!isNaN(n) && n >= 1 && n <= total) pages.push(n);
    }
    if (pages.length) groups.push(pages);
  }
  return groups.length ? groups : [Array.from({ length: total }, (_, i) => i + 1)];
}

// ── PDF: text watermark ──
export interface WatermarkOptions {
  text: string;
  opacity?: number;   // 0..1
  position?: 'center' | 'diagonal' | 'top' | 'bottom';
  fontSize?: number;
}

export async function watermarkPdf(file: File, opts: WatermarkOptions): Promise<Blob> {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const { text, opacity = 0.25, position = 'diagonal', fontSize = 48 } = opts;

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    let x = (width - textWidth) / 2;
    let y = height / 2 - fontSize / 2;
    let rotate = degrees(0);

    if (position === 'diagonal') {
      rotate = degrees(45);
      x = width / 2 - textWidth / 3;
      y = height / 3;
    } else if (position === 'top') {
      y = height - fontSize * 2;
    } else if (position === 'bottom') {
      y = fontSize;
    }

    page.drawText(text, {
      x, y, size: fontSize, font, rotate,
      opacity,
      color: rgb(0.4, 0.4, 0.4),
    });
  }
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// ── JPG/PNG images → single PDF ──
export async function imagesToPdf(files: File[]): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const isPng = file.type === 'image/png';
    const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    // Fit to A4-ish page while keeping aspect ratio
    const maxWidth = 595;
    const maxHeight = 842;
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    const page = doc.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// ── CSV ↔ XLSX via SheetJS (fully offline) ──
export function csvToXlsx(file: File): Promise<Blob> {
  return file.text().then(text => {
    const wb = XLSX.read(text, { type: 'string' });
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  });
}

export function xlsxToCsv(file: File): Promise<Blob> {
  return file.arrayBuffer().then(buf => {
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
    // BOM for Excel UTF-8 recognition
    return new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  });
}

// ── helpers ──
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── PDF: rotate all (or selected) pages ──
export async function rotatePdf(file: File, angle: 90 | 180 | 270, pages?: string): Promise<Blob> {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  const targets = pages ? parseRanges(pages, doc.getPageCount()).flat() : doc.getPages().map((_, i) => i + 1);
  for (const n of targets) {
    const page = doc.getPage(n - 1);
    const current = page.getRotation().angle % 360;
    page.setRotation(degrees((current + angle) % 360));
  }
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// ── PDF: organize — reorder / delete pages ──
// pageOrder: desired sequence of source page numbers (1-based); pages omitted are deleted
// rotations: optional per-output-page extra rotation
export async function organizePdf(file: File, pageOrder: number[], rotations: Record<number, number> = {}): Promise<Blob> {
  const src = await PDFDocument.load(await file.arrayBuffer());
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pageOrder.map(n => n - 1));
  copied.forEach((page, i) => {
    const extra = rotations[i] || 0;
    if (extra) {
      const current = page.getRotation().angle % 360;
      page.setRotation(degrees((current + extra) % 360));
    }
    out.addPage(page);
  });
  const bytes = await out.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// ── PDF: page numbers ──
export interface PageNumberOptions {
  position?: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
  startNumber?: number;
  fontSize?: number;
  opacity?: number;
  format?: 'n' | 'n/total' | 'Стр n из total';
}

export async function addPageNumbers(file: File, opts: PageNumberOptions = {}): Promise<Blob> {
  const {
    position = 'bottom-center', startNumber = 1, fontSize = 10,
    opacity = 0.7, format = 'n',
  } = opts;
  const doc = await PDFDocument.load(await file.arrayBuffer());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const num = startNumber + i;
    const text = format === 'n/total' ? `${num}/${total}`
      : format === 'Стр n из total' ? `Page ${num} of ${total}`
      : `${num}`;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const margin = 20;

    let x = margin;
    let y = margin;
    if (position.includes('center')) x = (width - textWidth) / 2;
    if (position.includes('right')) x = width - textWidth - margin;
    if (position.includes('top')) y = height - fontSize - margin;

    page.drawText(text, {
      x, y, size: fontSize, font, opacity,
      color: rgb(0.3, 0.3, 0.3),
    });
  });
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// ── PDF: crop margins (percent of page size) ──
export interface CropOptions {
  top: number; right: number; bottom: number; left: number; // percent 0..49
}

export async function cropPdf(file: File, opts: CropOptions): Promise<Blob> {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const x = (width * opts.left) / 100;
    const y = (height * opts.bottom) / 100;
    const w = width * (1 - (opts.left + opts.right) / 100);
    const h = height * (1 - (opts.top + opts.bottom) / 100);
    if (w > 0 && h > 0) {
      page.setCropBox(x, y, w, h);
      page.setMediaBox(x, y, w, h);
    }
  }
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// ── PDF: compress (object streams + strip junk) — modest gains ──
export async function compressPdf(file: File): Promise<{ blob: Blob; before: number; after: number }> {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  doc.setProducer('');
  doc.setCreator('');
  const out = await doc.save({ useObjectStreams: true });
  return {
    blob: new Blob([out as unknown as BlobPart], { type: 'application/pdf' }),
    before: bytes.byteLength,
    after: out.length,
  };
}

// ── ZIP download for batch results ──
export async function downloadZip(files: { name: string; blob: Blob }[], zipName = 'converted.zip'): Promise<void> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, await f.blob.arrayBuffer());
  }
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, zipName);
}

// ── PDF: place a drawn/typed signature image on every page ──
export interface SignOptions {
  /** data-URL PNG of the signature (from canvas) */
  signatureDataUrl: string;
  /** corner position */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** signature width as % of page width (5–40) */
  widthPercent?: number;
  /** pages to sign, e.g. "1-3,5"; empty = all */
  pages?: string;
}

export async function signPdf(file: File, opts: SignOptions): Promise<Blob> {
  const { signatureDataUrl, position = 'bottom-right', widthPercent = 25, pages } = opts;
  const doc = await PDFDocument.load(await file.arrayBuffer());
  const pngBytes = await fetch(signatureDataUrl).then(r => r.arrayBuffer());
  const sig = await doc.embedPng(pngBytes);

  const total = doc.getPageCount();
  const targets = pages ? parseRanges(pages, total).flat() : Array.from({ length: total }, (_, i) => i + 1);
  const margin = 24;

  for (const n of targets) {
    const page = doc.getPage(n - 1);
    const { width, height } = page.getSize();
    const w = (width * widthPercent) / 100;
    const h = (w * sig.height) / sig.width;
    let x = margin;
    let y = margin;
    if (position.includes('right')) x = width - w - margin;
    if (position.includes('top')) y = height - h - margin;
    page.drawImage(sig, { x, y, width: w, height: h, opacity: 0.9 });
  }
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// ── PDF: redact — draw permanent black boxes over regions ──
// regions are given in normalized coords (0..1) per page: { page: 1-based, x, y, w, h }
export interface RedactRegion {
  page: number;
  x: number; y: number; w: number; h: number;
}

export async function redactPdf(file: File, regions: RedactRegion[]): Promise<Blob> {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  for (const r of regions) {
    const page = doc.getPage(r.page - 1);
    if (!page) continue;
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: r.x * width,
      y: (1 - r.y - r.h) * height,
      width: r.w * width,
      height: r.h * height,
      color: rgb(0, 0, 0),
    });
  }
  const bytes = await doc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

// ── helpers ──

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
