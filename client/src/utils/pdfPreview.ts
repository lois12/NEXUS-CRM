import * as pdfjsLib from 'pdfjs-dist';
// Vite serves the worker as a URL — no Node.js APIs needed in the browser
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - ?url is a Vite feature
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let workerConfigured = false;

function ensureWorker() {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }
}

/** Render each page of a PDF to a data-URL thumbnail (JPEG for size). */
export async function renderPdfPages(
  file: File,
  opts: { scale?: number; maxPages?: number; quality?: number } = {}
): Promise<{ index: number; dataUrl: string; width: number; height: number }[]> {
  ensureWorker();
  const { scale = 0.5, maxPages = 50, quality = 0.7 } = opts;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages: { index: number; dataUrl: string; width: number; height: number }[] = [];
  const count = Math.min(doc.numPages, maxPages);

  for (let i = 1; i <= count; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    // pdfjs v6 RenderParameters requires both canvas and canvasContext
    await page.render({ canvas, canvasContext: ctx, viewport }).promise as unknown as Promise<void>;
    pages.push({
      index: i,
      dataUrl: canvas.toDataURL('image/jpeg', quality),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return pages;
}

export async function getPdfPageCount(file: File): Promise<number> {
  ensureWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise;
  return doc.numPages;
}
