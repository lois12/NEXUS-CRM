/** Aurora Frame — пресеты рамок и отрисовка кадра (canvas 2D, разрешение-независимо) */

export interface FramePreset {
  id: string;
  label: string;
  w: number; // ширина экспорта, px
  h: number; // высота экспорта, px
  /** скругление углов — доля от меньшей стороны (масштабируется) либо 'circle' */
  radius: number | 'circle';
}

export const FRAME_PRESETS: FramePreset[] = [
  { id: '16x9', label: '16:9', w: 1920, h: 1080, radius: 0.045 },
  { id: '9x16', label: '9:16', w: 1080, h: 1920, radius: 0.045 },
  { id: '1x1', label: '1:1', w: 1080, h: 1080, radius: 0.045 },
  { id: 'circle', label: 'Круг', w: 1080, h: 1080, radius: 'circle' },
];

export type FitMode = 'cover' | 'contain';

export interface AuroraColor { r: number; g: number; b: number }

/** Палитра северного сияния: зелёный → циан → фиолетовый */
const AURORA_STOPS: AuroraColor[] = [
  { r: 0, g: 255, b: 136 },
  { r: 0, g: 212, b: 255 },
  { r: 125, g: 95, b: 255 },
];

export function auroraColorAt(u: number): AuroraColor {
  const t = ((u % 1) + 1) % 1;
  const seg = t * AURORA_STOPS.length;
  const i = Math.floor(seg) % AURORA_STOPS.length;
  const j = (i + 1) % AURORA_STOPS.length;
  const f = seg - Math.floor(seg);
  const a = AURORA_STOPS[i];
  const b = AURORA_STOPS[j];
  return {
    r: Math.round(a.r + (b.r - a.r) * f),
    g: Math.round(a.g + (b.g - a.g) * f),
    b: Math.round(a.b + (b.b - a.b) * f),
  };
}

export interface FrameState {
  preset: FramePreset;
  image: HTMLImageElement | null;
  fitMode: FitMode;
  scale: number; // множитель поверх fit
  ox: number; // сдвиг по X, доли ширины (от центра)
  oy: number; // сдвиг по Y, доли высоты
  text: string;
  fontFamily: string;
  fontSize: number; // доля высоты холста (0.03–0.12)
  textColor: string;
  auroraOn: boolean;
  auroraBrightness: number; // 0..1
  auroraSpeed: number; // 0..2
}

export function shapePath(ctx: CanvasRenderingContext2D, w: number, h: number, preset: FramePreset) {
  ctx.beginPath();
  if (preset.radius === 'circle') {
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    const r = Math.min(w, h) * preset.radius;
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
  }
}

function rgba(c: AuroraColor, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** Оборачивает текст по ширине — возвращает массив строк */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Рисует кадр: клип по форме → картинка (fit + масштаб + сдвиг) → текст → рамка-сияние.
 * t — время в мс (детерминированно: и превью, и кадры GIF/видео используют одну функцию).
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: FrameState,
  t: number,
): void {
  const minDim = Math.min(w, h);
  ctx.clearRect(0, 0, w, h);

  // ── 1. содержимое в форме рамки ──
  ctx.save();
  shapePath(ctx, w, h, s.preset);
  ctx.clip();

  if (s.image) {
    const img = s.image;
    const base = s.fitMode === 'cover'
      ? Math.max(w / img.naturalWidth, h / img.naturalHeight)
      : Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const sc = base * s.scale;
    const dw = img.naturalWidth * sc;
    const dh = img.naturalHeight * sc;
    const dx = w / 2 + s.ox * w - dw / 2;
    const dy = h / 2 + s.oy * h - dh / 2;
    // фон под «вписать» — тёмный, чтобы не было пустоты
    ctx.fillStyle = '#12141c';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#12141c';
    ctx.fillRect(0, 0, w, h);
  }

  // лёгкая виньетка снизу — читаемость текста
  if (s.text.trim()) {
    const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  }

  // ── 2. текст внизу ──
  if (s.text.trim()) {
    const px = Math.round(h * s.fontSize);
    ctx.font = `700 ${px}px ${s.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const maxWidth = w * 0.86;
    const lines = wrapText(ctx, s.text.trim(), maxWidth);
    const lineHeight = px * 1.2;
    const pad = minDim * 0.055;
    let y = h - pad - (lines.length - 1) * lineHeight;
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = px * 0.25;
    ctx.fillStyle = s.textColor;
    for (const line of lines) {
      ctx.fillText(line, w / 2, y);
      y += lineHeight;
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  ctx.restore();

  // ── 3. рамка-сияние (поверх, снаружи контура) ──
  if (s.auroraOn && s.auroraBrightness > 0) {
    const speed = s.auroraSpeed;
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const phase = (t * 0.001 * speed) + (i * Math.PI * 2) / layers;
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(phase));
      const alpha = s.auroraBrightness * pulse;
      if (alpha <= 0.02) continue;
      const color = auroraColorAt(t * 0.00008 * speed + i / layers);
      ctx.save();
      shapePath(ctx, w, h, s.preset);
      ctx.lineWidth = Math.max(2, minDim * 0.012 * (1 + i * 0.55));
      ctx.strokeStyle = rgba(color, alpha);
      ctx.shadowColor = rgba(color, alpha * 0.95);
      ctx.shadowBlur = minDim * (0.035 + i * 0.025);
      ctx.stroke();
      ctx.restore();
    }
    // тонкая внутренняя линия — «объём»
    ctx.save();
    shapePath(ctx, w, h, s.preset);
    ctx.lineWidth = Math.max(1, minDim * 0.004);
    ctx.strokeStyle = `rgba(255,255,255,${(0.25 + 0.35 * s.auroraBrightness).toFixed(3)})`;
    ctx.stroke();
    ctx.restore();
  } else {
    // статичная аккуратная рамка, когда анимация выключена
    ctx.save();
    shapePath(ctx, w, h, s.preset);
    ctx.lineWidth = Math.max(2, minDim * 0.008);
    ctx.strokeStyle = 'rgba(0,255,136,0.55)';
    ctx.stroke();
    ctx.restore();
  }
}
