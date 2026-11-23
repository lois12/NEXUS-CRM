/** Экспорт кадров в GIF через gifenc (без воркеров, быстрый) */
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { drawFrame, FrameState } from './framePresets';

export interface GifOptions {
  seconds?: number; // длительность цикла
  fps?: number;
  maxDim?: number; // максимальная сторона (GIF на мобиле — 720–800px достаточно)
}

export async function exportFrameGif(state: FrameState, opts: GifOptions = {}): Promise<Blob> {
  const { seconds = 3.5, fps = 15, maxDim = 800 } = opts;
  const { preset } = state;
  const k = Math.min(1, maxDim / Math.max(preset.w, preset.h));
  const gw = Math.max(2, Math.round(preset.w * k));
  const gh = Math.max(2, Math.round(preset.h * k));

  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;
  // getImageData каждый кадр — подсказываем браузеру оптимизировать readback
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D недоступен');

  const gif = GIFEncoder();
  const frameCount = Math.max(2, Math.round(seconds * fps));
  const delay = Math.round(1000 / fps);

  for (let i = 0; i < frameCount; i++) {
    const t = (i * 1000) / fps;
    drawFrame(ctx, gw, gh, state, t);
    const { data } = ctx.getImageData(0, 0, gw, gh);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, gw, gh, { palette, delay });
    // даём браузеру дышать между кадрами, чтобы UI не подвисал
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();

  const bytes = gif.bytes();
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'image/gif',
  });
}
