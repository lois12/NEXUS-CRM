import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Upload, Move, Download } from 'lucide-react';
import FrameCanvas from '../components/framemaker/FrameCanvas';
import {
  FRAME_PRESETS, type FrameState, type FitMode, type TextShape,
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

const FONTS = [
  { label: 'Montserrat', value: '"Montserrat", sans-serif' },
  { label: 'Playfair', value: '"Playfair Display", serif' },
  { label: 'Russo One', value: '"Russo One", sans-serif' },
  { label: 'Caveat', value: '"Caveat", cursive' },
  { label: 'Inter', value: '"Inter", sans-serif' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
];

const TEXT_COLORS = ['#ffffff', '#0a0a0f', '#00ff88', '#00d4ff'];

const FIELD = 'w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]';
const LABEL = 'text-[10px] font-mono text-gray-500 tracking-wider';

function chip(active: boolean): string {
  return `px-3.5 py-2 min-h-[40px] rounded-xl font-mono text-xs nx-press transition-all ${
    active ? 'text-black' : 'text-gray-400 bg-white/5 hover:text-gray-200'
  }`;
}

/** Переключатель-тумблер (сияние / ветер / снег) */
function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="w-12 h-6 rounded-full transition-colors relative nx-press shrink-0"
      style={{ background: on ? 'var(--color-primary)' : '#3a3a50' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(24px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

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
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [textX, setTextX] = useState(0.5);
  const [textY, setTextY] = useState<number | null>(null); // null = авто-низ по центру
  const [textAngle, setTextAngle] = useState(0);
  const [textShape, setTextShape] = useState<TextShape>('straight');
  const [textBend, setTextBend] = useState(55); // ×0.01 → 0.55

  const [auroraOn, setAuroraOn] = useState(true);
  const [brightness, setBrightness] = useState(85);
  const [speed, setSpeed] = useState(100);

  const [windOn, setWindOn] = useState(true);
  const [snowOn, setSnowOn] = useState(true);
  const [fxIntensity, setFxIntensity] = useState(55);

  const [exporting, setExporting] = useState<'png' | 'gif' | 'video' | null>(null);

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
    textShape,
    textBend: textBend / 100,
    auroraOn,
    auroraBrightness: brightness / 100,
    auroraSpeed: speed / 100,
    windOn,
    snowOn,
    fxIntensity: fxIntensity / 100,
  };

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

  const resetView = () => { setScale(1); setOx(0); setOy(0); };

  const exportPng = async () => {
    const c = canvasRef.current;
    if (!c) return;
    setExporting('png');
    try {
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
      if (!blob) throw new Error('png');
      downloadBlob(blob, `frame-${preset.id}.png`);
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
      downloadBlob(blob, `frame-${preset.id}.gif`);
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
      const blob = await exportFrameVideo(state, { seconds: 4, fps: 30 });
      if (!blob) { showToast('Браузер не поддерживает запись видео', 'error'); return; }
      const ext = extForMime(blob.type);
      downloadBlob(blob, `frame-${preset.id}.${ext}`);
      showToast(ext === 'mp4' ? 'Видео сохранено (mp4)' : 'Видео сохранено (webm)', 'success');
    } catch {
      showToast('Ошибка экспорта видео', 'error');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center p-2 min-h-[40px] min-w-[40px] rounded-xl glass hover:bg-white/10 nx-press"
          aria-label="Назад"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold font-mono neon-text flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
            <Sparkles className="w-5 h-5" /> РАМКА
          </h1>
          <p className="nx-eyebrow mt-1">СЕВЕРНОЕ СИЯНИЕ ДЛЯ КАНАЛА</p>
        </div>
      </div>

      {/* Canvas preview */}
      <div className="nx-panel p-3">
        <FrameCanvas
          state={state}
          canvasRef={canvasRef}
          onOffsetChange={(x, y) => { setOx(x); setOy(y); }}
          onScaleChange={setScale}
          onTextMove={(x, y) => { setTextX(x); setTextY(y); }}
        />
        <p className="font-mono text-[10px] text-gray-600 text-center mt-2">
          {image
            ? 'перетаскивайте картинку ИЛИ текст по холсту · колесо/пинч — масштаб'
            : '// загрузите картинку, чтобы начать'}
        </p>
      </div>

      {/* Пропорции */}
      <div className="glass rounded-xl p-3 space-y-2">
        <span className="nx-eyebrow">ПРОПОРЦИИ</span>
        <div className="flex flex-wrap gap-2">
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

      {/* Картинка */}
      <div className="glass rounded-xl p-3 space-y-3">
        <span className="nx-eyebrow">КАРТИНКА</span>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="btn-ghost nx-press px-3.5 py-2 min-h-[40px] rounded-xl font-mono text-xs flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> {image ? 'ЗАМЕНИТЬ' : 'ЗАГРУЗИТЬ'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            <button
              onClick={() => setFitMode('cover')}
              className={`px-3 py-2 min-h-[40px] font-mono text-[11px] nx-press ${fitMode === 'cover' ? 'text-black' : 'text-gray-400 bg-white/5'}`}
              style={fitMode === 'cover' ? { background: 'var(--color-primary)' } : undefined}
            >ЗАПОЛНИТЬ</button>
            <button
              onClick={() => setFitMode('contain')}
              className={`px-3 py-2 min-h-[40px] font-mono text-[11px] nx-press ${fitMode === 'contain' ? 'text-black' : 'text-gray-400 bg-white/5'}`}
              style={fitMode === 'contain' ? { background: 'var(--color-primary)' } : undefined}
            >ВПИСАТЬ</button>
          </div>
          <button
            onClick={resetView}
            className="btn-ghost nx-press px-3.5 py-2 min-h-[40px] rounded-xl font-mono text-[11px] flex items-center gap-1.5"
            title="Сбросить масштаб и центр"
          >
            <Move className="w-3.5 h-3.5" /> ПО ЦЕНТРУ
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

      {/* Текст */}
      <div className="glass rounded-xl p-3 space-y-3">
        <span className="nx-eyebrow">ТЕКСТ НА КАРТИНКЕ</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Например: НОРИЛЬСК · ЛЕТО 2026"
          className={FIELD}
          maxLength={80}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>ШРИФТ</label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className={FIELD}>
              {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>РАЗМЕР: {fontSize}</label>
            <input
              type="range" min={30} max={120} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)] mt-2"
            />
          </div>
          <div>
            <label className={LABEL}>ЦВЕТ</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color" value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-gray-700"
              />
              <div className="flex gap-1.5">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTextColor(c)}
                    aria-label={`Цвет ${c}`}
                    className="w-7 h-7 rounded-lg border nx-press"
                    style={{ background: c, borderColor: textColor === c ? 'var(--color-primary)' : 'rgba(255,255,255,0.2)' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* позиция / наклон / форма */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>НАКЛОН: {textAngle}°</label>
            <input
              type="range" min={-40} max={40} value={textAngle}
              onChange={(e) => setTextAngle(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)] mt-2"
            />
          </div>
          <div>
            <label className={LABEL}>ФОРМА</label>
            <select value={textShape} onChange={(e) => setTextShape(e.target.value as TextShape)} className={`${FIELD} mt-1`}>
              <option value="straight">Прямая</option>
              <option value="arc-up">Дуга вверх (∩)</option>
              <option value="arc-down">Дуга вниз (∪)</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>ИЗГИБ: {textShape === 'straight' ? '—' : `${textBend}%`}</label>
            <input
              type="range" min={15} max={100} value={textBend}
              disabled={textShape === 'straight'}
              onChange={(e) => setTextBend(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)] mt-2 disabled:opacity-30"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-gray-600">
            {textY == null ? 'позиция: низ по центру (авто)' : `позиция: ${Math.round(textX * 100)}% × ${Math.round(textY * 100)}%`}
            {' · '}
            тащите текст мышкой по картинке
          </p>
          <button
            onClick={() => { setTextX(0.5); setTextY(null); setTextAngle(0); }}
            className="btn-ghost nx-press px-3.5 py-2 min-h-[40px] rounded-xl font-mono text-[11px]"
            title="Вернуть текст вниз по центру, снять наклон"
          >
            СБРОС ПОЗИЦИИ
          </button>
        </div>
      </div>

      {/* Сияние */}
      <div className="glass rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="nx-eyebrow">СИЯНИЕ (СЕВЕРНОЕ СИЯНИЕ)</span>
          <Switch on={auroraOn} onToggle={() => setAuroraOn((v) => !v)} label="Сияние" />
        </div>
        {auroraOn && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>ЯРКОСТЬ: {brightness}%</label>
              <input
                type="range" min={10} max={100} value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)] mt-2"
              />
            </div>
            <div>
              <label className={LABEL}>СКОРОСТЬ: {(speed / 100).toFixed(1)}×</label>
              <input
                type="range" min={20} max={250} value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)] mt-2"
              />
            </div>
          </div>
        )}
      </div>

      {/* Эффекты поверх кадра */}
      <div className="glass rounded-xl p-3 space-y-3">
        <span className="nx-eyebrow">ЭФФЕКТЫ ПОВЕРХ ФОТО И ТЕКСТА</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <span className="font-mono text-[11px] text-gray-300">КОСМИЧЕСКИЙ ВЕТЕР</span>
            <Switch on={windOn} onToggle={() => setWindOn((v) => !v)} label="Космический ветер" />
          </div>
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <span className="font-mono text-[11px] text-gray-300">ПАДАЮЩИЙ СНЕГ</span>
            <Switch on={snowOn} onToggle={() => setSnowOn((v) => !v)} label="Падающий снег" />
          </div>
        </div>
        {(windOn || snowOn) && (
          <div>
            <label className={LABEL}>ПЛОТНОСТЬ: {fxIntensity}%</label>
            <input
              type="range" min={15} max={100} value={fxIntensity}
              onChange={(e) => setFxIntensity(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)] mt-2"
            />
          </div>
        )}
        <p className="font-mono text-[10px] text-gray-600">
          ветер — редкие световые штрихи, снег — мягкие хлопья; оба идут поверх кадра, но не густят
        </p>
      </div>

      {/* Экспорт */}
      <div className="sticky bottom-0 flex items-center gap-2 pt-2 flex-wrap" style={{ background: 'linear-gradient(transparent, rgba(10,10,15,0.92) 35%)' }}>
        <button
          onClick={exportPng}
          disabled={!!exporting}
          className="btn-primary nx-press px-4 py-2.5 min-h-[44px] rounded-xl font-mono text-xs font-bold disabled:opacity-50 flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> PNG
        </button>
        <button
          onClick={exportGif}
          disabled={!!exporting}
          className="nx-press px-4 py-2.5 min-h-[44px] rounded-xl font-mono text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
          title="Анимированный GIF — рамка полыхает"
        >
          GIF {exporting === 'gif' ? '…' : ''}
        </button>
        {videoSupported() && (
          <button
            onClick={exportVideo}
            disabled={!!exporting}
            className="nx-press px-4 py-2.5 min-h-[44px] rounded-xl font-mono text-xs font-bold flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'rgba(125,95,255,0.15)', color: '#7d5fff', border: '1px solid rgba(125,95,255,0.35)' }}
            title="Короткое видео (mp4, где поддерживается)"
          >
            ВИДЕО {exporting === 'video' ? '…' : ''}
          </button>
        )}
        {exporting && (
          <span className="font-mono text-[10px] text-gray-500">готовим {exporting.toUpperCase()}…</span>
        )}
      </div>
    </div>
  );
}
