import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Upload, Move, Download, Pipette, Trash2, Eye, ChevronDown, X, Type, Loader2, Undo2, Redo2, RotateCcw, EyeOff, Layers } from 'lucide-react';
import FrameCanvas from '../components/framemaker/FrameCanvas';
import {
  FRAME_PRESETS, type FrameState, type FitMode, type PlateStyle, type PlateFill,
  type FrameStyle, type FrameMode, type TextCase, type TextAnim,
} from '../components/framemaker/framePresets';
import { exportFrameGif } from '../components/framemaker/exportGif';
import { exportFrameVideo, videoSupported, extForMime } from '../components/framemaker/exportVideo';
import { exportFrameWebp } from '../components/framemaker/exportWebP';
import { downloadBlob } from '../utils/docTools';
import { showToast } from '../components/ui/NexusModal';

// Шрифты: Inter/JetBrains Mono уже в проекте, остальные — локальные (fontsource)
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/russo-one/400.css';
import '@fontsource/caveat/600.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/exo-2/700.css';
import '@fontsource/oswald/600.css';
import '@fontsource/cormorant/700.css';
import '@fontsource/yeseva-one/400.css';
import '@fontsource/pacifico/400.css';
import '@fontsource/forum/400.css';
import '@fontsource/manrope/700.css';
import '@fontsource/rubik/700.css';
import '@fontsource/nunito/700.css';
import '@fontsource/comfortaa/700.css';
import '@fontsource/marck-script/400.css';
import '@fontsource/philosopher/700.css';
import '@fontsource/alice/400.css';
import '@fontsource/bad-script/400.css';
import '@fontsource/onest/700.css';

const FONTS = [
  { label: 'Montserrat', value: '"Montserrat", sans-serif' },
  { label: 'Unbounded', value: '"Unbounded", sans-serif' },
  { label: 'Russo One', value: '"Russo One", sans-serif' },
  { label: 'Exo 2', value: '"Exo 2", sans-serif' },
  { label: 'Oswald', value: '"Oswald", sans-serif' },
  { label: 'Manrope', value: '"Manrope", sans-serif' },
  { label: 'Rubik', value: '"Rubik", sans-serif' },
  { label: 'Nunito', value: '"Nunito", sans-serif' },
  { label: 'Comfortaa', value: '"Comfortaa", sans-serif' },
  { label: 'Onest', value: '"Onest", sans-serif' },
  { label: 'Playfair', value: '"Playfair Display", serif' },
  { label: 'Cormorant', value: '"Cormorant", serif' },
  { label: 'Yeseva One', value: '"Yeseva One", serif' },
  { label: 'Forum', value: '"Forum", serif' },
  { label: 'Alice', value: '"Alice", serif' },
  { label: 'Philosopher', value: '"Philosopher", serif' },
  { label: 'Caveat', value: '"Caveat", cursive' },
  { label: 'Pacifico', value: '"Pacifico", cursive' },
  { label: 'Marck Script', value: '"Marck Script", cursive' },
  { label: 'Bad Script', value: '"Bad Script", cursive' },
  { label: 'Inter', value: '"Inter", sans-serif' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
];

const PALETTE = ['#ffffff', '#0a0a0f', '#00ff88', '#00d4ff', '#7d5fff', '#ffd75f', '#ff6b6b', '#ff4fd8', '#b8f1ff'];

/** HSV → hex */
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(Math.max(0, Math.min(255, c * 255))).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

/** hex → HSV */
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const n = hex.replace('#', '');
  const x = n.length === 3 ? n.split('').map((c) => c + c).join('') : n.padEnd(6, '0');
  const r = (parseInt(x.slice(0, 2), 16) || 0) / 255;
  const g = (parseInt(x.slice(2, 4), 16) || 0) / 255;
  const b = (parseInt(x.slice(4, 6), 16) || 0) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

const FIELD = 'w-full px-2.5 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]';
const LABEL = 'text-[9px] font-mono text-gray-500 tracking-wider';

function chip(active: boolean): string {
  return `px-2.5 py-1.5 min-h-[32px] rounded-lg font-mono text-[10px] nx-press transition-all ${
    active ? 'text-black' : 'text-gray-400 bg-white/5 hover:text-gray-200'
  }`;
}

/** Переключатель-тумблер */
function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="w-11 h-6 rounded-full transition-colors relative nx-press shrink-0"
      style={{ background: on ? 'var(--color-primary)' : '#3a3a50' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}

/** Выбор цвета: выпадашка со спектром — поле насыщенности/яркости + радужный ползунок тона */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [dropperOk] = useState(() => typeof window !== 'undefined' && 'EyeDropper' in window);

  // при открытии синхронизируем с текущим значением
  useEffect(() => {
    if (open) setHsv(hexToHsv(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const emit = (h: number, s: number, v: number) => {
    setHsv({ h, s, v });
    onChange(hsvToHex(h, s, v));
  };

  const dragSV = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = svRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const apply = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      const s = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const v = 1 - Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      emit(hsv.h, s, v);
    };
    apply(e);
    const move = (ev: PointerEvent) => apply(ev);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const dragHue = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = hueRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const apply = (ev: { clientX: number }) => {
      const r = el.getBoundingClientRect();
      const h = Math.max(0, Math.min(359, ((ev.clientX - r.left) / r.width) * 360));
      // с белого/чёрного тон «не видно» — поднимаем насыщенность, чтобы цвет проявился
      const s = hsv.s < 0.02 ? 1 : hsv.s;
      const v = hsv.v < 0.02 ? 1 : hsv.v;
      emit(h, s, v);
    };
    apply(e);
    const move = (ev: PointerEvent) => apply(ev);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const pick = async () => {
    try {
      const ED = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const res = await new ED().open();
      onChange(res.sRGBHex);
      setHsv(hexToHsv(res.sRGBHex));
    } catch { /* отменено */ }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <label className={LABEL}>{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 nx-press"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="w-5 h-5 rounded-md border border-white/20 shrink-0" style={{ background: value }} />
        <span className="font-mono text-[10px] text-gray-300 flex-1 text-left">{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 p-2.5 rounded-xl glass border border-white/10 shadow-2xl space-y-2">
          {/* поле насыщенности / яркости */}
          <div
            ref={svRef}
            onPointerDown={dragSV}
            className="relative w-full h-28 rounded-lg cursor-crosshair touch-none"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, rgba(255,255,255,0)), ${hsvToHex(hsv.h, 1, 1)}`,
            }}
          >
            <span
              className="absolute w-3.5 h-3.5 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                background: hsvToHex(hsv.h, hsv.s, hsv.v),
                boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
              }}
            />
          </div>
          {/* радужный ползунок тона */}
          <div
            ref={hueRef}
            onPointerDown={dragHue}
            className="relative w-full h-3.5 rounded-full cursor-pointer touch-none"
            style={{
              background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
            }}
          >
            <span
              className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${(hsv.h / 360) * 100}%`, background: hsvToHex(hsv.h, 1, 1), boxShadow: '0 0 0 1px rgba(0,0,0,0.45)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color" value={value}
              onChange={(e) => { onChange(e.target.value); setHsv(hexToHsv(e.target.value)); }}
              className="w-8 h-8 rounded-md cursor-pointer bg-transparent border border-gray-700"
              aria-label="Свой цвет"
            />
            {dropperOk && (
              <button
                onClick={pick}
                title="Пипетка — взять цвет с экрана"
                aria-label="Пипетка"
                className="w-8 h-8 rounded-md border border-gray-700 nx-press flex items-center justify-center text-gray-300 hover:text-white"
              >
                <Pipette className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="font-mono text-[9px] text-gray-500">спектр / пипетка</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExportItem { id: string; name: string; type: string; size: number; ts: number; blob: Blob }

/** Рамка в стиле северного сияния: превью + экспорт PNG/GIF/видео */
export default function FrameMaker() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [presetId, setPresetId] = useState('16x9');
  const preset = FRAME_PRESETS.find((p) => p.id === presetId) || FRAME_PRESETS[0];

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fitMode, setFitMode] = useState<FitMode>('cover');
  const [scale, setScale] = useState(1);
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);

  const [text, setText] = useState('');
  const [fontFamily, setFontFamily] = useState(FONTS[0].value);
  const [fontSize, setFontSize] = useState(55); // ×0.001 → 0.055 высоты
  const [textColor, setTextColor] = useState(PALETTE[0]);
  const [textX, setTextX] = useState(0.5);
  const [textY, setTextY] = useState<number | null>(null); // null = авто-низ по центру
  const [textAngle, setTextAngle] = useState(0);
  const [strokeOn, setStrokeOn] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#0a0a0f');
  const [strokeWidth, setStrokeWidth] = useState(30); // 0..100
  const [lineHeight, setLineHeight] = useState(120); // ×0.01 множитель
  const [letterSpacing, setLetterSpacing] = useState(0); // ×0.001 доля px
  const [textCase, setTextCase] = useState<TextCase>('none');
  const [textAnimOn, setTextAnimOn] = useState(false);
  const [textAnimKind, setTextAnimKind] = useState<Exclude<TextAnim, 'none'>>('fade');

  const [fontModal, setFontModal] = useState(false);
  const [fontPhrase, setFontPhrase] = useState('НОРИЛЬСК · ЛЕТО 2026');

  const [neonOn, setNeonOn] = useState(false);
  const [neonColor, setNeonColor] = useState('#00d4ff');
  const [neonIntensity, setNeonIntensity] = useState(55);

  const [plateOn, setPlateOn] = useState(false);
  const [plateStyle, setPlateStyle] = useState<PlateStyle>('capsule');
  const [plateFill, setPlateFill] = useState<PlateFill>('solid');
  const [plateColor, setPlateColor] = useState('#0b0e17');
  const [plateColor2, setPlateColor2] = useState('#1a1030');
  const [plateAngle, setPlateAngle] = useState(135);
  const [plateAlpha, setPlateAlpha] = useState(60);
  const [plateBlur, setPlateBlur] = useState(0);

  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [logoX, setLogoX] = useState(0.13);
  const [logoY, setLogoY] = useState(0.13);
  const [logoSize, setLogoSize] = useState(14);
  const [logoOpacity, setLogoOpacity] = useState(85);
  const [logoRadius, setLogoRadius] = useState(0); // 0..50 (% — 50 = круг)

  const [frameRadius, setFrameRadius] = useState(4.5); // % от minDim
  const [frameWidth, setFrameWidth] = useState(100); // % толщины грани
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('aurora');
  const [frameMode, setFrameMode] = useState<FrameMode>('full');

  const [auroraOn, setAuroraOn] = useState(true);
  const [brightness, setBrightness] = useState(85);
  const [speed, setSpeed] = useState(100);

  const [curtainsOn, setCurtainsOn] = useState(true);
  const [curtainIntensity, setCurtainIntensity] = useState(55);
  const [curtainSpeed, setCurtainSpeed] = useState(100);
  const [curtainAngle, setCurtainAngle] = useState(0); // -45..45
  const [curtainWidth, setCurtainWidth] = useState(100); // 50..200 %
  const [curtainCount, setCurtainCount] = useState(5); // 3..8

  const [windOn, setWindOn] = useState(true);
  const [snowOn, setSnowOn] = useState(true);
  const [fxIntensity, setFxIntensity] = useState(55);

  const [videoSeconds, setVideoSeconds] = useState(4);
  const [videoRes, setVideoRes] = useState<'720' | '1080'>('1080');
  const [cleanPreview, setCleanPreview] = useState(false);
  const [compareOn, setCompareOn] = useState(false);
  const [showPhoto, setShowPhoto] = useState(true);
  const [showText, setShowText] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showFx, setShowFx] = useState(true);
  const [showFrame, setShowFrame] = useState(true);
  const [logoUnderText, setLogoUnderText] = useState(false);
  const [exporting, setExporting] = useState<'png' | 'gif' | 'video' | 'webp' | null>(null);
  const [history, setHistory] = useState<ExportItem[]>([]);

  const state: FrameState = {
    preset,
    image,
    fitMode,
    scale,
    ox,
    oy,
    text,
    fontFamily,
    fontSize: fontSize / 1000,
    textColor,
    textX,
    textY,
    textAngle,
    strokeOn,
    strokeColor,
    strokeWidth: strokeWidth / 100,
    lineHeight: lineHeight / 100,
    letterSpacing: letterSpacing / 1000,
    textCase,
    textAnim: textAnimOn ? textAnimKind : 'none',
    auroraOn,
    auroraBrightness: brightness / 100,
    auroraSpeed: speed / 100,
    windOn,
    snowOn,
    fxIntensity: fxIntensity / 100,
    frameRadius: frameRadius / 100,
    frameWidth: frameWidth / 100,
    frameStyle,
    frameMode,
    plateOn,
    plateStyle,
    plateFill,
    plateColor,
    plateColor2,
    plateAngle,
    plateAlpha: plateAlpha / 100,
    plateBlur: plateBlur / 100,
    logo,
    logoX,
    logoY,
    logoSize: logoSize / 100,
    logoOpacity: logoOpacity / 100,
    logoRadius: logoRadius / 100,
    neonOn,
    neonColor,
    neonIntensity: neonIntensity / 100,
    curtainsOn,
    curtainIntensity: curtainIntensity / 100,
    curtainSpeed: curtainSpeed / 100,
    curtainAngle,
    curtainWidth: curtainWidth / 100,
    curtainCount,
    showPhoto,
    showText,
    showLogo,
    showFx,
    showFrame,
    logoUnderText,
  };

  // «чистый кадр» — превью без эффектов; экспорт всегда идёт по полному state
  const previewState: FrameState = cleanPreview
    ? { ...state, windOn: false, snowOn: false, curtainsOn: false, auroraOn: false }
    : state;

  // подгрузка выбранного шрифта в document.fonts — иначе canvas рисует запасным
  useEffect(() => {
    try { document.fonts?.load(`700 64px ${fontFamily}`); } catch { /* noop */ }
  }, [fontFamily]);

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setScale(1);
      setOx(0);
      setOy(0);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { showToast('Не удалось открыть картинку', 'error'); URL.revokeObjectURL(url); };
    img.src = url;
  };

  const onPickLogo = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setLogo(img); URL.revokeObjectURL(url); };
    img.onerror = () => { showToast('Не удалось открыть логотип', 'error'); URL.revokeObjectURL(url); };
    img.src = url;
  };

  const resetView = () => { setScale(1); setOx(0); setOy(0); };

  const pushHistory = (name: string, type: string, blob: Blob) => {
    setHistory((h) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, type, size: blob.size, ts: Date.now(), blob },
      ...h,
    ].slice(0, 12));
  };

  // ── undo / redo ──────────────────────────────────────────────
  const undoStack = useRef<FrameState[]>([]);
  const redoStack = useRef<FrameState[]>([]);
  const applying = useRef(false);
  const [, setHistTick] = useState(0);

  const defaultState = (): FrameState => ({
    preset: FRAME_PRESETS[0], image: null, fitMode: 'cover', scale: 1, ox: 0, oy: 0,
    text: '', fontFamily: FONTS[0].value, fontSize: 0.055, textColor: PALETTE[0],
    textX: 0.5, textY: null, textAngle: 0, strokeOn: false, strokeColor: '#0a0a0f', strokeWidth: 0.3,
    lineHeight: 1.2, letterSpacing: 0, textCase: 'none', textAnim: 'none',
    auroraOn: true, auroraBrightness: 0.85, auroraSpeed: 1, windOn: true, snowOn: true, fxIntensity: 0.55,
    frameStyle: 'aurora', frameMode: 'full', frameRadius: 0.045, frameWidth: 1,
    plateOn: false, plateStyle: 'capsule', plateFill: 'solid', plateColor: '#0b0e17', plateColor2: '#1a1030',
    plateAngle: 135, plateAlpha: 0.6, plateBlur: 0,
    logo: null, logoX: 0.13, logoY: 0.13, logoSize: 0.14, logoOpacity: 0.85, logoRadius: 0, logoUnderText: false,
    neonOn: false, neonColor: '#00d4ff', neonIntensity: 0.55,
    curtainsOn: true, curtainIntensity: 0.55, curtainSpeed: 1, curtainAngle: 0, curtainWidth: 1, curtainCount: 5,
    showPhoto: true, showText: true, showLogo: true, showFx: true, showFrame: true,
  });

  const applySnapshot = (s: FrameState) => {
    applying.current = true;
    setText(s.text); setFontFamily(s.fontFamily); setFontSize(Math.round(s.fontSize * 1000)); setTextColor(s.textColor);
    setTextX(s.textX); setTextY(s.textY); setTextAngle(s.textAngle);
    setStrokeOn(s.strokeOn); setStrokeColor(s.strokeColor); setStrokeWidth(Math.round(s.strokeWidth * 100));
    setLineHeight(Math.round(s.lineHeight * 100)); setLetterSpacing(Math.round(s.letterSpacing * 1000));
    setTextCase(s.textCase);
    setTextAnimOn(s.textAnim !== 'none'); setTextAnimKind(s.textAnim === 'none' ? 'fade' : s.textAnim);
    setNeonOn(s.neonOn); setNeonColor(s.neonColor); setNeonIntensity(Math.round(s.neonIntensity * 100));
    setPlateOn(s.plateOn); setPlateStyle(s.plateStyle); setPlateFill(s.plateFill);
    setPlateColor(s.plateColor); setPlateColor2(s.plateColor2); setPlateAngle(s.plateAngle);
    setPlateAlpha(Math.round(s.plateAlpha * 100)); setPlateBlur(Math.round(s.plateBlur * 100));
    setAuroraOn(s.auroraOn); setBrightness(Math.round(s.auroraBrightness * 100)); setSpeed(Math.round(s.auroraSpeed * 100));
    setFrameStyle(s.frameStyle); setFrameMode(s.frameMode);
    setFrameRadius(Math.round(s.frameRadius * 1000) / 10); setFrameWidth(Math.round(s.frameWidth * 100));
    setCurtainsOn(s.curtainsOn); setCurtainIntensity(Math.round(s.curtainIntensity * 100)); setCurtainSpeed(Math.round(s.curtainSpeed * 100));
    setCurtainAngle(s.curtainAngle); setCurtainWidth(Math.round(s.curtainWidth * 100)); setCurtainCount(s.curtainCount);
    setWindOn(s.windOn); setSnowOn(s.snowOn); setFxIntensity(Math.round(s.fxIntensity * 100));
    setShowPhoto(s.showPhoto); setShowText(s.showText); setShowLogo(s.showLogo); setShowFx(s.showFx); setShowFrame(s.showFrame);
    setLogoUnderText(s.logoUnderText);
    setFitMode(s.fitMode); setScale(s.scale); setOx(s.ox); setOy(s.oy);
    setImage(s.image); setLogo(s.logo);
    setLogoX(s.logoX); setLogoY(s.logoY); setLogoSize(Math.round(s.logoSize * 100));
    setLogoOpacity(Math.round(s.logoOpacity * 100)); setLogoRadius(Math.round(s.logoRadius * 100));
    setPresetId(s.preset.id);
    setTimeout(() => { applying.current = false; }, 80);
  };

  const undo = () => {
    if (undoStack.current.length < 2) return;
    const cur = undoStack.current.pop()!;
    redoStack.current.push(cur);
    applySnapshot(undoStack.current[undoStack.current.length - 1]);
    setHistTick((n) => n + 1);
  };
  const redo = () => {
    const s = redoStack.current.pop();
    if (!s) return;
    undoStack.current.push(s);
    applySnapshot(s);
    setHistTick((n) => n + 1);
  };

  // снапшоты при изменениях (дебаунс)
  useEffect(() => {
    if (applying.current) return;
    const id = setTimeout(() => {
      undoStack.current = [...undoStack.current, state].slice(-40);
      redoStack.current = [];
      setHistTick((n) => n + 1);
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify({ ...state, image: !!state.image, logo: !!state.logo, preset: state.preset.id })]);

  // Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── автосохранение черновика (переживает F5) ─────────────────
  const DRAFT_KEY = 'nexus-frame-draft-v1';
  const toSmallDataUrl = (img: HTMLImageElement | null): Promise<string | null> => {
    if (!img) return Promise.resolve(null);
    const max = 1280;
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    return Promise.resolve(c.toDataURL('image/jpeg', 0.82));
  };

  const draftJson = JSON.stringify({ ...state, image: !!state.image, logo: !!state.logo, preset: state.preset.id, videoSeconds, videoRes });
  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        try {
          const payload = {
            s: JSON.parse(draftJson),
            img: await toSmallDataUrl(state.image),
            logoImg: await toSmallDataUrl(state.logo),
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch { /* квота — пропускаем */ }
      })();
    }, 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftJson]);

  // восстановление черновика при старте
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (payload.s) {
        applySnapshot({
          ...defaultState(),
          ...payload.s,
          image: null,
          logo: null,
          preset: FRAME_PRESETS.find((p) => p.id === payload.s.preset) || FRAME_PRESETS[0],
        });
        setVideoSeconds(payload.s.videoSeconds ?? 4);
        setVideoRes(payload.s.videoRes ?? '1080');
      }
      const load = (data: string | null, setter: (img: HTMLImageElement) => void) => {
        if (!data) return;
        const img = new Image();
        img.onload = () => setter(img);
        img.src = data;
      };
      load(payload.img, setImage);
      load(payload.logoImg, setLogo);
    } catch { /* битый черновик */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAll = () => {
    applySnapshot(defaultState());
    setVideoSeconds(4);
    setVideoRes('1080');
    setCleanPreview(false);
    setCompareOn(false);
    undoStack.current = [];
    redoStack.current = [];
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    showToast('Все настройки сброшены', 'success');
    setTimeout(() => {
      undoStack.current = [defaultState()];
      setHistTick((n) => n + 1);
    }, 120);
  };

  const exportPng = async () => {
    const c = canvasRef.current;
    if (!c) return;
    setExporting('png');
    try {
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
      if (!blob) throw new Error('png');
      const name = `frame-${preset.id}.png`;
      downloadBlob(blob, name);
      pushHistory(name, 'PNG', blob);
      showToast('PNG сохранён', 'success');
    } catch {
      showToast('Ошибка экспорта PNG', 'error');
    } finally {
      setExporting(null);
    }
  };

  const exportGif = async () => {
    setExporting('gif');
    try {
      const blob = await exportFrameGif(state, { seconds: 3.5, fps: 15, maxDim: 800 });
      const name = `frame-${preset.id}.gif`;
      downloadBlob(blob, name);
      pushHistory(name, 'GIF', blob);
      showToast('GIF сохранён', 'success');
    } catch {
      showToast('Ошибка экспорта GIF', 'error');
    } finally {
      setExporting(null);
    }
  };

  const exportVideo = async () => {
    setExporting('video');
    try {
      const resScale = videoRes === '720' ? 720 / Math.min(preset.w, preset.h) : 1;
      const blob = await exportFrameVideo(state, { seconds: videoSeconds, fps: 30, scale: resScale });
      if (!blob) { showToast('Браузер не поддерживает запись видео', 'error'); return; }
      const ext = extForMime(blob.type);
      const name = `frame-${preset.id}.${ext}`;
      downloadBlob(blob, name);
      pushHistory(name, ext.toUpperCase(), blob);
      showToast(ext === 'mp4' ? 'Видео сохранено (mp4)' : 'Видео сохранено (webm)', 'success');
    } catch {
      showToast('Ошибка экспорта видео', 'error');
    } finally {
      setExporting(null);
    }
  };

  const exportWebp = async () => {
    setExporting('webp');
    try {
      const blob = await exportFrameWebp(state, { seconds: 3.5, fps: 15, maxDim: 800, quality: 0.9 });
      const name = `frame-${preset.id}.webp`;
      downloadBlob(blob, name);
      pushHistory(name, 'WEBP', blob);
      showToast('WebP сохранён (анимированный)', 'success');
    } catch {
      showToast('Ошибка экспорта WebP', 'error');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-3 max-w-[1440px] mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center p-2 min-h-[36px] min-w-[36px] rounded-xl glass hover:bg-white/10 nx-press"
          aria-label="Назад"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold font-mono neon-text flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
            <Sparkles className="w-4 h-4" /> РАМКА
          </h1>
          <p className="nx-eyebrow mt-0.5">СЕВЕРНОЕ СИЯНИЕ ДЛЯ КАНАЛА</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={undo}
            disabled={undoStack.current.length < 2}
            className="flex items-center justify-center p-2 min-h-[36px] min-w-[36px] rounded-xl glass hover:bg-white/10 nx-press disabled:opacity-35"
            title="Отменить (Ctrl+Z)"
            aria-label="Отменить"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.current.length === 0}
            className="flex items-center justify-center p-2 min-h-[36px] min-w-[36px] rounded-xl glass hover:bg-white/10 nx-press disabled:opacity-35"
            title="Вернуть (Ctrl+Y)"
            aria-label="Вернуть"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-xl font-mono text-[10px] nx-press"
            style={{ background: 'rgba(255,107,107,0.12)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.3)' }}
            title="Сбросить все настройки и черновик"
          >
            <RotateCcw className="w-3.5 h-3.5" /> СБРОСИТЬ ВСЁ
          </button>
        </div>
      </div>

      {/* РАБОЧАЯ ОБЛАСТЬ: слева редакторы, холст, справа редакторы */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_296px] gap-3 items-start">
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="space-y-3">
          {/* Пропорции */}
          <div className="glass rounded-xl p-2.5 space-y-2">
            <span className="nx-eyebrow">ПРОПОРЦИИ</span>
            <div className="flex flex-wrap gap-1.5">
              {FRAME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPresetId(p.id)}
                  className={chip(p.id === presetId)}
                  style={p.id === presetId ? { background: 'var(--color-primary)' } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Параметры рамки */}
          <div className="glass rounded-xl p-2.5 space-y-2">
            <span className="nx-eyebrow">ПАРАМЕТРЫ РАМКИ</span>
            <div>
              <label className={LABEL}>СТИЛЬ</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {([['aurora', 'АВРОРА'], ['neon', 'НЕОН'], ['glass', 'СТЕКЛО'], ['fire', 'ОГОНЬ'], ['ice', 'ЛЁД']] as [FrameStyle, string][]).map(([id, lb]) => (
                  <button
                    key={id}
                    onClick={() => setFrameStyle(id)}
                    className={chip(frameStyle === id)}
                    style={frameStyle === id ? { background: 'var(--color-primary)' } : undefined}
                  >{lb}</button>
                ))}
              </div>
            </div>
            <div>
              <label className={LABEL}>ВИД</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <button
                  onClick={() => setFrameMode('full')}
                  className={chip(frameMode === 'full')}
                  style={frameMode === 'full' ? { background: 'var(--color-primary)' } : undefined}
                >ПОЛНАЯ</button>
                <button
                  onClick={() => setFrameMode('corners')}
                  className={chip(frameMode === 'corners')}
                  style={frameMode === 'corners' ? { background: 'var(--color-primary)' } : undefined}
                >УГЛОВЫЕ СКОБКИ</button>
              </div>
            </div>
            <div>
              <label className={LABEL}>СКРУГЛЕНИЕ УГЛОВ: {preset.radius === 'circle' ? 'КРУГ' : `${frameRadius}%`}</label>
              <input type="range" min={0} max={12} step={0.5} value={frameRadius}
                disabled={preset.radius === 'circle'}
                onChange={(e) => setFrameRadius(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)] disabled:opacity-30" />
            </div>
            <div>
              <label className={LABEL}>ТОЛЩИНА ГРАНИ: {frameWidth}%</label>
              <input type="range" min={50} max={250} value={frameWidth}
                onChange={(e) => setFrameWidth(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]" />
            </div>
          </div>

          {/* Картинка */}
          <div className="glass rounded-xl p-2.5 space-y-2">
            <span className="nx-eyebrow">КАРТИНКА</span>
            <div className="flex flex-wrap gap-1.5 items-center">
              <label className="btn-ghost nx-press px-2.5 py-1.5 min-h-[32px] rounded-lg font-mono text-[10px] flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> {image ? 'ЗАМЕНИТЬ' : 'ЗАГРУЗИТЬ'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button
                  onClick={() => setFitMode('cover')}
                  className={`px-2.5 py-1.5 min-h-[32px] font-mono text-[10px] nx-press ${fitMode === 'cover' ? 'text-black' : 'text-gray-400 bg-white/5'}`}
                  style={fitMode === 'cover' ? { background: 'var(--color-primary)' } : undefined}
                >ЗАПОЛНИТЬ</button>
                <button
                  onClick={() => setFitMode('contain')}
                  className={`px-2.5 py-1.5 min-h-[32px] font-mono text-[10px] nx-press ${fitMode === 'contain' ? 'text-black' : 'text-gray-400 bg-white/5'}`}
                  style={fitMode === 'contain' ? { background: 'var(--color-primary)' } : undefined}
                >ВПИСАТЬ</button>
              </div>
              <button
                onClick={resetView}
                className="btn-ghost nx-press px-2.5 py-1.5 min-h-[32px] rounded-lg font-mono text-[10px] flex items-center gap-1"
                title="Сбросить масштаб и центр"
              >
                <Move className="w-3 h-3" /> ЦЕНТР
              </button>
            </div>
            <div>
              <label className={LABEL}>МАСШТАБ: {Math.round(scale * 100)}%</label>
              <input
                type="range" min={25} max={300} value={Math.round(scale * 100)}
                onChange={(e) => setScale(Number(e.target.value) / 100)}
                className="w-full accent-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Логотип */}
          <div className="glass rounded-xl p-2.5 space-y-2">
            <span className="nx-eyebrow">ЛОГОТИП КАНАЛА</span>
            <div className="flex flex-wrap gap-1.5 items-center">
              <label className="btn-ghost nx-press px-2.5 py-1.5 min-h-[32px] rounded-lg font-mono text-[10px] flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> {logo ? 'ЗАМЕНИТЬ' : 'PNG'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { onPickLogo(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {logo && (
                <button
                  onClick={() => setLogo(null)}
                  className="btn-ghost nx-press px-2.5 py-1.5 min-h-[32px] rounded-lg font-mono text-[10px]"
                >УБРАТЬ</button>
              )}
            </div>
            {logo && (
              <>
                <p className="font-mono text-[9px] text-gray-600">перетащите логотип прямо в кадре</p>
                <div>
                  <label className={LABEL}>РАЗМЕР: {logoSize}%</label>
                  <input type="range" min={5} max={30} value={logoSize}
                    onChange={(e) => setLogoSize(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]" />
                </div>
                <div>
                  <label className={LABEL}>СКРУГЛЕНИЕ: {logoRadius === 50 ? 'КРУГ' : `${logoRadius}%`}</label>
                  <input type="range" min={0} max={50} value={logoRadius}
                    onChange={(e) => setLogoRadius(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]" />
                </div>
                <div>
                  <label className={LABEL}>ПРОЗРАЧНОСТЬ: {logoOpacity}%</label>
                  <input type="range" min={10} max={100} value={logoOpacity}
                    onChange={(e) => setLogoOpacity(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]" />
                </div>
              </>
            )}
          </div>

          {/* Слои */}
          <div className="glass rounded-xl p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
              <span className="nx-eyebrow">СЛОИ</span>
            </div>
            {([
              ['ФОТО', showPhoto, setShowPhoto],
              ['ТЕКСТ', showText, setShowText],
              ['ЭФФЕКТЫ', showFx, setShowFx],
              ['ЛОГОТИП', showLogo, setShowLogo],
              ['РАМКА', showFrame, setShowFrame],
            ] as [string, boolean, (v: boolean) => void][]).map(([lb, on, set]) => (
              <div key={lb} className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-gray-300">{lb}</span>
                <button
                  onClick={() => set(!on)}
                  aria-label={`${on ? 'Скрыть' : 'Показать'} слой ${lb}`}
                  className="w-7 h-7 rounded-md nx-press flex items-center justify-center hover:bg-white/10"
                  style={{ color: on ? 'var(--color-primary)' : '#666' }}
                >
                  {on ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
            <div>
              <label className={LABEL}>ЛОГОТИП ОТНОСИТЕЛЬНО ТЕКСТА</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <button
                  onClick={() => setLogoUnderText(false)}
                  className={chip(!logoUnderText)}
                  style={!logoUnderText ? { background: 'var(--color-primary)' } : undefined}
                >ПОВЕРХ</button>
                <button
                  onClick={() => setLogoUnderText(true)}
                  className={chip(logoUnderText)}
                  style={logoUnderText ? { background: 'var(--color-primary)' } : undefined}
                >ПОД ТЕКСТОМ</button>
              </div>
            </div>
          </div>
        </div>

        {/* ЦЕНТР: холст + экспорт */}
        <div className="space-y-3">
          <div className="nx-panel p-3">
            <FrameCanvas
              state={previewState}
              canvasRef={canvasRef}
              onOffsetChange={(x, y) => { setOx(x); setOy(y); }}
              onScaleChange={setScale}
              onTextMove={(x, y) => { setTextX(x); setTextY(y); }}
              onAngleChange={(d) => setTextAngle(Math.round(d))}
              onLogoMove={(x, y) => { setLogoX(x); setLogoY(y); }}
              compareOn={compareOn}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
              <p className="font-mono text-[9px] text-gray-600">
                {image
                  ? 'тащите картинку ИЛИ текст · кружок над текстом — наклон · Ctrl+колесо — зум вида'
                  : '// загрузите картинку, чтобы начать'}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setCompareOn((v) => !v); setCleanPreview(false); }}
                  className={chip(compareOn)}
                  style={compareOn ? { background: 'var(--color-primary)' } : undefined}
                  title="Ползунок сравнения: слева кадр без эффектов, справа текущий"
                >
                  ДО / ПОСЛЕ
                </button>
                <button
                  onClick={() => { setCleanPreview((v) => !v); setCompareOn(false); }}
                  className={chip(cleanPreview)}
                  style={cleanPreview ? { background: 'var(--color-primary)' } : undefined}
                  title="Показать кадр без ветра, снега, штор и сияния"
                >
                  <Eye className="w-3 h-3 inline mr-1 -mt-0.5" />ЧИСТЫЙ КАДР
                </button>
              </div>
            </div>
          </div>

          {/* Экспорт */}
          <div className="glass rounded-xl p-2.5 flex flex-wrap items-center gap-2">
            <button
              onClick={exportPng}
              disabled={!!exporting}
              className="btn-primary nx-press px-3.5 py-2 min-h-[38px] rounded-xl font-mono text-[11px] font-bold disabled:opacity-50 flex items-center gap-1.5"
            >
              {exporting === 'png' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PNG
            </button>
            <button
              onClick={exportGif}
              disabled={!!exporting}
              className="nx-press px-3.5 py-2 min-h-[38px] rounded-xl font-mono text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
              title="Анимированный GIF — рамка полыхает"
            >
              {exporting === 'gif' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} GIF
            </button>
            <button
              onClick={exportWebp}
              disabled={!!exporting}
              className="nx-press px-3.5 py-2 min-h-[38px] rounded-xl font-mono text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'rgba(0,255,136,0.12)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.28)' }}
              title="Анимированный WebP — легче GIF"
            >
              {exporting === 'webp' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} WEBP
            </button>
            {videoSupported() && (
              <>
                <button
                  onClick={exportVideo}
                  disabled={!!exporting}
                  className="nx-press px-3.5 py-2 min-h-[38px] rounded-xl font-mono text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: 'rgba(125,95,255,0.15)', color: '#7d5fff', border: '1px solid rgba(125,95,255,0.35)' }}
                  title="Короткое видео (mp4, где поддерживается)"
                >
                  {exporting === 'video' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} ВИДЕО
                </button>
                <div className="relative">
                  <select
                    value={videoSeconds}
                    onChange={(e) => setVideoSeconds(Number(e.target.value))}
                    className="appearance-none pl-2.5 pr-7 py-2 rounded-lg text-[10px] font-mono bg-white/5 border border-white/10 text-gray-300 min-h-[36px]"
                    title="Длина видео"
                  >
                    {[2, 4, 6, 8, 10].map((s) => <option key={s} value={s}>{s} сек</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={videoRes}
                    onChange={(e) => setVideoRes(e.target.value as '720' | '1080')}
                    className="appearance-none pl-2.5 pr-7 py-2 rounded-lg text-[10px] font-mono bg-white/5 border border-white/10 text-gray-300 min-h-[36px]"
                    title="Разрешение видео"
                  >
                    <option value="1080">1080p</option>
                    <option value="720">720p</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div className="space-y-3">
          {/* Текст */}
          <div className="glass rounded-xl p-2.5 space-y-2">
            <span className="nx-eyebrow">ТЕКСТ</span>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              placeholder="Например: НОРИЛЬСК · ЛЕТО 2026"
              rows={1}
              maxLength={80}
              className={`${FIELD} resize-none overflow-hidden`}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>ШРИФТ</label>
                <button
                  type="button"
                  onClick={() => setFontModal(true)}
                  className={`${FIELD} mt-1 flex items-center justify-between gap-1 text-left nx-press`}
                >
                  <Type className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="truncate flex-1" style={{ fontFamily }}>{FONTS.find((f) => f.value === fontFamily)?.label || 'Шрифт'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                </button>
              </div>
              <div>
                <label className={LABEL}>РАЗМЕР: {fontSize}</label>
                <input
                  type="range" min={30} max={120} value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)] mt-2"
                />
              </div>
            </div>
            <ColorField label="ЦВЕТ ТЕКСТА" value={textColor} onChange={setTextColor} />

            {/* неон */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-gray-300">НЕОН-СВЕЧЕНИЕ</span>
              <Switch on={neonOn} onToggle={() => setNeonOn((v) => !v)} label="Неон свечение текста" />
            </div>
            {neonOn && (
              <>
                <ColorField label="ЦВЕТ НЕОНА" value={neonColor} onChange={setNeonColor} />
                <div>
                  <label className={LABEL}>СИЛА СВЕЧЕНИЯ: {neonIntensity}%</label>
                  <input
                    type="range" min={10} max={100} value={neonIntensity}
                    onChange={(e) => setNeonIntensity(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]"
                  />
                </div>
              </>
            )}

            {/* наклон */}
            <div>
              <label className={LABEL}>НАКЛОН: {textAngle}°</label>
              <input
                type="range" min={-40} max={40} value={textAngle}
                onChange={(e) => setTextAngle(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
              />
            </div>

            {/* обводка букв */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-gray-300">ОБВОДКА БУКВ</span>
              <Switch on={strokeOn} onToggle={() => setStrokeOn((v) => !v)} label="Обводка букв" />
            </div>
            {strokeOn && (
              <>
                <ColorField label="ЦВЕТ ОБВОДКИ" value={strokeColor} onChange={setStrokeColor} />
                <div>
                  <label className={LABEL}>ТОЛЩИНА ОБВОДКИ: {strokeWidth}%</label>
                  <input
                    type="range" min={5} max={100} value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]"
                  />
                </div>
              </>
            )}
            {/* типографика */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>ИНТЕРВАЛ СТРОК: {(lineHeight / 100).toFixed(2)}</label>
                <input
                  type="range" min={80} max={200} value={lineHeight}
                  onChange={(e) => setLineHeight(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className={LABEL}>РАЗРЯДКА: {(letterSpacing / 10).toFixed(1)}</label>
                <input
                  type="range" min={-20} max={120} value={letterSpacing}
                  onChange={(e) => setLetterSpacing(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* регистр */}
            <div>
              <label className={LABEL}>РЕГИСТР</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {([['none', 'Как есть'], ['upper', 'ПРОПИСНЫЕ'], ['lower', 'строчные'], ['title', 'Заглавные']] as [TextCase, string][]).map(([id, lb]) => (
                  <button
                    key={id}
                    onClick={() => setTextCase(id)}
                    className={chip(textCase === id)}
                    style={textCase === id ? { background: 'var(--color-primary)' } : undefined}
                  >{lb}</button>
                ))}
              </div>
            </div>

            {/* анимация появления */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-gray-300">АНИМАЦИЯ ТЕКСТА</span>
              <Switch on={textAnimOn} onToggle={() => setTextAnimOn((v) => !v)} label="Анимация текста" />
            </div>
            {textAnimOn && (
              <div className="flex flex-wrap gap-1.5">
                {([['fade', 'ПОЯВЛЕНИЕ'], ['slide', 'СДВИГ'], ['type', 'ПЕЧАТЬ']] as [Exclude<TextAnim, 'none'>, string][]).map(([id, lb]) => (
                  <button
                    key={id}
                    onClick={() => setTextAnimKind(id)}
                    className={chip(textAnimKind === id)}
                    style={textAnimKind === id ? { background: 'var(--color-primary)' } : undefined}
                  >{lb}</button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[9px] text-gray-600">
                {plateOn && plateStyle === 'band'
                  ? 'текст закреплён в полосе снизу'
                  : textY == null ? 'позиция: низ по центру (авто)' : `позиция: ${Math.round(textX * 100)}% × ${Math.round(textY * 100)}%`}
              </p>
              <button
                onClick={() => { setTextX(0.5); setTextY(null); setTextAngle(0); }}
                className="btn-ghost nx-press px-2.5 py-1.5 min-h-[32px] rounded-lg font-mono text-[10px] shrink-0"
                title="Вернуть текст вниз по центру, снять наклон"
              >
                СБРОС
              </button>
            </div>
          </div>

          {/* Плашка */}
          <div className="glass rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="nx-eyebrow">ПЛАШКА ПОД ТЕКСТОМ</span>
              <Switch on={plateOn} onToggle={() => setPlateOn((v) => !v)} label="Плашка под текстом" />
            </div>
            {plateOn && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPlateStyle('capsule')}
                    className={chip(plateStyle === 'capsule')}
                    style={plateStyle === 'capsule' ? { background: 'var(--color-primary)' } : undefined}
                  >КАПСУЛА</button>
                  <button
                    onClick={() => setPlateStyle('band')}
                    className={chip(plateStyle === 'band')}
                    style={plateStyle === 'band' ? { background: 'var(--color-primary)' } : undefined}
                  >ПОЛОСА СНИЗУ</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPlateFill('solid')}
                    className={chip(plateFill === 'solid')}
                    style={plateFill === 'solid' ? { background: 'var(--color-primary)' } : undefined}
                  >СПЛОШНОЙ</button>
                  <button
                    onClick={() => setPlateFill('gradient')}
                    className={chip(plateFill === 'gradient')}
                    style={plateFill === 'gradient' ? { background: 'var(--color-primary)' } : undefined}
                  >ГРАДИЕНТ</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ColorField label={plateFill === 'gradient' ? 'ЦВЕТ A' : 'ЦВЕТ ПЛАШКИ'} value={plateColor} onChange={setPlateColor} />
                  {plateFill === 'gradient' && (
                    <ColorField label="ЦВЕТ B" value={plateColor2} onChange={setPlateColor2} />
                  )}
                </div>
                {plateFill === 'gradient' && (
                  <div>
                    <label className={LABEL}>НАПРАВЛЕНИЕ ГРАДИЕНТА: {plateAngle}°</label>
                    <input type="range" min={0} max={360} value={plateAngle}
                      onChange={(e) => setPlateAngle(Number(e.target.value))}
                      className="w-full accent-[var(--color-primary)]" />
                  </div>
                )}
                <div>
                  <label className={LABEL}>ПРОЗРАЧНОСТЬ ПЛАШКИ: {plateAlpha}%</label>
                  <input type="range" min={10} max={100} value={plateAlpha}
                    onChange={(e) => setPlateAlpha(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]" />
                </div>
                <div>
                  <label className={LABEL}>БЛЮР ФОТО ПОД ПЛАШКОЙ: {plateBlur}%</label>
                  <input type="range" min={0} max={100} value={plateBlur}
                    onChange={(e) => setPlateBlur(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]" />
                </div>
              </>
            )}
          </div>

          {/* Сияние */}
          <div className="glass rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="nx-eyebrow">СИЯНИЕ</span>
              <Switch on={auroraOn} onToggle={() => setAuroraOn((v) => !v)} label="Сияние рамки" />
            </div>
            {auroraOn && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL}>ЯРКОСТЬ: {brightness}%</label>
                  <input type="range" min={10} max={100} value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]" />
                </div>
                <div>
                  <label className={LABEL}>СКОРОСТЬ: {(speed / 100).toFixed(1)}×</label>
                  <input type="range" min={20} max={250} value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]" />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-gray-300">ШТОРЫ ВНУТРИ КАДРА</span>
              <Switch on={curtainsOn} onToggle={() => setCurtainsOn((v) => !v)} label="Шторы сияния" />
            </div>
            {curtainsOn && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>ЯРКОСТЬ ШТОР: {curtainIntensity}%</label>
                    <input type="range" min={10} max={100} value={curtainIntensity}
                      onChange={(e) => setCurtainIntensity(Number(e.target.value))}
                      className="w-full accent-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className={LABEL}>СКОРОСТЬ ШТОР: {(curtainSpeed / 100).toFixed(1)}×</label>
                    <input type="range" min={20} max={250} value={curtainSpeed}
                      onChange={(e) => setCurtainSpeed(Number(e.target.value))}
                      className="w-full accent-[var(--color-primary)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>НАКЛОН ШТОР: {curtainAngle}°</label>
                    <input type="range" min={-45} max={45} value={curtainAngle}
                      onChange={(e) => setCurtainAngle(Number(e.target.value))}
                      className="w-full accent-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className={LABEL}>ШИРИНА: {curtainWidth}%</label>
                    <input type="range" min={50} max={200} value={curtainWidth}
                      onChange={(e) => setCurtainWidth(Number(e.target.value))}
                      className="w-full accent-[var(--color-primary)]" />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>СТОЛБЦЫ: {curtainCount}</label>
                  <input type="range" min={3} max={8} value={curtainCount}
                    onChange={(e) => setCurtainCount(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]" />
                </div>
              </>
            )}
          </div>

          {/* Эффекты */}
          <div className="glass rounded-xl p-2.5 space-y-2">
            <span className="nx-eyebrow">ЭФФЕКТЫ ПОВЕРХ</span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-gray-300">КОСМИЧЕСКИЙ ВЕТЕР</span>
              <Switch on={windOn} onToggle={() => setWindOn((v) => !v)} label="Космический ветер" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-gray-300">ПАДАЮЩИЙ СНЕГ</span>
              <Switch on={snowOn} onToggle={() => setSnowOn((v) => !v)} label="Падающий снег" />
            </div>
            {(windOn || snowOn) && (
              <div>
                <label className={LABEL}>ПЛОТНОСТЬ: {fxIntensity}%</label>
                <input type="range" min={15} max={100} value={fxIntensity}
                  onChange={(e) => setFxIntensity(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ИСТОРИЯ ЭКСПОРТОВ — под рабочей областью */}
      <div className="glass rounded-xl p-2.5">
        <div className="flex items-center justify-between">
          <span className="nx-eyebrow">ИСТОРИЯ ЭКСПОРТОВ</span>
          {history.length > 0 && (
            <button
              onClick={() => setHistory([])}
              className="btn-ghost nx-press px-2.5 py-1.5 min-h-[32px] rounded-lg font-mono text-[10px] flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> ОЧИСТИТЬ
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="font-mono text-[9px] text-gray-600 mt-2">// пока пусто — сохранённые PNG / GIF / видео появятся здесь</p>
        ) : (
          <div className="mt-2 space-y-1">
            {history.map((it) => (
              <div key={it.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,255,136,0.12)', color: 'var(--color-primary)' }}>{it.type}</span>
                <span className="font-mono text-[10px] text-gray-300 truncate flex-1">{it.name}</span>
                <span className="font-mono text-[9px] text-gray-500 shrink-0">{Math.round(it.size / 1024)} КБ</span>
                <span className="font-mono text-[9px] text-gray-500 shrink-0">
                  {new Date(it.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => downloadBlob(it.blob, it.name)}
                  className="btn-ghost nx-press px-2 py-1 rounded-md font-mono text-[9px] flex items-center gap-1 shrink-0"
                  title="Скачать снова"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Спиннер экспорта (чистый CSS — не зависит от framer-motion) */}
      {exporting && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(5,8,14,0.62)', backdropFilter: 'blur(10px) saturate(1.1)', WebkitBackdropFilter: 'blur(10px) saturate(1.1)' }}
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: 'var(--color-primary)', borderRightColor: 'var(--color-primary)' }}
              />
              <div
                className="absolute inset-2 rounded-full border-2 border-transparent animate-spin"
                style={{ borderBottomColor: 'var(--color-accent)', borderLeftColor: 'var(--color-accent)', animationDuration: '1.5s', animationDirection: 'reverse' }}
              />
              <div
                className="absolute inset-4 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: 'var(--color-secondary)', animationDuration: '0.8s' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ background: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-glow)' }}
                />
              </div>
            </div>
            <p className="font-mono text-sm font-bold animate-pulse" style={{ color: 'var(--color-primary)', textShadow: '0 0 10px var(--color-glow)' }}>
              {exporting === 'png' ? 'ГОТОВИМ PNG…' : exporting === 'gif' ? 'ГОТОВИМ GIF…' : exporting === 'webp' ? 'ГОТОВИМ WEBP…' : 'ЗАПИСЫВАЕМ ВИДЕО…'}
            </p>
          </div>
        </div>
      )}

      {/* Окно выбора шрифта */}
      {fontModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(5,8,14,0.72)' }}
          onClick={() => setFontModal(false)}
        >
          <div className="glass rounded-2xl p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="nx-eyebrow">ВЫБОР ШРИФТА</span>
              <button
                onClick={() => setFontModal(false)}
                aria-label="Закрыть"
                className="p-1.5 rounded-lg hover:bg-white/10 nx-press"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className={LABEL}>ФРАЗА ДЛЯ ПРЕВЬЮ</label>
              <input
                value={fontPhrase}
                onChange={(e) => setFontPhrase(e.target.value)}
                className={FIELD}
                maxLength={60}
                placeholder="НОРИЛЬСК · ЛЕТО 2026"
              />
            </div>
            <div>
              <label className={LABEL}>ШРИФТ</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                size={7}
                className={`${FIELD} mt-1 h-auto`}
              >
                {FONTS.map((f) => (
                  <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 min-h-[92px] flex items-center justify-center">
              <p className="text-center text-2xl leading-snug px-2" style={{ fontFamily, color: 'var(--color-primary)' }}>
                {fontPhrase || 'НОРИЛЬСК · ЛЕТО 2026'}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setFontModal(false)}
                className="btn-primary nx-press px-4 py-2 rounded-xl font-mono text-[11px] font-bold"
              >
                ГОТОВО
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
