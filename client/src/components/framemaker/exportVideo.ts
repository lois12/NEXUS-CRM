/** Экспорт короткого видео через MediaRecorder — запись с реального холста */
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

/**
 * MP4 (H.264) первым: файл открывается везде.
 * webm из MediaRecorder часто без Duration — плееры Windows/Telegram его не запускают.
 */
function pickMime(): string | undefined {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

/** Расширение файла по MIME (без параметров codecs) */
export function extForMime(mime: string | undefined): string {
  const base = (mime || '').split(';')[0].trim();
  if (base === 'video/mp4') return 'mp4';
  if (base === 'video/webm') return 'webm';
  return 'webm';
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
  const recorder = new MediaRecorder(
    stream,
    mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined,
  );
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise<Blob | null>((resolve) => {
    recorder.onstop = () => {
      const base = (mime || 'video/webm').split(';')[0];
      resolve(chunks.length ? new Blob(chunks, { type: base }) : null);
    };
  });

  recorder.start(100); // timeslice — финальный чанк гарантированно доезжает
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
  // небольшая пауза, чтобы последние кадры попали в поток
  await new Promise((r) => setTimeout(r, 150));
  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());

  return done;
}
