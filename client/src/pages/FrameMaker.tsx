import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Upload, Move, Download, Pipette, Trash2, Eye, ChevronDown, X, Type } from 'lucide-react';
import FrameCanvas from '../components/framemaker/FrameCanvas';
import {
  FRAME_PRESETS, type FrameState, type FitMode, type PlateStyle, type PlateFill,
} from '../components/framemaker/framePresets';
import { exportFrameGif } from '../components/framemaker/exportGif';
import { exportFrameVideo, videoSupported, extForMime } from '../components/framemaker/exportVideo';
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

/** Выбор цвета: кнопка-плашка раскрывает палитру (палитра + свой цвет + пипетка) */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dropperOk] = useState(() => typeof window !== 'undefined' && 'EyeDropper' in window);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = async () => {
    try {
      const ED = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const res = await new ED().open();
      onChange(res.sRGBHex);
    } catch { /* отменено */ }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <label className={LABEL}>{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 nx-press"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="w-5 h-5 rounded-md border border-white/20 shrink-0" style={{ background: value }} />
        <span className="font-mono text-[10px] text-gray-300 flex-1 text-left">{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 p-2 rounded-xl glass border border-white/10 shadow-2xl">
          <div className="grid grid-cols-6 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false); }}
                aria-label={`Цвет ${c}`}
                className="w-full aspect-square rounded-md border nx-press"
                style={{ background: c, borderColor: value.toLowerCase() === c.toLowerCase() ? 'var(--color-primary)' : 'rgba(255,255,255,0.18)' }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="color" value={value}
              onChange={(e) => onChange(e.target.value)}
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
            <span className="font-mono text-[9px] text-gray-500">свой цвет / пипетка</span>
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

  const [auroraOn, setAuroraOn] = useState(true);
  const [brightness, setBrightness] = useState(85);
  const [speed, setSpeed] = useState(100);

  const [curtainsOn, setCurtainsOn] = useState(true);
  const [curtainIntensity, setCurtainIntensity] = useState(55);
  const [curtainSpeed, setCurtainSpeed] = useState(100);

  const [windOn, setWindOn] = useState(true);
  const [snowOn, setSnowOn] = useState(true);
  const [fxIntensity, setFxIntensity] = useState(55);

  const [videoSeconds, setVideoSeconds] = useState(4);
  const [cleanPreview, setCleanPreview] = useState(false);
  const [exporting, setExporting] = useState<'png' | 'gif' | 'video' | null>(null);
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
    auroraOn,
    auroraBrightness: brightness / 100,
    auroraSpeed: speed / 100,
    windOn,
    snowOn,
    fxIntensity: fxIntensity / 100,
    frameRadius: frameRadius / 100,
    frameWidth: frameWidth / 100,
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
      const blob = await exportFrameVideo(state, { seconds: videoSeconds, fps: 30 });
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
            />
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
              <p className="font-mono text-[9px] text-gray-600">
                {image
                  ? 'тащите картинку ИЛИ текст · кружок над текстом — наклон · колесо/пинч — масштаб'
                  : '// загрузите картинку, чтобы начать'}
              </p>
              <button
                onClick={() => setCleanPreview((v) => !v)}
                className={chip(cleanPreview)}
                style={cleanPreview ? { background: 'var(--color-primary)' } : undefined}
                title="Показать кадр без ветра, снега, штор и сияния"
              >
                <Eye className="w-3 h-3 inline mr-1 -mt-0.5" />ЧИСТЫЙ КАДР
              </button>
            </div>
          </div>

          {/* Экспорт */}
          <div className="glass rounded-xl p-2.5 flex flex-wrap items-center gap-2">
            <button
              onClick={exportPng}
              disabled={!!exporting}
              className="btn-primary nx-press px-3.5 py-2 min-h-[38px] rounded-xl font-mono text-[11px] font-bold disabled:opacity-50 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> PNG
            </button>
            <button
              onClick={exportGif}
              disabled={!!exporting}
              className="nx-press px-3.5 py-2 min-h-[38px] rounded-xl font-mono text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
              title="Анимированный GIF — рамка полыхает"
            >
              GIF {exporting === 'gif' ? '…' : ''}
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
                  ВИДЕО {exporting === 'video' ? '…' : ''}
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
              </>
            )}
            {exporting && (
              <span className="font-mono text-[9px] text-gray-500">готовим {exporting.toUpperCase()}…</span>
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
