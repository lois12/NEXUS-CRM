/** Экспорт анимированного WebP: кадры кодируются через toBlob('image/webp'),
 *  VP8-битстримы переносятся в контейнер RIFF/WEBP (VP8X + ANIM + ANMF).
 *  Выходит заметно легче GIF при том же размере. */
import { drawFrame, FrameState } from './framePresets';

export interface WebpOptions {
  seconds?: number;
  fps?: number;
  maxDim?: number;
  quality?: number; // 0.5..1
}

const WEBP_BG = undefined; // прозрачный фон — углы без «чёрного квадрата»

interface WebpFrame { vp8: Uint8Array | null; vp8l: Uint8Array | null; alph: Uint8Array | null }

/** Достаёт VP8/VP8L (+ALPH, если есть) из статичного WebP (RIFF/WEBP) */
function extractFrame(buf: ArrayBuffer): WebpFrame | null {
  const dv = new DataView(buf);
  if (dv.byteLength < 20) return null;
  const tag = (o: number) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return null;
  let vp8: Uint8Array | null = null;
  let vp8l: Uint8Array | null = null;
  let alph: Uint8Array | null = null;
  let off = 12;
  while (off + 8 <= dv.byteLength) {
    const fourcc = tag(off);
    const size = dv.getUint32(off + 4, true);
    const payload = off + 8;
    if (payload + size <= dv.byteLength) {
      if (fourcc === 'VP8 ') vp8 = new Uint8Array(buf, payload, size);
      if (fourcc === 'VP8L') vp8l = new Uint8Array(buf, payload, size);
      if (fourcc === 'ALPH') alph = new Uint8Array(buf, payload, size);
    }
    off = payload + size + (size % 2);
  }
  return vp8 || vp8l ? { vp8, vp8l, alph } : null;
}

/** Собирает чанк 4cc + payload (+ паддинг) */
function riffChunk(fourcc: string, payload: Uint8Array): Uint8Array {
  const head = new Uint8Array(8 + payload.length + (payload.length % 2));
  for (let i = 0; i < 4; i++) head[i] = fourcc.charCodeAt(i);
  new DataView(head.buffer).setUint32(4, payload.length, true);
  head.set(payload, 8);
  return head;
}

/** Собирает анимированный WebP из кадров (с альфой, если она была) */
function muxAnimWebp(frames: WebpFrame[], w: number, h: number, frameMs: number): Blob {
  const chunks: Uint8Array[] = [];
  const hasAlpha = frames.some((f) => f.alph || f.vp8l);

  // VP8X: анимация (0x02) + альфа (0x10) + размеры минус один
  const vp8x = new Uint8Array(10);
  vp8x[0] = hasAlpha ? 0x12 : 0x02;
  const w1 = w - 1;
  const h1 = h - 1;
  vp8x[4] = w1 & 0xff;
  vp8x[5] = (w1 >> 8) & 0xff;
  vp8x[6] = (w1 >> 16) & 0xff;
  vp8x[7] = h1 & 0xff;
  vp8x[8] = (h1 >> 8) & 0xff;
  vp8x[9] = (h1 >> 16) & 0xff;
  chunks.push(riffChunk('VP8X', vp8x));

  // ANIM: фон (BGRA) + зацикливание (0 = бесконечно)
  const anim = new Uint8Array(6);
  anim.set([0x0b, 0x0e, 0x17, 0xff], 0);
  chunks.push(riffChunk('ANIM', anim));

  // ANMF на каждый кадр
  for (const f of frames) {
    const header = new Uint8Array(16);
    header[6] = w1 & 0xff;
    header[7] = (w1 >> 8) & 0xff;
    header[8] = (w1 >> 16) & 0xff;
    header[9] = h1 & 0xff;
    header[10] = (h1 >> 8) & 0xff;
    header[11] = (h1 >> 16) & 0xff;
    header[12] = frameMs & 0xff;
    header[13] = (frameMs >> 8) & 0xff;
    header[14] = (frameMs >> 16) & 0xff;
    header[15] = 0x02; // без блендинга — кадры непрозрачные поверх
    const parts: Uint8Array[] = [header];
    if (f.alph && f.vp8) parts.push(riffChunk('ALPH', f.alph));
    if (f.vp8l) parts.push(riffChunk('VP8L', f.vp8l));
    else if (f.vp8) parts.push(riffChunk('VP8 ', f.vp8));
    let len = 0;
    for (const p of parts) len += p.length;
    const sub = new Uint8Array(len);
    let pos = 0;
    for (const p of parts) {
      sub.set(p, pos);
      pos += p.length;
    }
    chunks.push(riffChunk('ANMF', sub));
  }

  // склейка с заголовком RIFF
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(12 + total);
  const od = new DataView(out.buffer);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  od.setUint32(4, out.length - 8, true);
  out.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  let pos = 12;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return new Blob([out.buffer], { type: 'image/webp' });
}

export async function exportFrameWebp(state: FrameState, opts: WebpOptions = {}): Promise<Blob> {
  const { seconds = 3.5, fps = 15, maxDim = 800, quality = 0.9 } = opts;
  const { preset } = state;
  const k = Math.min(1, maxDim / Math.max(preset.w, preset.h));
  const gw = Math.max(2, Math.round(preset.w * k));
  const gh = Math.max(2, Math.round(preset.h * k));

  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D недоступен');

  const frameCount = Math.max(2, Math.round(seconds * fps));
  const frameMs = Math.round(1000 / fps);
  const frames: WebpFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const t = (i * 1000) / fps;
    drawFrame(ctx, gw, gh, state, t, WEBP_BG);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality));
    if (blob) {
      const raw = extractFrame(await blob.arrayBuffer());
      if (raw) {
        frames.push({
          vp8: raw.vp8 ? new Uint8Array(raw.vp8) : null,
          vp8l: raw.vp8l ? new Uint8Array(raw.vp8l) : null,
          alph: raw.alph ? new Uint8Array(raw.alph) : null,
        });
      }
    }
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }
  if (!frames.length) throw new Error('WebP-кодирование недоступно');

  return muxAnimWebp(frames, gw, gh, frameMs);
}
