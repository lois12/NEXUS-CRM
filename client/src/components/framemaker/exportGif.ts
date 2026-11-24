/** Экспорт кадров в GIF через gifenc: одна палитра на весь файл + непрозрачный фон */
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { drawFrame, FrameState } from './framePresets';

export interface GifOptions {
  seconds?: number; // длительность цикла
  fps?: number;
  maxDim?: number; // максимальная сторона (GIF на мобиле — 720–800px достаточно)
}

/** Непрозрачный фон: прозрачные углы квантуются в «мусор» и дают искажения */
const GIF_BG = '#0b0e17';

export async function exportFrameGif(state: FrameState, opts: GifOptions = {}): Promise<Blob> {
  const { seconds = 3.5, fps = 15, maxDim = 800 } = opts;
  const { preset } = state;
  const k = Math.min(1, maxDim / Math.max(preset.w, preset.h));
  const gw = Math.max(2, Math.round(preset.w * k));
  const gh = Math.max(2, Math.round(preset.h * k));

  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;
  // getImageData в двух проходах — подсказываем браузеру оптимизировать readback
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D недоступен');

  const frameCount = Math.max(2, Math.round(seconds * fps));
  const delay = Math.round(1000 / fps);

  // ── проход 1: собираем сэмплы пикселей с нескольких кадров ──
  const samples: number[] = [];
  const pxStride = 4 * 3; // каждый 3-й пиксель
  for (let i = 0; i < frameCount; i++) {
    if (i % 2 === 0) {
      const t = (i * 1000) / fps;
      drawFrame(ctx, gw, gh, state, t, GIF_BG);
      const d = ctx.getImageData(0, 0, gw, gh).data;
      for (let p = 0; p < d.length; p += pxStride) {
        samples.push(d[p], d[p + 1], d[p + 2], 255);
      }
    }
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }
  // одна палитра на весь GIF — цвета не «мигают» между кадрами
  const palette = quantize(new Uint8Array(samples), 256);

  // ── проход 2: кодируем кадры общей палитрой ──
  const gif = GIFEncoder();
  for (let i = 0; i < frameCount; i++) {
    const t = (i * 1000) / fps;
    drawFrame(ctx, gw, gh, state, t, GIF_BG);
    const { data } = ctx.getImageData(0, 0, gw, gh);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, gw, gh, { palette, delay });
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();

  const bytes = gif.bytes();
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'image/gif',
  });
}
