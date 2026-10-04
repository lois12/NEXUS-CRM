// Offscreen page renderer shared by PNG/PDF/PPTX/ZIP
import type { ImgItem, CollagePage, BgTexture } from './types';
import { resolveSize } from './types';
import { cssFilter, textFillStyle, applySmallCaps, measureTracked, fillTracked, strokeTracked, drawCurvedLine, drawPathLine } from './textDraw';
import { traceShape, traceImgRound, drawFitted, wrapText } from './geometry';
import { CLIPART } from '../utils/collageArt';

export function renderPageToCanvas(
  p: Pick<CollagePage, 'format' | 'orient' | 'customW' | 'customH' | 'bgColor' | 'bgTransparent' | 'bgTexture' | 'outerRadius' | 'zones'>,
  images: ImgItem[],
  scale: number,
  watermark?: { img: HTMLImageElement; opacity: number; corner: 'tl' | 'tr' | 'bl' | 'br' | 'center'; scale: number },
): HTMLCanvasElement {
  const sz = resolveSize(p.format, p.orient, p.customW, p.customH);
  const W = sz.w * scale;
  const H = sz.h * scale;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // background with optional outer radius clip (skip fill when transparent → PNG alpha)
  if (p.outerRadius > 0) {
    traceShape(ctx, { id: '', type: 'rect', x: 0, y: 0, w: 1, h: 1, radius: p.outerRadius, imgRadius: 0, fit: 'cover' }, W, H);
    ctx.clip();
  }
  if (!p.bgTransparent) {
    ctx.fillStyle = p.bgColor;
    ctx.fillRect(0, 0, W, H);
  }
  // texture only over an opaque page fill
  if (!p.bgTransparent && p.bgTexture && p.bgTexture !== 'none') {
    drawTexture(ctx, W, H, p.bgTexture, p.bgColor);
  }

  for (const z of p.zones) {
    if (z.hidden) continue;
    ctx.save();
    if (z.type === 'text') {
      const px = (z.fontSize || 0.06) * sz.h * scale;
      const family = z.fontFamily || 'Montserrat';
      const weight = z.fontWeight === 'bold' ? '700' : '400';
      ctx.font = z.smallCaps
        ? `${weight} small-caps ${px}px "${family}", sans-serif`
        : `${weight} ${px}px "${family}", sans-serif`;
      ctx.textBaseline = 'top';
      const maxW = z.w * sz.w * scale;
      const rawLines = wrapText(ctx, applySmallCaps(z.text || '', z.smallCaps), maxW);
      const lines = rawLines;
      const align = z.align || 'left';
      ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
      const baseX = z.x * sz.w * scale + (align === 'center' ? maxW / 2 : align === 'right' ? maxW : 0);
      const baseY = z.y * sz.h * scale;
      const lh = (z.lineHeight || 1.15) * px;
      const tracking = (z.letterSpacing || 0) * px;

      const cx = z.x * sz.w * scale + (z.w * sz.w * scale) / 2;
      const cy = z.y * sz.h * scale + (z.h * sz.h * scale) / 2;
      ctx.translate(cx, cy);
      ctx.rotate(((z.rotation || 0) * Math.PI) / 180);
      ctx.translate(-cx, -cy);

      // pill / badge background
      if (z.textBg) {
        const padX = z.textBg.padX * px;
        const padY = z.textBg.padY * px;
        const widest = Math.max(...lines.map(l => measureTracked(ctx, l, tracking)), 0);
        const totalH = lines.length * lh;
        let bx = baseX - padX;
        if (align === 'center') bx = baseX - widest / 2 - padX;
        if (align === 'right') bx = baseX - widest - padX;
        const by = baseY - padY;
        ctx.fillStyle = z.textBg.color;
        const r = z.textBg.radius * px;
        const bw = widest + padX * 2;
        const bh = totalH + padY * 2;
        ctx.beginPath();
        if (r > 0 && typeof (ctx as any).roundRect === 'function') (ctx as any).roundRect(bx, by, bw, bh, r);
        else ctx.rect(bx, by, bw, bh);
        ctx.fill();
      }

      const fill = textFillStyle(ctx, z, z.x * sz.w * scale, z.y * sz.h * scale, z.w * sz.w * scale, z.h * sz.h * scale);

      if (z.textShadow) {
        ctx.save();
        ctx.shadowOffsetX = z.textShadow.x * scale;
        ctx.shadowOffsetY = z.textShadow.y * scale;
        ctx.shadowBlur = z.textShadow.blur * scale;
        ctx.shadowColor = z.textShadow.color;
      }

      const strokeCfg = z.stroke;
      const drawLine = (line: string, x: number, y: number) => {
        if (z.textPath && z.textPath.length >= 2) {
          drawPathLine(ctx, line, z, px, tracking, fill, strokeCfg, sz.w * scale, sz.h * scale);
          return;
        }
        if (!z.curve) {
          if (strokeCfg && strokeCfg.width > 0) {
            ctx.lineJoin = 'round';
            ctx.lineWidth = strokeCfg.width * px * 2;
            ctx.strokeStyle = strokeCfg.color;
            strokeTracked(ctx, line, x, y, tracking, align);
          }
          ctx.fillStyle = fill;
          fillTracked(ctx, line, x, y, tracking, align);
          return;
        }
        drawCurvedLine(ctx, line, x, y, px, tracking, z.curve, fill, strokeCfg);
      };

      if (strokeCfg && strokeCfg.width > 0 && !z.curve) {
        lines.forEach((line: string, li: number) => {
          ctx.lineJoin = 'round';
          ctx.lineWidth = strokeCfg.width * px * 2;
          ctx.strokeStyle = strokeCfg.color;
          strokeTracked(ctx, line, baseX, baseY + li * lh, tracking, align);
        });
      }
      lines.forEach((line, li) => {
        drawLine(line, baseX, baseY + li * lh);
      });

      if (z.textShadow) ctx.restore();
      ctx.restore();
      continue;
    }
    // Shape zone: clip to shape, then to image-round rect, then draw
    if (z.type === 'art') {
      const item = CLIPART.find(a => a.key === z.artKey);
      if (item) {
        const ax = z.x * sz.w * scale;
        const ay = z.y * sz.h * scale;
        const aw = z.w * sz.w * scale;
        const ah = z.h * sz.h * scale;
        const p2 = new Path2D(item.path);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.scale(aw / 24, ah / 24);
        ctx.fillStyle = z.fillColor || 'var(--color-primary)';
        ctx.fill(p2);
        ctx.restore();
      }
      ctx.restore();
      continue;
    }
    traceShape(ctx, z, sz.w * scale, sz.h * scale, p.zones);
    ctx.clip();
    const imgItem = z.imgId ? images.find(i => i.id === z.imgId) : null;
    if (imgItem?.img) {
      ctx.save();
      const op = z.imgOpacity ?? 1;
      if (op < 1) ctx.globalAlpha = op;
      const fl = z.filters;
      if (fl) {
        ctx.filter = cssFilter(fl);
      }
      if (z.imgRadius > 0) {
        traceImgRound(ctx, z, sz.w * scale, sz.h * scale);
        ctx.clip();
      }
      const zx = z.x * sz.w * scale;
      const zy = z.y * sz.h * scale;
      const zw = z.w * sz.w * scale;
      const zh = z.h * sz.h * scale;
      ctx.translate(zx + zw / 2, zy + zh / 2);
      ctx.scale(z.imgZoom || 1, z.imgZoom || 1);
      ctx.translate((z.imgX || 0) * zw * 0.3, (z.imgY || 0) * zh * 0.3);
      ctx.translate(-(zx + zw / 2), -(zy + zh / 2));
      drawFitted(ctx, imgItem.img, zx, zy, zw, zh, z.fit);
      ctx.filter = 'none';
      ctx.restore();
      // portrait blur: soft vignette sharp center
      if (z.portraitBlur && z.portraitBlur > 0) {
        ctx.save();
        // blurred layer under, sharp already drawn — add blur ring via destination-over + blur copy clipped out center
        // simpler: redraw blurred on top with alpha outside center using radial mask approximation
        const blurPx = z.portraitBlur * scale * 0.5;
        ctx.filter = `blur(${blurPx}px)`;
        ctx.globalAlpha = 0.85;
        // erase center so sharp shows through: draw blurred only in a thick frame
        ctx.save();
        const pad = 0.22;
        ctx.beginPath();
        ctx.rect(zx, zy, zw, zh);
        ctx.ellipse(zx + zw / 2, zy + zh / 2, zw * (0.5 - pad / 2), zh * (0.5 - pad / 2), 0, 0, Math.PI * 2);
        ctx.clip('evenodd');
        drawFitted(ctx, imgItem.img, zx, zy, zw, zh, z.fit);
        ctx.restore();
        ctx.restore();
      }
    } else {
      // empty zone placeholder — keep it subtle so transparency shows through
      ctx.fillStyle = p.bgTransparent ? 'rgba(180,180,180,0.15)' : 'rgba(255,255,255,0.06)';
      ctx.fill();
    }
    ctx.restore();

    // border stroke along the shape (outside the clip)
    if (z.border && z.border.width > 0) {
      ctx.save();
      traceShape(ctx, z, sz.w * scale, sz.h * scale, p.zones);
      ctx.strokeStyle = z.border.color;
      ctx.lineWidth = (z.border.width / 100) * Math.min(sz.w, sz.h) * scale / 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // watermark
  if (watermark) {
    drawWatermarkOn(ctx, W, H, watermark);
  }
  return canvas;
}

/** background textures (subtle, on top of bg color) */
export function drawTexture(ctx: CanvasRenderingContext2D, W: number, H: number, tex: BgTexture, bgColor: string) {
  ctx.save();
  if (tex === 'grid') {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const step = Math.max(12, Math.min(W, H) / 24);
    for (let x = 0; x <= W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  } else if (tex === 'dots') {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const step = Math.max(10, Math.min(W, H) / 28);
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        ctx.beginPath(); ctx.arc(x, y, Math.max(1, step * 0.06), 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (tex === 'diag') {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = Math.max(1, Math.min(W, H) / 400);
    const step = Math.max(8, Math.min(W, H) / 30);
    for (let i = -H; i < W + H; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    }
  } else if (tex === 'noise') {
    // sparse speckles (deterministic-ish)
    const n = Math.floor((W * H) / 900);
    for (let i = 0; i < n; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
      const a = 0.04 + ((i * 17) % 10) / 250;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(Math.abs(x) * W, Math.abs(y) * H, 2, 2);
    }
  }
  ctx.restore();
  void bgColor;
}

export function drawWatermarkOn(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  wm: { img: HTMLImageElement; opacity: number; corner: 'tl' | 'tr' | 'bl' | 'br' | 'center'; scale: number },
) {
  const minSide = Math.min(W, H);
  const w = minSide * wm.scale;
  const h = w * (wm.img.height / wm.img.width || 1);
  const pad = minSide * 0.03;
  let x = pad, y = pad;
  if (wm.corner === 'tr') { x = W - w - pad; y = pad; }
  else if (wm.corner === 'bl') { x = pad; y = H - h - pad; }
  else if (wm.corner === 'br') { x = W - w - pad; y = H - h - pad; }
  else if (wm.corner === 'center') { x = (W - w) / 2; y = (H - h) / 2; }
  ctx.save();
  ctx.globalAlpha = wm.opacity;
  ctx.drawImage(wm.img, x, y, w, h);
  ctx.restore();
}

