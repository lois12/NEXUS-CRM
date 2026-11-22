/** Экспорт короткого видео через MediaRecorder (webm) — запись с реального холста */
import { FrameState, drawFrame } from './framePresets';

export interface VideoOptions {
  seconds?: number;
  fps?: number;
}

export function videoSupported(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof (HTMLCanvasElement.prototype as any).captureStream === 'function';
}

function pickMime(): string | undefined {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

/**
 * Записывает анимацию кадра в видео. Возвращает null, если браузер не поддерживает.
 * Рисует на отдельном холсте — превью не мерцает.
 */
export async function exportFrameVideo(state: FrameState, opts: VideoOptions = {}): Promise<Blob | null> {
  const { seconds = 4, fps = 30 } = opts;
  if (!videoSupported()) return null;
  const mime = pickMime();

  const canvas = document.createElement('canvas');
  canvas.width = state.preset.w;
  canvas.height = state.preset.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise<Blob | null>((resolve) => {
    recorder.onstop = () => {
      resolve(chunks.length ? new Blob(chunks, { type: mime || 'video/webm' }) : null);
    };
  });

  recorder.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const step = () => {
      const elapsed = performance.now() - start;
      drawFrame(ctx, canvas.width, canvas.height, state, elapsed);
      if (elapsed >= seconds * 1000) { resolve(); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());

  return done;
}
