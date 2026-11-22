/**
 * PDF → DOCX / PPTX через текстовый слой (pdfjs-dist).
 * Почему не LibreOffice: PDF открывается как Draw-документ, а Draw не экспортирует
 * в DOCX/PPTX (LO отчитывается об успехе, файл не создаёт). Поэтому берём текст
 * постранично и собираем документы библиотеками docx / pptxgenjs.
 */
import { Document, Packer, Paragraph, TextRun, PageBreak } from 'docx';
import pptxgen from 'pptxgenjs';
import { loadPdfjs, standardFontDataUrl } from './pdfTableExtract';

/**
 * Чистка извлечённого текста:
 * - pdfjs отдаёт «й» как «и» + служебный 0x0F (баг маппинга глифа) → восстанавливаем;
 * - убираем управляющие символы 0x00–0x1F — они ломают XML в DOCX/PPTX.
 */
function sanitizeLine(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === 0x0f) {
      const prev = out[out.length - 1];
      if (prev === 'и') { out = out.slice(0, -1) + 'й'; continue; }
      if (prev === 'И') { out = out.slice(0, -1) + 'Й'; continue; }
      continue;
    }
    if (code < 0x20 && code !== 0x09) continue;
    if (code === 0x7f) continue;
    out += s[i];
  }
  return out;
}

/** Страницы → строки текста (кластеризация по Y-координате baseline) */
export async function extractPdfPageLines(data: Uint8Array): Promise<string[][]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, standardFontDataUrl: standardFontDataUrl() }).promise;
  const pages: string[][] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const pts = (tc.items as any[])
      .filter(it => typeof it.str === 'string' && it.str.length > 0)
      .map(it => ({ x: Number(it.transform?.[4]) || 0, y: Number(it.transform?.[5]) || 0, s: String(it.str) }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    // группы по y с допуском 2.5pt — одна строка
    const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
    for (const pt of pts) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.y - pt.y) <= 2.5) last.parts.push(pt);
      else rows.push({ y: pt.y, parts: [pt] });
    }
    const lines = rows
      .map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join('').replace(/\s+/g, ' ').trim())
      .map(sanitizeLine)
      .filter(Boolean);
    pages.push(lines);
    try { page.cleanup(); } catch { /* noop */ }
  }
  return pages;
}

function assertHasText(pages: string[][]) {
  if (!pages.some(p => p.length > 0)) throw new Error('PDF_NO_TEXT');
}

/** PDF → DOCX: абзац на строку, разрыв страницы между страницами PDF */
export async function pdfToDocxBuffer(data: Uint8Array): Promise<Buffer> {
  const pages = await extractPdfPageLines(data);
  assertHasText(pages);

  const children: Paragraph[] = [];
  pages.forEach((lines, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    if (lines.length === 0) {
      children.push(new Paragraph({ children: [new TextRun('—')] }));
      return;
    }
    for (const line of lines) {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  });

  const doc = new Document({
    sections: [{ children }],
    title: 'NEXUS export',
  });
  return Packer.toBuffer(doc);
}

/** PDF → PPTX: одна слайд-страница на страницу PDF (длинные — с переносом) */
export async function pdfToPptxBuffer(data: Uint8Array): Promise<Buffer> {
  const pages = await extractPdfPageLines(data);
  assertHasText(pages);

  const pres = new pptxgen();
  pres.author = 'NEXUS CRM';
  pres.title = 'NEXUS export';
  const LINES_PER_SLIDE = 16;

  for (const lines of pages) {
    const chunks: string[][] = [];
    for (let i = 0; i < Math.max(lines.length, 1); i += LINES_PER_SLIDE) {
      chunks.push(lines.slice(i, i + LINES_PER_SLIDE));
    }
    for (const chunk of chunks) {
      const slide = pres.addSlide();
      slide.background = { color: 'FFFFFF' };
      slide.addText(chunk.length ? chunk.join('\n') : ' ', {
        x: 0.4, y: 0.3, w: 9.2, h: 5.0,
        fontSize: 14, color: '1A1A1A', fontFace: 'Arial',
        valign: 'top', wrap: true,
      });
    }
  }

  const out = await pres.write({ outputType: 'nodebuffer' });
  return out as Buffer;
}
