// Canvas/CSS text typography helpers
import type { Zone, TextAlign, ZoneFilters } from './types';

export function cssFilter(f?: ZoneFilters): string {
  if (!f) return 'none';
  const parts: string[] = [];
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
  if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`);
  return parts.length ? parts.join(' ') : 'none';
}

export function cssTextShadow(z: Zone): string | undefined {
  if (z.textShadow) {
    const s = z.textShadow;
    return `${s.x}px ${s.y}px ${s.blur}px ${s.color}`;
  }
  if (z.stroke && z.stroke.width > 0) return 'none';
  return '0 1px 4px rgba(0,0,0,0.35)';
}

/** apply kapital / spacing / gradient to a canvas text fill */
export function textFillStyle(ctx: CanvasRenderingContext2D, z: Zone, x: number, y: number, w: number, h: number): string | CanvasGradient {
  if (z.textGradient) {
    const a = ((z.textGradient.angle || 90) * Math.PI) / 180;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.max(w, h) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.addColorStop(0, z.textGradient.from);
    g.addColorStop(1, z.textGradient.to);
    return g;
  }
  return z.fontColor || '#ffffff';
}

export function applySmallCaps(text: string, on: boolean | undefined): string {
  if (!on) return text;
  // CSS/Canvas small-caps: lowercase → small capitals. Approximate with uppercase
  // but keep original capitals larger via font style — canvas has no mixed size,
  // so we use unicode-style: lowercase mapped to upper (visual kapital).
  return text.replace(/[a-zа-яё]/g, ch => ch.toUpperCase());
}

export function measureTracked(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  if (!tracking) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return Math.max(0, w - tracking);
}

export function fillTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number, align: TextAlign) {
  if (!tracking) { ctx.fillText(text, x, y); return; }
  const total = measureTracked(ctx, text, tracking);
  let cx = x;
  if (align === 'center') cx = x - total / 2;
  if (align === 'right') cx = x - total;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = prev;
}

export function strokeTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number, align: TextAlign) {
  if (!tracking) { ctx.strokeText(text, x, y); return; }
  const total = measureTracked(ctx, text, tracking);
  let cx = x;
  if (align === 'center') cx = x - total / 2;
  if (align === 'right') cx = x - total;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.strokeText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = prev;
}

/** Draw one line along an arc. curveDeg>0 = smile, <0 = frown */
export function drawCurvedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  tracking: number,
  curveDeg: number,
  fill: string | CanvasGradient,
  strokeCfg?: { width: number; color: string },
) {
  const chars = [...text];
  if (!chars.length) return;
  const widths = chars.map(ch => ctx.measureText(ch).width + tracking);
  const totalW = widths.reduce((a, b) => a + b, 0) - (widths.length ? tracking : 0);
  const sweep = (curveDeg * Math.PI) / 180;
  // radius so that arc length ≈ totalW
  const R = Math.max(px, totalW / Math.max(Math.abs(sweep), 0.01));
  const dir = curveDeg >= 0 ? 1 : -1;
  // start angle so the string is centered
  let a = -sweep / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) {
    const cw = widths[i];
    const mid = a + (cw / R) / 2;
    const px0 = x + Math.sin(mid) * R * dir;
    // smile: center of arc below text → y = y + R - cos*R
    const py0 = dir > 0 ? y + px / 2 + R - Math.cos(mid) * R : y + px / 2 - R + Math.cos(mid) * R;
    ctx.save();
    ctx.translate(px0, py0);
    ctx.rotate(dir > 0 ? mid : mid + Math.PI);
    ctx.textAlign = 'center';
    if (strokeCfg && strokeCfg.width > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeCfg.width * px * 2;
      ctx.strokeStyle = strokeCfg.color;
      ctx.strokeText(chars[i], 0, 0);
    }
    ctx.fillStyle = fill;
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    a += cw / R;
  }
  ctx.textAlign = prevAlign;
  ctx.textBaseline = 'top';
}

/** Draw text along a freeform polyline path (zone-relative 0..1 → W/H) */
export function drawPathLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  z: Zone,
  px: number,
  tracking: number,
  fill: string | CanvasGradient,
  strokeCfg: { width: number; color: string } | undefined,
  W: number,
  H: number,
) {
  const path = z.textPath!;
  const pts = path.map(p => ({ x: (z.x + p.x * z.w) * W, y: (z.y + p.y * z.h) * H }));
  // cumulative length
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push(d);
    total += d;
  }
  if (total <= 0) return;
  const chars = [...text];
  const widths = chars.map(ch => ctx.measureText(ch).width + tracking);
  const need = widths.reduce((a, b) => a + b, 0);
  const s = total / Math.max(need, 1);
  let travel = 0;
  const prevAlign = ctx.textAlign;
  const prevBase = ctx.textBaseline;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) {
    const cw = widths[i];
    const midT = (travel + cw / 2) * s;
    // find point + angle at midT
    let acc = 0;
    let px0 = pts[0].x, py0 = pts[0].y, ang = 0;
    for (let j = 1; j < pts.length; j++) {
      if (acc + segs[j - 1] >= midT || j === pts.length - 1) {
        const t = segs[j - 1] > 0 ? (midT - acc) / segs[j - 1] : 0;
        px0 = pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t;
        py0 = pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t;
        ang = Math.atan2(pts[j].y - pts[j - 1].y, pts[j].x - pts[j - 1].x);
        break;
      }
      acc += segs[j - 1];
    }
    ctx.save();
    ctx.translate(px0, py0);
    ctx.rotate(ang);
    if (strokeCfg && strokeCfg.width > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeCfg.width * px * 2;
      ctx.strokeStyle = strokeCfg.color;
      ctx.strokeText(chars[i], 0, 0);
    }
    ctx.fillStyle = fill;
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    travel += cw;
  }
  ctx.textAlign = prevAlign;
  ctx.textBaseline = prevBase;
}
