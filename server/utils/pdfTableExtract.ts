import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

// pdfjs-dist v6 is ESM-only — load via dynamic import (works in CJS output via Node)
// Text extraction needs no canvas; worker falls back to fake worker in Node.
let pdfjsLib: any = null;

async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib = mod;
  // Point worker to the bundled file so Node can spawn/fallback correctly
  try {
    if (mod.GlobalWorkerOptions && !mod.GlobalWorkerOptions.workerSrc) {
      const workerPath = path.join(
        path.dirname(require.resolve('pdfjs-dist/package.json')),
        'legacy', 'build', 'pdf.worker.mjs'
      );
      mod.GlobalWorkerOptions.workerSrc = workerPath;
    }
  } catch { /* worker fallback is fine for text extraction */ }
  return pdfjsLib;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/**
 * Extract tables from a PDF's text layer by clustering text items
 * into rows (by y) and columns (by x gaps). Works well for native
 * digital text PDFs; scanned PDFs without a text layer yield nothing.
 */
export async function pdfToXlsxBuffer(pdfPath: string): Promise<Buffer> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  const workbook = new ExcelJS.Workbook();

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as TextItem[]).filter(it => (it.str || '').trim().length > 0);

    const rows = clusterRows(items);
    const sheet = workbook.addWorksheet(`Страница ${p}`);

    for (const row of rows) {
      const cols = clusterColumns(row.items);
      sheet.addRow(cols.map(c => c.text));
    }
    if (rows.length === 0) {
      sheet.addRow(['(нет текстового слоя на странице)']);
    }
    sheet.columns.forEach(col => { col.width = 18; });
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

interface RowCluster {
  y: number;
  items: TextItem[];
}

function clusterRows(items: TextItem[]): RowCluster[] {
  // TextItem transform: [scaleX, skewX, skewY, scaleY, x, y]
  const sorted = [...items].sort((a, b) => getY(b) - getY(a) || getX(a) - getX(b));
  const rows: RowCluster[] = [];
  const Y_TOLERANCE = 3;

  for (const it of sorted) {
    const y = getY(it);
    let row = rows.find(r => Math.abs(r.y - y) <= Y_TOLERANCE);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push(it);
  }
  // Top-to-bottom reading order
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

function clusterColumns(items: TextItem[]): { text: string; x: number }[] {
  const sorted = [...items].sort((a, b) => getX(a) - getX(b));
  const cols: { text: string; x: number }[] = [];
  const X_GAP = 12; // points — a gap larger than this starts a new column

  let current = { text: '', x: 0 };
  let lastEndX = -Infinity;

  for (const it of sorted) {
    const x = getX(it);
    const str = it.str;
    if (current.text && (x - lastEndX) > X_GAP) {
      cols.push(current);
      current = { text: str.trim(), x };
    } else {
      const needsSpace = current.text && (x - lastEndX) > 2;
      current.text += (needsSpace ? ' ' : '') + str;
      if (!current.x) current.x = x;
    }
    lastEndX = x + (it.width || 0);
  }
  if (current.text) cols.push(current);
  return cols.map(c => ({ text: c.text.trim(), x: c.x }));
}

function getY(it: TextItem): number {
  return it.transform?.[5] ?? 0;
}
function getX(it: TextItem): number {
  return it.transform?.[4] ?? 0;
}
