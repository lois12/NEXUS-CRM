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
  ox: number; // сдвиг картинки по X, доли ширины (от центра)
  oy: number; // сдвиг картинки по Y, доли высоты
  text: string;
  fontFamily: string;
  fontSize: number; // доля высоты холста (0.03–0.12)
  textColor: string;
  /** позиция текста: X — доля ширины (центр блока), Y — доля высоты; null = авто-низ по центру */
  textX: number;
  textY: number | null;
  /** наклон текста, градусы */
  textAngle: number;
  /** обводка букв */
  strokeOn: boolean;
  strokeColor: string;
  strokeWidth: number; // 0..1 → доля px
  auroraOn: boolean;
  auroraBrightness: number; // 0..1
  auroraSpeed: number; // 0..2
  windOn: boolean;
  snowOn: boolean;
  /** плотность/интенсивность эффектов 0..1 */
  fxIntensity: number;
  /** параметры рамки */
  frameRadius: number; // доля minDim (0–0.12), для 'circle' не используется
  frameWidth: number; // множитель толщины грани (0.5–2.5)
  /** плашка под текстом: капсула вокруг текста или новостная полоса снизу */
  plateOn: boolean;
  plateStyle: PlateStyle;
  plateFill: PlateFill;
  plateColor: string; // hex (цвет A)
  plateColor2: string; // hex (цвет B — для градиента)
  plateAngle: number; // градусы направления градиента
  plateAlpha: number; // 0..1
  plateBlur: number; // 0..1 — блюр фото под плашкой
  /** логотип канала — позиция центра в долях холста, тянется мышкой */
  logo: HTMLImageElement | null;
  logoX: number;
  logoY: number;
  logoSize: number; // доля minDim (0.05–0.3)
  logoOpacity: number; // 0..1
  logoRadius: number; // 0..0.5 — скругление углов (0.5 = круг)
  /** неоновое свечение текста */
  neonOn: boolean;
  neonColor: string;
  neonIntensity: number; // 0..1
  /** полярные шторы внутри кадра (поверх фото, под текстом) */
  curtainsOn: boolean;
  curtainIntensity: number; // 0..1
  curtainSpeed: number; // 0..2
}

export type PlateStyle = 'capsule' | 'band';
export type PlateFill = 'solid' | 'gradient';

/** Габарит текстового блока для hit-test (в координатах холста) */
export interface TextBBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number; // радианы
}

export function shapePath(ctx: CanvasRenderingContext2D, w: number, h: number, preset: FramePreset, radius?: number) {
  ctx.beginPath();
  if (preset.radius === 'circle') {
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    const r = Math.min(
      Math.min(w, h) * (radius != null ? radius : preset.radius),
      Math.min(w, h) / 2,
    );
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

/** hex + альфа → rgba() для плашки */
function hexAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** Полярные шторы: мягкие световые столбы, дрейфуют по кадру (поверх фото, под текстом) */
function drawCurtains(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity: number, speed: number) {
  const N = 5;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < N; i++) {
    const phase = t * 0.00012 * speed + i * 1.31;
    const cx = w * (0.1 + 0.2 * i + 0.07 * Math.sin(phase));
    const bw = w * (0.07 + 0.045 * Math.sin(phase * 0.7 + i));
    const col = auroraColorAt(0.15 * i + t * 0.00003 * speed);
    const alpha = intensity * (0.09 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 1.3)));
    if (alpha < 0.01) continue;
    const grad = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
    grad.addColorStop(0, rgba(col, 0));
    grad.addColorStop(0.5, rgba(col, alpha));
    grad.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(cx - bw, 0, bw * 2, h);
  }
  ctx.restore();
}

/** Оборачивает текст по ширине — возвращает массив строк; слова длиннее строки режутся по буквам */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  const pushWord = (word: string) => {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = word;
    }
  };
  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      // одно слово не влезает — разбиваем по буквам
      if (cur) { lines.push(cur); cur = ''; }
      let chunk = '';
      for (const ch of word) {
        if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      cur = chunk;
    } else {
      pushWord(word);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Кэш мягкого снежинки-спрайта (радиальный градиент) — дёшево для рендера */
let snowSprite: HTMLCanvasElement | null = null;
function getSnowSprite(): HTMLCanvasElement {
  if (snowSprite) return snowSprite;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  snowSprite = c;
  return c;
}

/** Космический ветер — редкие световые штрихи поверх фото и текста.
 *  Штрихи двухслойные (мягкая подложка + ядро) — в GIF не дают соль-перец-шум. */
function drawWind(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, t: number, intensity: number) {
  const N = 22;
  const speed = 0.000045;
  for (let i = 0; i < N; i++) {
    const px = (((i * 0.137 + t * speed * (1 + (i % 5) * 0.18)) % 1.3) - 0.15);
    const py = ((i * 0.311 + Math.sin(t * 0.00035 + i) * 0.035) % 1.12) - 0.06;
    const x = px * w;
    const y = py * h;
    if (x < -w * 0.1 || x > w * 1.1) continue;
    const alpha = intensity * (0.16 + (i % 5) * 0.05);
    if (alpha < 0.02) continue;
    const len = minDim * (0.045 + (i % 4) * 0.022);
    const color = auroraColorAt(i * 0.19 + t * 0.00004);
    const coreW = Math.max(2, minDim * 0.0034);
    // мягкая подложка — сглаживает края для палитры GIF
    ctx.strokeStyle = rgba(color, alpha * 0.35);
    ctx.lineWidth = coreW * 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - len * 0.28);
    ctx.stroke();
    // ядро
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = coreW;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - len * 0.28);
    ctx.stroke();
  }
}

/** Настоящий снег: мягкие белые хлопья (спрайт с градиентом), падение с покачиванием и глубиной */
function drawSnow(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, t: number, intensity: number) {
  const N = Math.round(24 + intensity * 56);
  const sprite = getSnowSprite();
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'screen'; // хлопья светятся, не замутняя фото
  for (let i = 0; i < N; i++) {
    const depth = 0.45 + (i % 5) * 0.14; // 0.45..1 — дальние мельче и медленнее
    const fall = (0.000028 + (i % 5) * 0.000013) * depth;
    const py = (((i * 0.173 + t * fall) % 1.14) - 0.07);
    const sway = Math.sin(t * 0.0011 + i * 1.7) * 0.016 * depth;
    const px = ((i * 0.419) % 1) + sway;
    const r = minDim * (0.0032 + (i % 4) * 0.0021) * depth;
    const alpha = intensity * (0.35 + (i % 6) * 0.1) * (0.6 + depth * 0.4);
    ctx.globalAlpha = Math.min(0.95, alpha);
    ctx.drawImage(sprite, px * w - r, py * h - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

/**
 * Рамка-сияние: градиенты по контуру через conic-градиент —
 * без сегментов, значит без «обломанных» стыков; блик-волна бежит по углу.
 */
function drawAuroraFrame(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, s: FrameState, t: number) {
  const speed = s.auroraSpeed;
  const brightness = s.auroraBrightness;
  const widthK = s.frameWidth;

  const conic = (phase: number, alphaMul: number): CanvasGradient | string => {
    const cg = (ctx as CanvasRenderingContext2D & {
      createConicGradient?: (a: number, x: number, y: number) => CanvasGradient;
    }).createConicGradient;
    const color0 = rgba(auroraColorAt(phase * 0.16), Math.min(1, 0.85 * alphaMul * (0.35 + 0.65 * brightness)));
    if (typeof cg !== 'function') return color0;
    const g = cg.call(ctx, phase, w / 2, h / 2);
    const stops = 12;
    for (let i = 0; i <= stops; i++) {
      const u = i / stops;
      const a = (0.55 + 0.45 * Math.sin(u * Math.PI * 2 + phase)) * alphaMul * (0.35 + 0.65 * brightness);
      g.addColorStop(u, rgba(auroraColorAt(u + phase * 0.16), Math.max(0, Math.min(1, a))));
    }
    return g;
  };

  // мягкое свечение
  const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.001 * speed));
  ctx.save();
  shapePath(ctx, w, h, s.preset, s.frameRadius);
  ctx.lineWidth = Math.max(2, minDim * 0.011 * widthK);
  ctx.strokeStyle = conic(t * 0.0012 * speed, 0.6 * pulse);
  ctx.shadowColor = rgba(auroraColorAt(t * 0.00008 * speed), 0.5 * pulse * brightness);
  ctx.shadowBlur = minDim * 0.032;
  ctx.stroke();
  ctx.restore();

  // переливающееся ядро грани
  ctx.save();
  shapePath(ctx, w, h, s.preset, s.frameRadius);
  ctx.lineWidth = Math.max(2, minDim * 0.0115 * widthK);
  ctx.strokeStyle = conic(t * 0.0012 * speed + 1.3, 1);
  ctx.stroke();
  ctx.restore();

  // блик-волна: белый свет бежит по контуру
  const head = (t * 0.00012 * speed) % 1;
  const cg = (ctx as CanvasRenderingContext2D & {
    createConicGradient?: (a: number, x: number, y: number) => CanvasGradient;
  }).createConicGradient;
  if (typeof cg === 'function') {
    const g = cg.call(ctx, 0, w / 2, h / 2);
    const stops = 28;
    for (let i = 0; i <= stops; i++) {
      const u = i / stops;
      let d = Math.abs(u - head);
      if (d > 0.5) d = 1 - d;
      const a = Math.exp(-(d * d) / 0.0016);
      g.addColorStop(u, `rgba(255,255,255,${(a * 0.8).toFixed(3)})`);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    shapePath(ctx, w, h, s.preset, s.frameRadius);
    ctx.lineWidth = Math.max(2, minDim * 0.0115 * widthK);
    ctx.strokeStyle = g;
    ctx.stroke();
    ctx.restore();
  }

  // чёткая светящаяся грань
  ctx.save();
  shapePath(ctx, w, h, s.preset, s.frameRadius);
  ctx.lineWidth = Math.max(1.5, minDim * 0.005 * widthK);
  ctx.strokeStyle = `rgba(255,255,255,${(0.4 + 0.4 * brightness).toFixed(3)})`;
  ctx.stroke();
  ctx.restore();
}

/**
 * Рисует кадр: клип по форме → картинка → виньетка → текст → ветер/снег → рамка-сияние.
 * t — время в мс (детерминированно: превью, GIF и видео используют одну функцию).
 * bg — непрозрачный фон (для GIF/видео: углы без «мусора» квантования).
 * Возвращает габарит текста для перетаскивания (или null).
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: FrameState,
  t: number,
  bg?: string,
): TextBBox | null {
  const minDim = Math.min(w, h);
  ctx.clearRect(0, 0, w, h);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  // ── 1. содержимое в форме рамки ──
  ctx.save();
  shapePath(ctx, w, h, s.preset, s.frameRadius);
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
    ctx.fillStyle = '#12141c';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#12141c';
    ctx.fillRect(0, 0, w, h);
  }

  // полярные шторы — атмосфера поверх фото, под текстом
  if (s.curtainsOn && s.curtainIntensity > 0) {
    drawCurtains(ctx, w, h, t, s.curtainIntensity, s.curtainSpeed);
  }

  // ── 2. текст: метрики → виньетка/плашка → отрисовка (можно тащить и наклонять) ──
  let bbox: TextBBox | null = null;
  const hasText = !!s.text.trim();
  if (hasText) {
    const px = Math.round(h * s.fontSize);
    ctx.font = `700 ${px}px ${s.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = w * 0.75; // перенос раньше — длинная подпись охотно идёт в 2 строки
    const lines = wrapText(ctx, s.text.trim(), maxWidth);
    const lineHeight = px * 1.2;
    const blockH = lineHeight * lines.length;

    let maxLineW = 0;
    for (const line of lines) maxLineW = Math.max(maxLineW, ctx.measureText(line).width);

    const padY = px * 0.32;
    const padX = px * 0.55;
    const bandH = blockH + padY * 2.2;
    const bandMode = s.plateOn && s.plateStyle === 'band';

    // позиция текста: в режиме полосы — всегда центр полосы внизу, без наклона
    const cx = bandMode ? w / 2 : s.textX * w;
    const cy = bandMode
      ? h - bandH / 2
      : (s.textY == null ? h - minDim * 0.055 - blockH / 2 : s.textY * h);
    const angle = bandMode ? 0 : (s.textAngle * Math.PI) / 180;

    // виньетка следует за текстом (в полосе не нужна — там своя подложка)
    if (!bandMode) {
      const vHalf = Math.max(blockH * 1.5, h * 0.28);
      const grad = ctx.createLinearGradient(0, cy - vHalf, 0, cy + vHalf);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, cy - vHalf, w, vHalf * 2);
    }

    // плашка: капсула вокруг текста или новостная полоса снизу
    if (s.plateOn) {
      // заливка: сплошная или линейный градиент под заданным углом
      const platePaint = (ccx: number, ccy: number, spanW: number, spanH: number): string | CanvasGradient => {
        if (s.plateFill === 'gradient') {
          const a = (s.plateAngle * Math.PI) / 180;
          const half = Math.max(spanW, spanH) / 2;
          const g = ctx.createLinearGradient(
            ccx - Math.cos(a) * half, ccy - Math.sin(a) * half,
            ccx + Math.cos(a) * half, ccy + Math.sin(a) * half,
          );
          g.addColorStop(0, hexAlpha(s.plateColor, s.plateAlpha));
          g.addColorStop(1, hexAlpha(s.plateColor2, s.plateAlpha));
          return g;
        }
        return hexAlpha(s.plateColor, s.plateAlpha);
      };
      const blurPx = s.plateBlur * minDim * 0.055;
      const blurPass = () => {
        // блюр фото под плашкой: размытая копия холста видна только под формой
        if (blurPx <= 0.5) return;
        ctx.save();
        ctx.clip();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // копия холста — строго пиксель в пиксель
        ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.restore();
      };

      if (bandMode) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, h - bandH, w, bandH);
        blurPass();
        ctx.beginPath();
        ctx.rect(0, h - bandH, w, bandH);
        ctx.fillStyle = platePaint(w / 2, h - bandH / 2, w, bandH);
        ctx.fill();
        ctx.restore();
      } else {
        const pw = maxLineW + padX * 2;
        const ph = blockH + padY * 2;
        const rr = Math.min(ph / 2, px * 0.55);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.roundRect(-pw / 2, -ph / 2, pw, ph, rr);
        blurPass();
        ctx.beginPath();
        ctx.roundRect(-pw / 2, -ph / 2, pw, ph, rr);
        ctx.fillStyle = platePaint(0, 0, pw, ph);
        ctx.fill();
        ctx.restore();
      }
    }

    const paintLines = () => {
      let ly = -((lines.length - 1) / 2) * lineHeight;
      for (const line of lines) {
        ctx.fillText(line, 0, ly);
        ly += lineHeight;
      }
    };
    const strokeLines = () => {
      let ly = -((lines.length - 1) / 2) * lineHeight;
      for (const line of lines) {
        ctx.strokeText(line, 0, ly);
        ly += lineHeight;
      }
    };

    // неоновое свечение — два прохода мягким цветом под основным текстом
    if (s.neonOn && s.neonIntensity > 0) {
      for (let pass = 0; pass < 2; pass++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.shadowColor = s.neonColor;
        ctx.shadowBlur = px * (0.35 + s.neonIntensity * (pass === 0 ? 1.15 : 0.55));
        ctx.fillStyle = s.neonColor;
        paintLines();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // обводка букв — под заливкой
    if (s.strokeOn && s.strokeWidth > 0.01) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = px * 0.04 + s.strokeWidth * px * 0.16;
      ctx.strokeStyle = s.strokeColor;
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = px * 0.25;
      strokeLines();
    }
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = px * 0.25;
    ctx.fillStyle = s.textColor;
    paintLines();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.restore();

    // габарит с учётом плашки — тащить можно за подложку
    const plateW = s.plateOn && !bandMode ? padX * 2 : 0;
    const plateH = s.plateOn ? (bandMode ? 0 : padY * 2) : 0;
    bbox = { cx, cy, w: maxLineW + plateW, h: blockH + plateH, angle };
  }

  // ── 3. эффекты поверх фото и текста (внутри клипа) ──
  if (s.windOn && s.fxIntensity > 0) drawWind(ctx, w, h, minDim, t, s.fxIntensity);
  if (s.snowOn && s.fxIntensity > 0) drawSnow(ctx, w, h, minDim, t, s.fxIntensity);

  // логотип канала — поверх всего содержимого, но под рамкой
  const lbox = computeLogoBox(s, w, h);
  if (s.logo && lbox) {
    ctx.save();
    ctx.globalAlpha = s.logoOpacity;
    if (s.logoRadius > 0.001) {
      // скругление углов: 0.5 = круг
      const rad = s.logoRadius * Math.min(lbox.w, lbox.h);
      ctx.beginPath();
      ctx.roundRect(lbox.x, lbox.y, lbox.w, lbox.h, rad);
      ctx.clip();
    }
    ctx.drawImage(s.logo, lbox.x, lbox.y, lbox.w, lbox.h);
    ctx.restore();
  }

  ctx.restore();

  // ── 4. рамка-сияние (поверх, по контуру) ──
  if (s.auroraOn && s.auroraBrightness > 0) {
    drawAuroraFrame(ctx, w, h, minDim, s, t);
  } else {
    // статичная аккуратная рамка, когда анимация выключена
    ctx.save();
    shapePath(ctx, w, h, s.preset, s.frameRadius);
    ctx.lineWidth = Math.max(2, minDim * 0.008 * s.frameWidth);
    ctx.strokeStyle = 'rgba(0,255,136,0.55)';
    ctx.stroke();
    ctx.restore();
  }

  return bbox;
}

/** Габарит логотипа (координаты холста) — единый источник для рисования и hit-test */
export interface LogoBox { x: number; y: number; w: number; h: number }

export function computeLogoBox(s: FrameState, w: number, h: number): LogoBox | null {
  if (!s.logo) return null;
  const minDim = Math.min(w, h);
  const box = s.logoSize * minDim;
  const iw = s.logo.naturalWidth || 1;
  const ih = s.logo.naturalHeight || 1;
  const sc = Math.min(box / iw, box / ih);
  const lw = iw * sc;
  const lh = ih * sc;
  return { x: s.logoX * w - lw / 2, y: s.logoY * h - lh / 2, w: lw, h: lh };
}

/** Попадает ли точка (координаты холста) в текстовый блок с учётом наклона */
export function hitTestText(bbox: TextBBox | null, x: number, y: number, pad = 10): boolean {
  if (!bbox) return false;
  const dx = x - bbox.cx;
  const dy = y - bbox.cy;
  const cos = Math.cos(-bbox.angle);
  const sin = Math.sin(-bbox.angle);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return Math.abs(rx) <= bbox.w / 2 + pad && Math.abs(ry) <= bbox.h / 2 + pad;
}

/** Геометрия ручки вращения над текстом (координаты холста экспорта) */
export interface TextHandle {
  x: number;
  y: number;
  r: number; // радиус «кнопки»
  lineX: number; // точка примыкания линии к блоку текста
  lineY: number;
}

export function textHandlePos(bbox: TextBBox, minDim: number): TextHandle {
  const r = minDim * 0.028;
  const dist = bbox.h / 2 + minDim * 0.05 + r;
  const sin = Math.sin(bbox.angle);
  const cos = Math.cos(bbox.angle);
  return {
    x: bbox.cx + sin * dist,
    y: bbox.cy - cos * dist,
    r,
    lineX: bbox.cx + sin * (bbox.h / 2),
    lineY: bbox.cy - cos * (bbox.h / 2),
  };
}
