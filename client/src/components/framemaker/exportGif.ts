/** Экспорт кадров в GIF через gifenc: одна палитра на весь файл,
 *  прозрачные углы через ключевой цвет (magenta) + transparentIndex. */
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { drawFrame, FrameState } from './framePresets';

export interface GifOptions {
  seconds?: number; // длительность цикла
  fps?: number;
  maxDim?: number; // максимальная сторона (GIF на мобиле — 720–800px достаточно)
}

/** Ключ: прозрачные пиксели сплющиваем в magenta, потом помечаем этот индекс прозрачным */
const KEY: [number, number, number] = [255, 0, 255];

function flattenAlpha(data: Uint8ClampedArray) {
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] < 128) {
      data[p] = KEY[0];
      data[p + 1] = KEY[1];
      data[p + 2] = KEY[2];
      data[p + 3] = 255;
    }
  }
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
      drawFrame(ctx, gw, gh, state, t);
      const d = ctx.getImageData(0, 0, gw, gh).data;
      flattenAlpha(d);
      for (let p = 0; p < d.length; p += pxStride) {
        samples.push(d[p], d[p + 1], d[p + 2], 255);
      }
    }
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }
  // одна палитра на весь GIF — цвета не «мигают» между кадрами
  const palette = quantize(new Uint8Array(samples), 256);
  const keyIdx = palette.findIndex((c: number[]) => c[0] === KEY[0] && c[1] === KEY[1] && c[2] === KEY[2]);

  // ── проход 2: кодируем кадры общей палитрой ──
  const gif = GIFEncoder();
  for (let i = 0; i < frameCount; i++) {
    const t = (i * 1000) / fps;
    drawFrame(ctx, gw, gh, state, t);
    const { data } = ctx.getImageData(0, 0, gw, gh);
    flattenAlpha(data);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, gw, gh, {
      palette,
      delay,
      ...(keyIdx >= 0 ? { transparent: true, transparentIndex: keyIdx } : {}),
    });
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();

  const bytes = gif.bytes();
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'image/gif',
  });
}
