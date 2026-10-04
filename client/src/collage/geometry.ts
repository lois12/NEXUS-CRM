// Shape geometry, clip-paths, canvas traces
import type { Pt, Zone, ShapeType, FitMode } from './types';

export function clamp(v: number, a: number, b: number) { return Math.min(b, Math.max(a, v)); }

export function sampleCurve(fn: (t: number) => Pt, n = 48): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) pts.push(fn(i / n));
  return pts;
}

export function regularPoly(n: number, rot = -Math.PI / 2, r = 0.5): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + rot;
    pts.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) });
  }
  return pts;
}

export function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return pts;
}

/** Unit-shape polygon points (0..1 inside the zone bbox) for decorative shapes */
export function shapePoints(type: ShapeType): Pt[] {
  switch (type) {
    case 'triangle':
      return [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    case 'diamond':
      return [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }];
    case 'hexagon':
      return regularPoly(6, -Math.PI / 2);
    case 'pentagon':
      return regularPoly(5, -Math.PI / 2);
    case 'octagon':
      return regularPoly(8, -Math.PI / 8);
    case 'star': {
      const pts: Pt[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.22;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push({ x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) });
      }
      return pts;
    }
    case 'heart': {
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = (i / 24) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        pts.push({ x: 0.5 + hx / 36, y: 0.5 + hy / 34 });
      }
      return pts;
    }
    case 'arch': {
      // rounded-top "window" shape
      const pts: Pt[] = [{ x: 0, y: 1 }, { x: 0, y: 0.5 }];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (Math.PI * i) / 16; // π → 2π (top arc)
        pts.push({ x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) });
      }
      pts.push({ x: 1, y: 1 });
      return pts;
    }
    case 'semicircle': {
      // flat bottom, dome top
      const pts: Pt[] = [];
      for (let i = 0; i <= 32; i++) {
        const t = (i / 32) * Math.PI;
        pts.push({ x: 0.5 + 0.5 * Math.cos(t), y: 1 - Math.sin(t) });
      }
      return pts;
    }
    case 'cloud': {
      // cartoon cloud: flat-ish bottom + three lobes
      return [
        { x: 0.1, y: 0.82 },
        { x: 0.9, y: 0.82 },
        ...arcPts(0.72, 0.58, 0.2, 0.26, 0, -Math.PI, 12),
        ...arcPts(0.5, 0.42, 0.26, 0.3, 0, -Math.PI, 14),
        ...arcPts(0.28, 0.58, 0.2, 0.26, 0, -Math.PI, 12),
      ];
    }
    case 'drop': {
      // teardrop: tip at top, round bulb at bottom
      return [
        { x: 0.5, y: 0.02 },
        { x: 0.62, y: 0.18 },
        { x: 0.78, y: 0.4 },
        ...arcPts(0.5, 0.62, 0.32, 0.36, 0.2, Math.PI - 0.2, 18),
        { x: 0.22, y: 0.4 },
        { x: 0.38, y: 0.18 },
      ];
    }
    case 'cross':
      return [
        { x: 0.35, y: 0 }, { x: 0.65, y: 0 }, { x: 0.65, y: 0.35 },
        { x: 1, y: 0.35 }, { x: 1, y: 0.65 }, { x: 0.65, y: 0.65 },
        { x: 0.65, y: 1 }, { x: 0.35, y: 1 }, { x: 0.35, y: 0.65 },
        { x: 0, y: 0.65 }, { x: 0, y: 0.35 }, { x: 0.35, y: 0.35 },
      ];
    case 'arrowR':
      return [
        { x: 0, y: 0.32 }, { x: 0.58, y: 0.32 }, { x: 0.58, y: 0.08 },
        { x: 1, y: 0.5 }, { x: 0.58, y: 0.92 }, { x: 0.58, y: 0.68 }, { x: 0, y: 0.68 },
      ];
    case 'arrowU':
      return [
        { x: 0.32, y: 1 }, { x: 0.32, y: 0.42 }, { x: 0.08, y: 0.42 },
        { x: 0.5, y: 0 }, { x: 0.92, y: 0.42 }, { x: 0.68, y: 0.42 }, { x: 0.68, y: 1 },
      ];
    case 'chevron':
      return [
        { x: 0.05, y: 0.12 }, { x: 0.5, y: 0.5 }, { x: 0.05, y: 0.88 },
        { x: 0.32, y: 0.88 }, { x: 0.78, y: 0.5 }, { x: 0.32, y: 0.12 },
      ];
    case 'squircle': {
      // superellipse |x|^4 + |y|^4 = 1 (iOS-style continuous corner)
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        const e = 0.5; // 2/n with n=4
        return {
          x: 0.5 + 0.5 * Math.sign(c) * Math.pow(Math.abs(c), e),
          y: 0.5 + 0.5 * Math.sign(s) * Math.pow(Math.abs(s), e),
        };
      }, 64);
    }
    case 'spark': {
      // 4-point sparkle with concave sides
      return sampleCurve(t => {
        const a = t * Math.PI * 2 - Math.PI / 2;
        // sharp at axes, pinched between
        const lobe = Math.pow(Math.abs(Math.cos(2 * a)), 0.35);
        const r = 0.08 + 0.42 * lobe;
        return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
      }, 64);
    }
    case 'blob': {
      // organic pebble
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const r = 0.4 + 0.08 * Math.sin(3 * a) + 0.05 * Math.cos(5 * a) + 0.03 * Math.sin(7 * a);
        return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
      }, 56);
    }
    case 'bolt':
      // lightning
      return [
        { x: 0.58, y: 0 }, { x: 0.22, y: 0.52 }, { x: 0.44, y: 0.52 },
        { x: 0.32, y: 1 }, { x: 0.82, y: 0.42 }, { x: 0.56, y: 0.42 }, { x: 0.78, y: 0 },
      ];
    case 'flower': {
      // 6-petal rosette
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const r = 0.22 + 0.28 * Math.abs(Math.cos(3 * a));
        return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
      }, 72);
    }
    case 'brushWide': {
      // thick horizontal paint stroke
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const wobble = 0.08 * Math.sin(a * 3);
        return {
          x: 0.08 + 0.84 * ((Math.cos(a) + 1) / 2),
          y: 0.5 + 0.22 * Math.sin(a) + wobble * Math.sin(a * 2),
        };
      }, 48);
    }
    case 'brushDry': {
      // dry-brush: elongated with ragged edge
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const rag = 0.04 * Math.sin(a * 11) + 0.03 * Math.sin(a * 17);
        return {
          x: 0.5 + (0.42 + rag) * Math.cos(a),
          y: 0.5 + (0.14 + rag) * Math.sin(a),
        };
      }, 64);
    }
    case 'splash': {
      // ink splash � random-ish lobes
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const r = 0.22
          + 0.14 * Math.abs(Math.sin(a * 3.5))
          + 0.08 * Math.sin(a * 8)
          + 0.05 * Math.cos(a * 13);
        return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
      }, 80);
    }
    case 'ragged': {
      // torn / ripped edge stamp
      return sampleCurve(t => {
        const a = t * Math.PI * 2;
        const tear = 0.06 * Math.sin(a * 9) + 0.04 * Math.sin(a * 21 + 1);
        const base = 0.38 + tear;
        // flatten top/bottom slightly
        const sx = base * (1 + 0.15 * Math.cos(a));
        const sy = base * 0.75 * (1 + 0.1 * Math.sin(a * 2));
        return { x: 0.5 + sx * Math.cos(a), y: 0.5 + sy * Math.sin(a) };
      }, 72);
    }
    case 'polygon':
    case 'mask':
      return []; // uses z.points
    default:
      return [];
  }
}

export function isPolyShape(t: ShapeType): boolean {
  return t !== 'rect' && t !== 'circle' && t !== 'ellipse' && t !== 'text' && t !== 'art';
}

/** CSS clip-path for non-rect shapes (preview) */
export function clipPathFor(z: Zone, zones?: Zone[]): string | undefined {
  // nested clip: use another zone's shape
  if (z.clipZoneId && zones) {
    const src = zones.find(x => x.id === z.clipZoneId);
    if (src) return clipPathFor(src, zones);
  }
  if (z.type === 'circle') return 'circle(50% at 50% 50%)';
  if (z.type === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  const pts = z.type === 'polygon' || z.type === 'mask' ? z.points : shapePoints(z.type);
  if (pts?.length) {
    return `polygon(${pts.map(p => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`).join(', ')})`;
  }
  return undefined;
}

export function borderRadii(z: Zone): string {
  if (z.type !== 'rect') return '0';
  const c = z.corners;
  if (!c) return `${z.radius}%`;
  return `${c.tl}% ${c.tr}% ${c.br}% ${c.bl}%`;
}

/** Trace shape onto a canvas ctx as a clip path (normalized coords × W/H) */
export function traceShape(ctx: CanvasRenderingContext2D, z: Zone, W: number, H: number, zones?: Zone[]) {
  if (z.clipZoneId && zones) {
    const src = zones.find(x => x.id === z.clipZoneId);
    if (src) {
      // nested clip uses src shape but z's bbox? keep src geometry in its own bbox mapped to z's box
      const mapped: Zone = { ...src, x: z.x, y: z.y, w: z.w, h: z.h };
      traceShape(ctx, mapped, W, H, zones);
      return;
    }
  }
  const x = z.x * W;
  const y = z.y * H;
  const w = z.w * W;
  const h = z.h * H;
  ctx.beginPath();
  if (z.type === 'rect') {
    // per-corner radius via arcTo chain
    const c = z.corners || { tl: z.radius, tr: z.radius, br: z.radius, bl: z.radius };
    const half = Math.min(w, h) / 2 / 100;
    const rTL = c.tl * half, rTR = c.tr * half, rBR = c.br * half, rBL = c.bl * half;
    if ((rTL + rTR) > w) { /* clamp handled by arcTo naturally */ }
    ctx.moveTo(x + rTL, y);
    ctx.lineTo(x + w - rTR, y);
    if (rTR > 0) ctx.arcTo(x + w, y, x + w, y + rTR, rTR); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - rBR);
    if (rBR > 0) ctx.arcTo(x + w, y + h, x + w - rBR, y + h, rBR); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + rBL, y + h);
    if (rBL > 0) ctx.arcTo(x, y + h, x, y + h - rBL, rBL); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + rTL);
    if (rTL > 0) ctx.arcTo(x, y, x + rTL, y, rTL); else ctx.lineTo(x, y);
    ctx.closePath();
  } else if (z.type === 'circle' || z.type === 'ellipse') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else {
    const pts = (z.type === 'polygon' || z.type === 'mask') ? z.points : shapePoints(z.type);
    if (pts?.length) {
      pts.forEach((p, i) => {
        const px = (z.x + p.x * z.w) * W;
        const py = (z.y + p.y * z.h) * H;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
  }
}

/** Rounded-rect clip path for image rounding (imgRadius) */
export function traceImgRound(ctx: CanvasRenderingContext2D, z: Zone, W: number, H: number) {
  const x = z.x * W;
  const y = z.y * H;
  const w = z.w * W;
  const h = z.h * H;
  const r = (z.imgRadius / 100) * Math.min(w, h) / 2;
  ctx.beginPath();
  if (r > 0 && typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, r);
  } else if (r > 0) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  } else {
    ctx.rect(x, y, w, h);
  }
}

export function drawFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  fit: FitMode
) {
  const scale = fit === 'cover'
    ? Math.max(w / img.width, h / img.height)
    : Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;

  // Quality fix: single-step downscale of a 4000px photo to ~500px aliases hard.
  // Halve progressively through intermediate canvases (mip-mapping by hand),
  // then do the final draw with high smoothing.
  let source: CanvasImageSource = img;
  let sw = img.width;
  let sh = img.height;
  if (scale < 0.5 && sw > 256 && sh > 256) {
    let cur: HTMLCanvasElement | null = null;
    while (sw * 0.5 > dw && sh * 0.5 > dh) {
      const next = document.createElement('canvas');
      next.width = Math.max(1, Math.round(sw / 2));
      next.height = Math.max(1, Math.round(sh / 2));
      const nctx = next.getContext('2d');
      if (!nctx) break;
      nctx.imageSmoothingEnabled = true;
      nctx.imageSmoothingQuality = 'high';
      nctx.drawImage(source, 0, 0, next.width, next.height);
      source = next;
      sw = next.width;
      sh = next.height;
      cur = next;
    }
    void cur;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = (text || '').split('\n');
  const out: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = line + ' ' + words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}