import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';

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

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
