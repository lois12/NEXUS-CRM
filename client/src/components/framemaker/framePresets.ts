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
  /** типографика */
  lineHeight: number; // множитель межстрочного (0.8–2)
  letterSpacing: number; // разрядка, доля px (-0.02–0.12)
  textCase: TextCase;
  /** анимация появления текста (в GIF/видео и превью) */
  textAnim: TextAnim;
  auroraOn: boolean;
  auroraBrightness: number; // 0..1
  auroraSpeed: number; // 0..2
  windOn: boolean;
  snowOn: boolean;
  /** плотность/скорость ветра и снега 0..2 */
  fxIntensity: number;
  fxSpeed: number;
  /** листья / дождь / искры / боке — у каждого своя плотность и скорость */
  leavesOn: boolean;
  leavesIntensity: number;
  leavesSpeed: number;
  rainOn: boolean;
  rainIntensity: number;
  rainSpeed: number;
  sparksOn: boolean;
  sparksIntensity: number;
  sparksSpeed: number;
  bokehOn: boolean;
  bokehIntensity: number;
  bokehSpeed: number;
  /** параметры рамки */
  frameStyle: FrameStyle;
  frameMode: FrameMode;
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
  logoUnderText: boolean; // порядок: логотип под текстом
  /** неоновое свечение текста */
  neonOn: boolean;
  neonColor: string;
  neonIntensity: number; // 0..1
  /** полярные шторы внутри кадра (поверх фото, под текстом) */
  curtainsOn: boolean;
  curtainIntensity: number; // 0..1
  curtainSpeed: number; // 0..2
  curtainAngle: number; // -45..45 градусов наклона столбов
  curtainWidth: number; // 0.5..2 множитель ширины
  curtainCount: number; // 3..8 столбцов
  /** слои: видимость */
  showPhoto: boolean;
  showText: boolean;
  showLogo: boolean;
  showFx: boolean;
  showFrame: boolean;
  /** второй текстовый блок (заголовок/подпись) */
  text2On: boolean;
  text2: string;
  text2X: number;
  text2Y: number;
  text2Angle: number;
  text2Font: string;
  text2Size: number; // доля высоты
  text2Color: string;
  /** форма текста: прямая / по кругу */
  textShape: TextShape2;
  /** градиент по буквам */
  textGradOn: boolean;
  textGrad1: string;
  textGrad2: string;
  textGrad3: string;
  textGradAngle: number;
  /** тень текста */
  shadowOn: boolean;
  shadowColor: string;
  shadowDx: number; // -20..20 (% px)
  shadowDy: number;
  shadowBlur: number; // 0..40 (% px)
  /** бейдж-табличка */
  badgeOn: boolean;
  badgeText: string;
  badgeX: number;
  badgeY: number;
  badgeBg: string;
  badgeColor: string;
  /** крупное число */
  numOn: boolean;
  numText: string;
  numStyle: NumStyle;
  numX: number;
  numY: number;
  numColor: string;
  numSize: number; // % minDim
  /** водяной знак */
  wmOn: boolean;
  wmText: string;
  wmX: number;
  wmY: number;
  wmOpacity: number;
  /** QR-код (готовый холст) */
  qrImage: HTMLCanvasElement | null;
  qrX: number;
  qrY: number;
  qrSize: number;
  qrRadius: number;
  /** стикер-фигура */
  shapeOn: boolean;
  shapeKind: ShapeKind;
  shapeX: number;
  shapeY: number;
  shapeSize: number;
  shapeColor: string;
  shapeRot: number;
  /** фильтры фото */
  fBright: number; // -1..1
  fContrast: number;
  fSat: number;
  fTemp: number;
  /** размытый фон из фото */
  bgBlurOn: boolean;
  /** виньетка */
  vigOn: boolean;
  vigStrength: number; // 0..1
  vigRadius: number; // 0..1
  /** зерно плёнки */
  grainOn: boolean;
  grainIntensity: number;
  /** глитч-хроматика */
  glitchOn: boolean;
  glitchStrength: number;
  /** кино-полосы */
  barsOn: boolean;
  barsSize: number; // 0..0.25
  /** линия рамки */
  frameLine: FrameLine;
  /** ретро-камера с датой */
  camOn: boolean;
}

export type PlateStyle = 'capsule' | 'band';
export type PlateFill = 'solid' | 'gradient';
export type FrameStyle = 'aurora' | 'neon' | 'glass' | 'fire' | 'ice';
export type FrameMode = 'full' | 'corners';
export type FrameLine = 'solid' | 'dashed' | 'double';
export type TextCase = 'none' | 'upper' | 'lower' | 'title';
export type TextAnim = 'none' | 'fade' | 'slide' | 'type' | 'pulse';
export type TextShape2 = 'straight' | 'circle';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export type NumStyle = 'outline' | 'neon' | 'plate';
export type ShapeKind = 'star' | 'circle' | 'stamp';

/** Габарит текстового блока для hit-test (в координатах холста) */
export interface TextBBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number; // радианы
}

/** Что вернул drawFrame: габариты для перетаскивания */
export interface FrameHit {
  text: TextBBox | null;
  text2: TextBBox | null;
  shape: TextBBox | null;
  badge: TextBBox | null;
  num: TextBBox | null;
  wm: TextBBox | null;
  qr: TextBBox | null;
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

/** Угловые скобки («чертёжный» стиль) — только углы контура */
function cornerBracketsPath(ctx: CanvasRenderingContext2D, w: number, h: number, preset: FramePreset, radius?: number) {
  const L = Math.min(w, h) * 0.2;
  ctx.beginPath();
  if (preset.radius === 'circle') {
    const r = Math.min(w, h) / 2;
    for (let k = 0; k < 4; k++) {
      const c = Math.PI / 4 + k * (Math.PI / 2);
      ctx.moveTo(w / 2 + r * Math.cos(c - 0.35), h / 2 + r * Math.sin(c - 0.35));
      ctx.arc(w / 2, h / 2, r, c - 0.35, c + 0.35);
    }
    return;
  }
  const r = Math.min(Math.min(w, h) * (radius != null ? radius : preset.radius), Math.min(w, h) / 2);
  const lx = Math.min(L, w / 2);
  const ly = Math.min(L, h / 2);
  // TL
  ctx.moveTo(0, ly);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.lineTo(lx, 0);
  // TR
  ctx.moveTo(w - lx, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, ly);
  // BR
  ctx.moveTo(w, h - ly);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(w - lx, h);
  // BL
  ctx.moveTo(lx, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, h - ly);
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

/** Регистр текста для отрисовки */
function applyCase(text: string, mode: TextCase): string {
  if (mode === 'upper') return text.toUpperCase();
  if (mode === 'lower') return text.toLowerCase();
  if (mode === 'title') return text.replace(/[^\s]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return text;
}

/** Палитры рамки по стилям */
const FRAME_STOPS: Record<FrameStyle, AuroraColor[]> = {
  aurora: [{ r: 0, g: 255, b: 136 }, { r: 0, g: 212, b: 255 }, { r: 125, g: 95, b: 255 }],
  neon: [{ r: 255, g: 79, b: 216 }, { r: 0, g: 212, b: 255 }, { r: 155, g: 95, b: 255 }],
  glass: [{ r: 230, g: 245, b: 255 }, { r: 150, g: 210, b: 255 }, { r: 190, g: 180, b: 255 }],
  fire: [{ r: 255, g: 60, b: 30 }, { r: 255, g: 150, b: 20 }, { r: 255, g: 230, b: 80 }],
  ice: [{ r: 240, g: 252, b: 255 }, { r: 0, g: 190, b: 255 }, { r: 30, g: 80, b: 220 }],
};

function frameColorAt(u: number, style: FrameStyle): AuroraColor {
  const stops = FRAME_STOPS[style] || FRAME_STOPS.aurora;
  const t = ((u % 1) + 1) % 1;
  const seg = t * stops.length;
  const i = Math.floor(seg) % stops.length;
  const j = (i + 1) % stops.length;
  const f = seg - Math.floor(seg);
  const a = stops[i];
  const b = stops[j];
  return {
    r: Math.round(a.r + (b.r - a.r) * f),
    g: Math.round(a.g + (b.g - a.g) * f),
    b: Math.round(a.b + (b.b - a.b) * f),
  };
}

/** Полярные шторы: световые столбы с наклоном, дрейфом и настраиваемой шириной/количеством */
function drawCurtains(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, s: FrameState) {
  const intensity = s.curtainIntensity;
  const speed = s.curtainSpeed;
  const N = Math.round(s.curtainCount);
  const widthK = s.curtainWidth;
  const slant = Math.tan((s.curtainAngle * Math.PI) / 180) * h;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < N; i++) {
    const phase = t * 0.00012 * speed + i * 1.31;
    const cx = w * (0.08 + (0.84 * (i + 0.5)) / N + 0.05 * Math.sin(phase));
    const bw = w * 0.075 * widthK * (1 + 0.35 * Math.sin(phase * 0.7 + i));
    const col = auroraColorAt(0.15 * i + t * 0.00003 * speed);
    const alpha = intensity * (0.09 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 1.3)));
    if (alpha < 0.01) continue;
    const grad = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
    grad.addColorStop(0, rgba(col, 0));
    grad.addColorStop(0.5, rgba(col, alpha));
    grad.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = grad;
    // столб с наклоном: верх смещён относительно низа
    ctx.beginPath();
    ctx.moveTo(cx - bw + slant, 0);
    ctx.lineTo(cx + bw + slant, 0);
    ctx.lineTo(cx + bw, h);
    ctx.lineTo(cx - bw, h);
    ctx.closePath();
    ctx.fill();
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
function drawWind(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, t: number, intensity: number, speed: number) {
  const N = 22;
  const vel = 0.000045 * (0.4 + speed * 0.6);
  for (let i = 0; i < N; i++) {
    const px = (((i * 0.137 + t * vel * (1 + (i % 5) * 0.18)) % 1.3) - 0.15);
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
function drawSnow(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, t: number, intensity: number, speed: number) {
  const N = Math.round(24 + intensity * 56);
  const sprite = getSnowSprite();
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'screen'; // хлопья светятся, не замутняя фото
  for (let i = 0; i < N; i++) {
    const depth = 0.45 + (i % 5) * 0.14; // 0.45..1 — дальние мельче и медленнее
    const fall = (0.000028 + (i % 5) * 0.000013) * depth * (0.4 + speed * 0.6);
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

/** Спрайты листьев — рисуем один раз, дальше тянем с поворотом */
let leafSprites: HTMLCanvasElement[] | null = null;
function getLeafSprites(): HTMLCanvasElement[] {
  if (leafSprites) return leafSprites;
  const pairs: Array<[string, string]> = [
    ['#e8892b', '#c25a1e'],
    ['#d94f3a', '#a32e22'],
    ['#c9a227', '#8f7318'],
    ['#8fae3f', '#5d7a24'],
  ];
  leafSprites = pairs.map(([c1, c2]) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      g.translate(32, 32);
      const grad = g.createLinearGradient(-18, -14, 18, 14);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -26);
      g.quadraticCurveTo(17, -11, 19, 5);
      g.quadraticCurveTo(11, 21, 0, 27);
      g.quadraticCurveTo(-11, 21, -19, 5);
      g.quadraticCurveTo(-17, -11, 0, -26);
      g.fill();
      g.strokeStyle = 'rgba(60,30,10,0.28)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -21);
      g.lineTo(0, 23);
      g.stroke();
    }
    return c;
  });
  return leafSprites;
}

/** Падающие листья — мягкие объёмные листья с покачиванием и вращением */
function drawLeaves(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity: number, speed: number) {
  const sprites = getLeafSprites();
  const N = Math.round(6 + intensity * 16);
  const vel = 0.4 + speed * 0.75;
  for (let i = 0; i < N; i++) {
    const sp = sprites[i % sprites.length];
    const fall = (0.000055 + (i % 4) * 0.000022) * vel;
    const py = ((i * 0.193 + t * fall) % 1.22) - 0.11;
    const sway = Math.sin(t * 0.0009 * vel + i * 2.1) * 0.05;
    const px = ((i * 0.37) % 1.1) - 0.05 + sway + (t * 0.000012 * speed) % 1;
    const size = Math.min(w, h) * (0.038 + (i % 4) * 0.013);
    const rot = t * 0.00055 * (i % 2 ? 1 : -1) * vel + i * 1.3;
    ctx.save();
    ctx.translate(px * w, py * h);
    ctx.rotate(rot);
    ctx.globalAlpha = Math.min(0.95, 0.5 + intensity * 0.45);
    ctx.drawImage(sp, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

/** Дождь — тонкие косые штрихи разной глубины */
function drawRain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity: number, speed: number) {
  const N = Math.round(50 + intensity * 170);
  const vel = 0.5 + speed * 0.9;
  const slant = 0.16;
  for (let i = 0; i < N; i++) {
    const depth = 0.4 + (i % 5) * 0.15;
    const fall = (0.00075 + (i % 7) * 0.00016) * vel * depth;
    const py = ((i * 0.167 + t * fall) % 1.18) - 0.09;
    const px = ((i * 0.291) % 1.12) - 0.06 + py * slant * 0.25;
    const len = h * (0.013 + (i % 3) * 0.008) * depth;
    const alpha = intensity * (0.09 + (i % 5) * 0.045) * depth;
    if (alpha < 0.012) continue;
    ctx.strokeStyle = `rgba(195,222,255,${Math.min(0.55, alpha).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0011 * (0.6 + depth));
    ctx.beginPath();
    ctx.moveTo(px * w, py * h);
    ctx.lineTo(px * w + len * slant * 2.4, py * h + len);
    ctx.stroke();
  }
}

/** Мягкие светлячки-искры — тёплые угольки, всплывают и мерцают */
let sparkSprites: HTMLCanvasElement[] | null = null;
function getSparkSprites(): HTMLCanvasElement[] {
  if (sparkSprites) return sparkSprites;
  const cols = ['255,180,80', '255,120,50', '255,222,150'];
  sparkSprites = cols.map((col) => {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      grad.addColorStop(0, `rgba(${col},0.95)`);
      grad.addColorStop(0.35, `rgba(${col},0.35)`);
      grad.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 48, 48);
    }
    return c;
  });
  return sparkSprites;
}

function drawSparks(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity: number, speed: number) {
  const sprites = getSparkSprites();
  const N = Math.round(8 + intensity * 26);
  const vel = 0.5 + speed;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const rise = (0.00006 + (i % 5) * 0.00002) * vel;
    const py = 1.12 - (((i * 0.213 + t * rise) % 1.24));
    const sway = Math.sin(t * 0.0013 * vel + i * 1.7) * 0.028;
    const px = ((i * 0.429) % 1) + sway;
    const size = Math.min(w, h) * (0.02 + (i % 3) * 0.012);
    const flicker = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.008 * vel + i * 2.6));
    ctx.globalAlpha = Math.min(1, intensity * flicker * 0.9);
    ctx.drawImage(sprites[i % sprites.length], px * w - size / 2, py * h - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

/** Боке — крупные мягкие круги, медленно дрейфуют */
function drawBokeh(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity: number, speed: number) {
  const N = Math.round(5 + intensity * 15);
  const vel = 0.4 + speed * 0.7;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < N; i++) {
    const r = Math.min(w, h) * (0.032 + (i % 5) * 0.018);
    const px = (((i * 0.271 + t * 0.000007 * vel * (1 + (i % 3))) % 1.12) - 0.06);
    const py = (((i * 0.191 + Math.sin(t * 0.0002 * vel + i) * 0.045) % 1.12) - 0.06);
    const a = intensity * (0.05 + (i % 4) * 0.028);
    if (a < 0.008) continue;
    const g = ctx.createRadialGradient(px * w, py * h, 0, px * w, py * h, r);
    g.addColorStop(0, `rgba(195,222,255,${a.toFixed(3)})`);
    g.addColorStop(0.72, `rgba(165,205,255,${(a * 0.5).toFixed(3)})`);
    g.addColorStop(1, 'rgba(165,205,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px * w, py * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = prev;
}

/**
 * Рамка-сияние: градиенты по контуру через conic-градиент —
 * без сегментов, значит без «обломанных» стыков; блик-волна бежит по углу.
 * frameMode='corners' — только угловые скобки вместо полного контура.
 */
function drawAuroraFrame(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, s: FrameState, t: number) {
  const speed = s.auroraSpeed;
  const brightness = s.auroraBrightness;
  const widthK = s.frameWidth;
  const path = () => {
    if (s.frameMode === 'corners') cornerBracketsPath(ctx, w, h, s.preset, s.frameRadius);
    else shapePath(ctx, w, h, s.preset, s.frameRadius);
  };
  if (s.frameLine === 'dashed') ctx.setLineDash([minDim * 0.03, minDim * 0.02]);

  const conic = (phase: number, alphaMul: number): CanvasGradient | string => {
    const cg = (ctx as CanvasRenderingContext2D & {
      createConicGradient?: (a: number, x: number, y: number) => CanvasGradient;
    }).createConicGradient;
    const color0 = rgba(frameColorAt(phase * 0.16, s.frameStyle), Math.min(1, 0.85 * alphaMul * (0.35 + 0.65 * brightness)));
    if (typeof cg !== 'function') return color0;
    const g = cg.call(ctx, phase, w / 2, h / 2);
    const stops = 12;
    for (let i = 0; i <= stops; i++) {
      const u = i / stops;
      const a = (0.55 + 0.45 * Math.sin(u * Math.PI * 2 + phase)) * alphaMul * (0.35 + 0.65 * brightness);
      g.addColorStop(u, rgba(frameColorAt(u + phase * 0.16, s.frameStyle), Math.max(0, Math.min(1, a))));
    }
    return g;
  };

  // мягкое свечение
  const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.001 * speed));
  ctx.save();
  path();
  ctx.lineWidth = Math.max(2, minDim * 0.011 * widthK);
  ctx.strokeStyle = conic(t * 0.0012 * speed, 0.6 * pulse);
  ctx.shadowColor = rgba(frameColorAt(t * 0.00008, s.frameStyle), 0.5 * pulse * brightness);
  ctx.shadowBlur = minDim * 0.032;
  ctx.stroke();
  ctx.restore();

  // переливающееся ядро грани
  ctx.save();
  path();
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
    path();
    ctx.lineWidth = Math.max(2, minDim * 0.0115 * widthK);
    ctx.strokeStyle = g;
    ctx.stroke();
    ctx.restore();
  }

  // чёткая светящаяся грань
  ctx.save();
  path();
  ctx.lineWidth = Math.max(1.5, minDim * 0.005 * widthK);
  ctx.strokeStyle = `rgba(255,255,255,${(0.4 + 0.4 * brightness).toFixed(3)})`;
  ctx.stroke();
  ctx.restore();

  // двойная линия — внутренний контур чуть меньше
  if (s.frameLine === 'double') {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(0.962, 0.962);
    ctx.translate(-w / 2, -h / 2);
    path();
    ctx.lineWidth = Math.max(1, minDim * 0.0038 * widthK);
    ctx.strokeStyle = `rgba(255,255,255,${(0.3 + 0.35 * brightness).toFixed(3)})`;
    ctx.stroke();
    ctx.restore();
  }
  ctx.setLineDash([]);
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
): FrameHit {
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

  if (s.image && s.showPhoto) {
    const img = s.image;
    const base = s.fitMode === 'cover'
      ? Math.max(w / img.naturalWidth, h / img.naturalHeight)
      : Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const sc = base * s.scale;
    const dw = img.naturalWidth * sc;
    const dh = img.naturalHeight * sc;
    const dx = w / 2 + s.ox * w - dw / 2;
    const dy = h / 2 + s.oy * h - dh / 2;
    const imgFilter = `brightness(${(1 + s.fBright * 0.6).toFixed(2)}) contrast(${(1 + s.fContrast * 0.7).toFixed(2)}) saturate(${(1 + s.fSat * 1.1).toFixed(2)})`;
    ctx.fillStyle = '#12141c';
    ctx.fillRect(0, 0, w, h);
    if (s.bgBlurOn) {
      // размытая копия во всю площадь + резкая поверх — эффект фокуса
      ctx.save();
      ctx.filter = `blur(${(minDim * 0.02).toFixed(1)}px) ${imgFilter}`;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
      const ins = 0.92;
      ctx.save();
      ctx.filter = imgFilter;
      ctx.drawImage(img, dx + (dw * (1 - ins)) / 2, dy + (dh * (1 - ins)) / 2, dw * ins, dh * ins);
      ctx.restore();
    } else {
      ctx.save();
      ctx.filter = imgFilter;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    }
    // температура: тёплый/холодный оверлей
    if (Math.abs(s.fTemp) > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = s.fTemp > 0
        ? `rgba(255,170,80,${(s.fTemp * 0.5).toFixed(3)})`
        : `rgba(80,150,255,${(-s.fTemp * 0.5).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (s.glitchOn && s.glitchStrength > 0) drawGlitch(ctx, w, h, s, t);
  } else {
    ctx.fillStyle = '#12141c';
    ctx.fillRect(0, 0, w, h);
  }

  if (s.vigOn && s.vigStrength > 0) drawVignette(ctx, w, h, s);

  // полярные шторы — атмосфера поверх фото, под текстом
  if (s.curtainsOn && s.curtainIntensity > 0) {
    drawCurtains(ctx, w, h, t, s);
  }

  // логотип ПОД текстом (если выбран такой порядок)
  if (s.logoUnderText) paintLogo(ctx, s, w, h);

  // ── 2. текст: метрики → виньетка/плашка → отрисовка (можно тащить и наклонять) ──
  let bbox: TextBBox | null = null;
  const hasText = !!s.text.trim();
  if (hasText && s.showText) {
    const px = Math.round(h * s.fontSize);
    ctx.font = `700 ${px}px ${s.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${(s.letterSpacing * px).toFixed(2)}px`;
    const shownRaw = applyCase(s.text.trim(), s.textCase);

    // анимация появления: цикл 4.2s (совпадает с лупом GIF/видео)
    const animP = s.textAnim === 'none' ? 1 : Math.min(1, ((t % 4200) / 850));
    const animE = 1 - Math.pow(1 - animP, 3); // easeOut
    const shown = s.textAnim === 'type'
      ? shownRaw.slice(0, Math.max(1, Math.ceil(animP * shownRaw.length)))
      : shownRaw;

    const maxWidth = w * 0.75; // перенос раньше — длинная подпись охотно идёт в 2 строки
    const lines = wrapText(ctx, shown, maxWidth);
    const lineHeight = px * s.lineHeight;
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

    // анимация: сдвиг снизу + проявление / пульсация неона
    const tcy = cy + (s.textAnim === 'slide' ? (1 - animE) * h * 0.055 : 0);
    const alphaA = s.textAnim === 'fade' || s.textAnim === 'slide' ? animE : 1;
    const pulseK = s.textAnim === 'pulse' ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.006)) : 1;

    const isCircle = s.textShape === 'circle';
    const paintBody = () => {
      if (isCircle) drawCircleText(ctx, shown, 0, 0, px);
      else paintLines();
    };
    const strokeBody = () => {
      if (isCircle) drawCircleText(ctx, shown, 0, 0, px, true);
      else strokeLines();
    };
    // заливка: сплошная или градиент по буквам
    const textFill = (): string | CanvasGradient => {
      if (s.textGradOn) {
        const ga = (s.textGradAngle * Math.PI) / 180;
        const half = Math.max(maxLineW, blockH) * 0.75;
        const g = ctx.createLinearGradient(-Math.cos(ga) * half, -Math.sin(ga) * half, Math.cos(ga) * half, Math.sin(ga) * half);
        g.addColorStop(0, s.textGrad1);
        g.addColorStop(0.5, s.textGrad2);
        g.addColorStop(1, s.textGrad3);
        return g;
      }
      return s.textColor;
    };

    // неоновое свечение — два прохода мягким цветом под основным текстом
    if (s.neonOn && s.neonIntensity > 0) {
      for (let pass = 0; pass < 2; pass++) {
        ctx.save();
        ctx.globalAlpha = alphaA * (0.55 + 0.45 * pulseK);
        ctx.translate(cx, tcy);
        ctx.rotate(angle);
        ctx.shadowColor = s.neonColor;
        ctx.shadowBlur = px * (0.35 + s.neonIntensity * pulseK * (pass === 0 ? 1.15 : 0.55));
        ctx.fillStyle = s.neonColor;
        paintBody();
        ctx.restore();
      }
    }

    // тень текста — отдельный проход со смещением
    if (s.shadowOn) {
      ctx.save();
      ctx.globalAlpha = alphaA;
      ctx.translate(cx + (s.shadowDx / 100) * px, tcy + (s.shadowDy / 100) * px);
      ctx.rotate(angle);
      ctx.fillStyle = s.shadowColor;
      ctx.shadowColor = s.shadowColor;
      ctx.shadowBlur = (s.shadowBlur / 100) * px * 1.3;
      paintBody();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alphaA;
    ctx.translate(cx, tcy);
    ctx.rotate(angle);
    // обводка букв — под заливкой
    if (s.strokeOn && s.strokeWidth > 0.01) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = px * 0.04 + s.strokeWidth * px * 0.16;
      ctx.strokeStyle = s.strokeColor;
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = px * 0.25;
      strokeBody();
    }
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = px * 0.25;
    ctx.fillStyle = textFill();
    paintBody();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.restore();
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';

    // габарит с учётом плашки — тащить можно за подложку
    const plateW = s.plateOn && !bandMode ? padX * 2 : 0;
    const plateH = s.plateOn ? (bandMode ? 0 : padY * 2) : 0;
    bbox = {
      cx,
      cy,
      w: (isCircle ? Math.max(maxLineW / Math.PI, maxLineW * 0.5) : maxLineW) + plateW,
      h: blockH + plateH + (isCircle ? maxLineW / Math.PI : 0),
      angle,
    };
  }

  // ── 2б. второй текстовый блок ──
  let text2BBox: TextBBox | null = null;
  if (s.text2On && s.text2.trim() && s.showText) {
    const px2 = Math.round(h * s.text2Size);
    ctx.font = `700 ${px2}px ${s.text2Font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shown2 = applyCase(s.text2.trim(), s.textCase);
    const tw = ctx.measureText(shown2).width;
    const cx2 = s.text2X * w;
    const cy2 = s.text2Y * h;
    const a2 = (s.text2Angle * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx2, cy2);
    ctx.rotate(a2);
    if (s.shadowOn) {
      ctx.save();
      ctx.translate((s.shadowDx / 100) * px2, (s.shadowDy / 100) * px2);
      ctx.fillStyle = s.shadowColor;
      ctx.shadowColor = s.shadowColor;
      ctx.shadowBlur = (s.shadowBlur / 100) * px2 * 1.3;
      ctx.fillText(shown2, 0, 0);
      ctx.restore();
    }
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = px2 * 0.22;
    if (s.textGradOn) {
      const ga = (s.textGradAngle * Math.PI) / 180;
      const half = Math.max(tw, px2) * 0.75;
      const g = ctx.createLinearGradient(-Math.cos(ga) * half, -Math.sin(ga) * half, Math.cos(ga) * half, Math.sin(ga) * half);
      g.addColorStop(0, s.textGrad1);
      g.addColorStop(0.5, s.textGrad2);
      g.addColorStop(1, s.textGrad3);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = s.text2Color;
    }
    ctx.fillText(shown2, 0, 0);
    ctx.restore();
    text2BBox = { cx: cx2, cy: cy2, w: tw, h: px2 * 1.35, angle: a2 };
  }

  // ── 3. эффекты поверх фото и текста (внутри клипа) ──
  if (s.showFx) {
    if (s.windOn && s.fxIntensity > 0) drawWind(ctx, w, h, minDim, t, s.fxIntensity, s.fxSpeed);
    if (s.rainOn && s.rainIntensity > 0) drawRain(ctx, w, h, t, s.rainIntensity, s.rainSpeed);
    if (s.leavesOn && s.leavesIntensity > 0) drawLeaves(ctx, w, h, t, s.leavesIntensity, s.leavesSpeed);
    if (s.snowOn && s.fxIntensity > 0) drawSnow(ctx, w, h, minDim, t, s.fxIntensity, s.fxSpeed);
    if (s.bokehOn && s.bokehIntensity > 0) drawBokeh(ctx, w, h, t, s.bokehIntensity, s.bokehSpeed);
    if (s.sparksOn && s.sparksIntensity > 0) drawSparks(ctx, w, h, t, s.sparksIntensity, s.sparksSpeed);
  }

  // логотип поверх текста (по умолчанию)
  if (!s.logoUnderText) paintLogo(ctx, s, w, h);

  // декор и стикеры — все свободно перетаскиваются
  const badgeBox = s.badgeOn && s.badgeText.trim() ? drawBadge(ctx, w, h, minDim, s) : null;
  const numBox = s.numOn && s.numText.trim() ? drawNum(ctx, w, h, minDim, s) : null;
  const wmBox = s.wmOn && s.wmText.trim() ? drawWatermark(ctx, w, h, minDim, s) : null;
  const qrBox = s.qrImage ? drawQr(ctx, w, h, minDim, s) : null;
  let shapeBox: TextBBox | null = null;
  if (s.shapeOn) {
    drawShape(ctx, w, h, minDim, s);
    shapeBox = {
      cx: s.shapeX * w,
      cy: s.shapeY * h,
      w: s.shapeSize * minDim * 1.35,
      h: s.shapeSize * minDim * 1.35,
      angle: (s.shapeRot * Math.PI) / 180,
    };
  }

  if (s.grainOn && s.grainIntensity > 0) drawGrain(ctx, w, h, t, s.grainIntensity);
  if (s.camOn) drawCamFrame(ctx, w, h, minDim, s);
  if (s.barsOn && s.barsSize > 0.005) drawBars(ctx, w, h, s);

  ctx.restore();

  // ── 4. рамка-сияние (поверх, по контуру) ──
  if (s.showFrame) {
    if (s.auroraOn && s.auroraBrightness > 0) {
      drawAuroraFrame(ctx, w, h, minDim, s, t);
    } else {
      // статичная аккуратная рамка, когда анимация выключена
      ctx.save();
      if (s.frameMode === 'corners') cornerBracketsPath(ctx, w, h, s.preset, s.frameRadius);
      else shapePath(ctx, w, h, s.preset, s.frameRadius);
      ctx.lineWidth = Math.max(2, minDim * 0.008 * s.frameWidth);
      ctx.strokeStyle = 'rgba(0,255,136,0.55)';
      ctx.stroke();
      ctx.restore();
    }
  }

  return { text: bbox, text2: text2BBox, shape: shapeBox, badge: badgeBox, num: numBox, wm: wmBox, qr: qrBox };
}

/** Логотип канала — поверх содержимого, но под рамкой */
function paintLogo(ctx: CanvasRenderingContext2D, s: FrameState, w: number, h: number) {
  if (!s.showLogo) return;
  const lbox = computeLogoBox(s, w, h);
  if (!s.logo || !lbox) return;
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

/** Зерно плёнки — один раз генерим шумовой тайл */
let grainTile: HTMLCanvasElement | null = null;
function getGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  grainTile = c;
  return c;
}

function drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity: number) {
  const tile = getGrainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(0.5, intensity * 0.32);
  ctx.translate((t * 0.37) % 128 - 128, (t * 0.23) % 128 - 128); // зерно «живое»
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w + 256, h + 256);
  ctx.restore();
}

/** Глитч-хроматика: два призрачных копии фото со сдвигом и цветными дуотонами */
function drawGlitch(ctx: CanvasRenderingContext2D, w: number, h: number, s: FrameState, t: number) {
  const img = s.image;
  if (!img) return;
  const base = s.fitMode === 'cover'
    ? Math.max(w / img.naturalWidth, h / img.naturalHeight)
    : Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const sc = base * s.scale;
  const dw = img.naturalWidth * sc;
  const dh = img.naturalHeight * sc;
  const dx = w / 2 + s.ox * w - dw / 2;
  const dy = h / 2 + s.oy * h - dh / 2;
  const off = (2 + s.glitchStrength * Math.min(w, h) * 0.012) * (0.7 + 0.3 * Math.sin(t * 0.004));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(0.55, s.glitchStrength * 0.38);
  ctx.filter = 'sepia(1) saturate(6) hue-rotate(-30deg)'; // красный призрак
  ctx.drawImage(img, dx - off, dy, dw, dh);
  ctx.filter = 'sepia(1) saturate(6) hue-rotate(150deg)'; // голубой призрак
  ctx.drawImage(img, dx + off, dy, dw, dh);
  ctx.restore();
}

/** Виньетка — тёмные края с настраиваемой силой и радиусом */
function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, s: FrameState) {
  const r = (Math.hypot(w, h) / 2) * (0.55 + s.vigRadius * 0.9);
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, s.vigStrength * 0.85).toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Текст по кругу 360° */
function drawCircleText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, px: number, stroke = false) {
  const chars = [...text];
  if (!chars.length) return;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  const R = Math.max(total / (Math.PI * 2), px * 1.2);
  let acc = -total / 2;
  for (let i = 0; i < chars.length; i++) {
    const a = ((acc + widths[i] / 2) / total) * Math.PI * 2 - Math.PI / 2;
    acc += widths[i];
    ctx.save();
    ctx.translate(cx + R * Math.cos(a), cy + R * Math.sin(a));
    ctx.rotate(a + Math.PI / 2);
    if (stroke) ctx.strokeText(chars[i], 0, 0);
    else ctx.fillText(chars[i], 0, 0);
    ctx.restore();
  }
}

/** Бейдж-табличка — свободно позиционируется, возвращает габарит */
function drawBadge(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, s: FrameState): TextBBox {
  const px = Math.round(minDim * 0.038);
  ctx.save();
  ctx.font = `700 ${px}px ${s.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(s.badgeText).width;
  const pw = tw + px * 1.4;
  const ph = px * 1.9;
  const cx = s.badgeX * w;
  const cy = s.badgeY * h;
  ctx.fillStyle = s.badgeBg;
  ctx.beginPath();
  ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, minDim * 0.0025);
  ctx.stroke();
  ctx.fillStyle = s.badgeColor;
  ctx.fillText(s.badgeText, cx, cy);
  ctx.restore();
  return { cx, cy, w: pw, h: ph, angle: 0 };
}

/** Крупное число тремя стилями */
function drawNum(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, s: FrameState): TextBBox {
  const px = Math.round(minDim * s.numSize);
  ctx.save();
  ctx.font = `700 ${px}px ${s.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = s.numX * w;
  const cy = s.numY * h;
  const tw = ctx.measureText(s.numText).width;
  if (s.numStyle === 'plate') {
    ctx.fillStyle = 'rgba(10,14,24,0.78)';
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2 - px * 0.35, cy - px * 0.75, tw + px * 0.7, px * 1.5, px * 0.3);
    ctx.fill();
  }
  if (s.numStyle === 'neon') {
    ctx.shadowColor = s.numColor;
    ctx.shadowBlur = px * 0.55;
  }
  if (s.numStyle === 'outline') {
    ctx.lineWidth = Math.max(2, px * 0.06);
    ctx.strokeStyle = s.numColor;
    ctx.strokeText(s.numText, cx, cy);
    ctx.fillStyle = 'rgba(10,14,24,0.25)';
  } else {
    ctx.fillStyle = s.numColor;
  }
  ctx.fillText(s.numText, cx, cy);
  ctx.restore();
  return { cx, cy, w: tw + px * 0.7, h: px * 1.5, angle: 0 };
}

/** Водяной знак мелким текстом */
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, s: FrameState): TextBBox {
  const px = Math.round(minDim * 0.028);
  ctx.save();
  ctx.globalAlpha = Math.min(0.9, s.wmOpacity);
  ctx.font = `500 ${px}px ${s.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = s.wmX * w;
  const cy = s.wmY * h;
  const tw = ctx.measureText(s.wmText).width;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = px * 0.35;
  ctx.fillText(s.wmText, cx, cy);
  ctx.restore();
  return { cx, cy, w: tw + px, h: px * 1.6, angle: 0 };
}

/** QR-код */
function drawQr(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, s: FrameState): TextBBox | null {
  const img = s.qrImage;
  if (!img) return null;
  const size = s.qrSize * minDim;
  const cx = s.qrX * w;
  const cy = s.qrY * h;
  const left = cx - size / 2;
  const top = cy - size / 2;
  ctx.save();
  ctx.fillStyle = '#ffffff'; // белая подложка — QR должен читаться
  ctx.beginPath();
  ctx.roundRect(left - size * 0.08, top - size * 0.08, size * 1.16, size * 1.16, size * 0.12);
  ctx.fill();
  if (s.qrRadius > 0.01) {
    ctx.beginPath();
    ctx.roundRect(left, top, size, size, s.qrRadius * size);
    ctx.clip();
  }
  ctx.drawImage(img, left, top, size, size);
  ctx.restore();
  return { cx, cy, w: size * 1.16, h: size * 1.16, angle: 0 };
}

/** Стикер-фигура: звезда / круг-штамп / плашка */
function drawShape(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, s: FrameState) {
  const size = s.shapeSize * minDim;
  ctx.save();
  ctx.translate(s.shapeX * w, s.shapeY * h);
  ctx.rotate((s.shapeRot * Math.PI) / 180);
  ctx.fillStyle = s.shapeColor;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = Math.max(1.5, minDim * 0.004);
  if (s.shapeKind === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size / 2 : size * 0.21;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (s.shapeKind === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.roundRect(-size * 0.62, -size * 0.28, size * 1.24, size * 0.56, size * 0.16);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Ретро-камера: светлая рамка + янтарная дата */
function drawCamFrame(ctx: CanvasRenderingContext2D, w: number, h: number, minDim: number, _s: FrameState) {
  const b = minDim * 0.035;
  ctx.save();
  ctx.strokeStyle = 'rgba(250,250,245,0.92)';
  ctx.lineWidth = b;
  ctx.strokeRect(b / 2, b / 2, w - b, h - b);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}  ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const px = Math.round(minDim * 0.042);
  ctx.font = `700 ${px}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,176,42,0.95)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = px * 0.3;
  ctx.fillText(stamp, w - b * 1.6, h - b * 1.4);
  ctx.restore();
}

/** Кино-полосы */
function drawBars(ctx: CanvasRenderingContext2D, w: number, h: number, s: FrameState) {
  const bh = h * Math.min(0.3, s.barsSize);
  ctx.save();
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, w, bh);
  ctx.fillRect(0, h - bh, w, bh);
  ctx.restore();
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
