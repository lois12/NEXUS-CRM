import {
  Square, PenTool, Type, Eraser, Lasso, Stamp,
} from 'lucide-react';
import { showToast } from '../components/ui/NexusModal';
import type { CollageUIProps } from './editorProps';
import { FORMATS, FORMAT_GROUPS, resolveSize } from './types';
import { CLIPART } from '../utils/collageArt';
import { PRESETS } from './constants';

/** Tools / shapes / formats / view toolbar */
export function CollageToolbar(props: CollageUIProps) {
  const {
    undo, redo, histIdx, history, setShapeMenuOpen, shapeMenuOpen, addShape,
    toolMode, setToolMode, drawing, setDrawing, drawPts, setDrawPts, addTextZone, addBadgeZone,
    addArtZone, finishPolygon,
    fmt, fmtDef, canFlip, format, orient, customW, customH,
    formatMenuOpen, orientMenuOpen, setFormatMenuOpen, setOrientMenuOpen,
    setFormat, setOrient, setCustomW, setCustomH,
    setZones, setSelId, selId, removeZone, zoomAtCenter, fitView, viewZoom,
    showGrid, setShowGrid, showThirds, setShowThirds, gridStep, setGridStep,
  } = props;
  return (
    <>
      {/* Toolbar — z above page strip (.glass creates stacking contexts via backdrop-filter) */}
      <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-2 relative z-50">
        <span className="font-mono text-[10px] text-gray-500">ЗОНА:</span>
        {/* Undo / Redo arrows */}
        <button onClick={undo} disabled={histIdx <= 0}
          className="px-2.5 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 disabled:opacity-30"
          title="Отменить (назад)">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h13a4 4 0 0 1 0 8h-3" /><path d="M7 6l-4 4 4 4" /></svg>
        </button>
        <button onClick={redo} disabled={histIdx >= history.length - 1}
          className="px-2.5 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 disabled:opacity-30"
          title="Вернуть (вперёд)">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H8a4 4 0 0 0 0 8h3" /><path d="M17 6l4 4-4 4" /></svg>
        </button>

        <div className="relative">
          <button onClick={() => setShapeMenuOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all"
            title="Добавить фигуру">
            <Square className="w-3.5 h-3.5" /> ▾
          </button>
          {shapeMenuOpen && (
            <div className="absolute left-0 top-full mt-1 z-[999] p-2 rounded-xl"
              style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 280, maxHeight: 360, overflowY: 'auto' }}>
              <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">Фигуры</div>
              <div className="grid grid-cols-4 gap-1">
                {([
                  ['rect', 'Прямоугольник', 'M4 4h16v16H4z'],
                  ['circle', 'Круг', 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z'],
                  ['ellipse', 'Эллипс', 'M12 5c4.4 0 8 2.7 8 6s-3.6 6-8 6-8-2.7-8-6 3.6-6 8-6z'],
                  ['squircle', 'Скруглённый квадрат', 'M7 4h10c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3z'],
                  ['diamond', 'Ромб', 'M12 3l9 9-9 9-9-9z'],
                  ['triangle', 'Треугольник', 'M12 4l9 16H3z'],
                  ['pentagon', 'Пятиугольник', 'M12 3l9 6.5-3.4 10.5H6.4L3 9.5z'],
                  ['hexagon', 'Шестиугольник', 'M12 3l8 4.5v9L12 21l-8-4.5v-9z'],
                  ['octagon', 'Восьмиугольник', 'M8 3h8l5 5v8l-5 5H8l-5-5V8z'],
                  ['semicircle', 'Полукруг', 'M3 17a9 9 0 0 1 18 0z'],
                  ['arch', 'Арка', 'M4 20v-8a8 8 0 0 1 16 0v8z'],
                  ['star', 'Звезда', 'M12 3l2.2 6.2 6.8.2-5.3 4.3 1.9 6.5-5.6-3.8-5.6 3.8 1.9-6.5L3 9.4l6.8-.2z'],
                  ['spark', 'Искра', 'M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z'],
                  ['heart', 'Сердце', 'M12 20s-8-4.7-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.3-8 10-8 10z'],
                  ['flower', 'Цветок', 'M12 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm0-6a3 3 0 0 1 2 5.2A3 3 0 0 1 18 9a3 3 0 0 1-1 5.8A3 3 0 0 1 12 20a3 3 0 0 1-5-5.2A3 3 0 0 1 6 9a3 3 0 0 1 4-3z'],
                  ['cloud', 'Облако', 'M6 18h11a4 4 0 0 0 .5-8 6 6 0 0 0-11.2 2A3.5 3.5 0 0 0 6 18z'],
                  ['drop', 'Капля', 'M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z'],
                  ['blob', 'Пятно', 'M12 3c4 0 8 2.5 8 7.5S17 21 10 21 3 16 4 10 8 3 12 3z'],
                  ['cross', 'Крест', 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'],
                  ['bolt', 'Молния', 'M13 2L5 14h6l-2 8 10-14h-6z'],
                  ['arrowR', 'Стрелка →', 'M3 8h12V5l6 6-6 6v-3H3z'],
                  ['arrowU', 'Стрелка ↑', 'M8 21V9H5l7-8 7 8h-3v12z'],
                  ['chevron', 'Шеврон', 'M5 4l8 8-8 8 3 3 11-11L8 1z'],
                  ['brushWide', 'Широкий мазок', 'M3 12c4-4 8-4 10-2s4 4 8 2v4c-4 2-8 2-10 0s-6-2-8 2z'],
                  ['brushDry', 'Сухой мазок', 'M3 13c3-3 6-3 9-1s6 3 9 1v2c-3 2-6 2-9 0s-6-2-9 1z'],
                  ['splash', 'Сплэш', 'M12 6c2 0 3 2 5 2s4-1 4 2-3 3-2 5-2 4-5 3-3-3-5-2-4-1-4-4 3-3 2-5 2-3 5-1z'],
                  ['ragged', 'Рваный край', 'M4 8l2 1 3-2 2 2 3-1 2 2 3-1 1 3-1 2 2 2-3 1-1 2-3-1-2 2-2-1-3 1-2-2-3 1z'],
                ] as const).map(([t, label, d]) => (
                  <button key={t} onClick={() => { addShape(t); setShapeMenuOpen(false); }}
                    className="p-2 rounded-lg hover:bg-white/10 flex flex-col items-center justify-center gap-0.5"
                    title={label}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" strokeLinejoin="round"><path d={d} /></svg>
                    <span className="font-mono text-[7px] text-gray-500 leading-tight text-center">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button onClick={() => { setToolMode(t => t === 'draw' ? 'draw' : 'draw'); setDrawing(v => !v); setDrawPts([]); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs transition-all"
          style={drawing && toolMode === 'draw' ? { background: 'var(--color-primary)', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
          title="Нарисовать произвольную зону точками">
          <PenTool className="w-3.5 h-3.5" /> Точки {drawing && toolMode === 'draw' ? `(${drawPts.length})` : ''}
        </button>
        <button onClick={() => { setDrawing(false); setDrawPts([]); setToolMode(t => t === 'lasso' ? 'draw' : 'lasso'); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs transition-all"
          style={toolMode === 'lasso' ? { background: 'var(--color-primary)', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
          title="Лассо — обвести мышью/пальцем">
          <Lasso className="w-3.5 h-3.5" /> Лассо
        </button>
        <button onClick={() => { setDrawing(false); setDrawPts([]); setToolMode(t => t === 'brush' ? 'draw' : 'brush'); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs transition-all"
          style={toolMode === 'brush' ? { background: 'var(--color-primary)', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
          title="Кисть-мазок — свободная маска">
          <Lasso className="w-3.5 h-3.5" /> Мазок
        </button>
        <button onClick={() => { if (selId) removeZone(selId); else showToast('Выберите зону', 'error'); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10"
          title="Ластик — удалить выбранную маску">
          <Eraser className="w-3.5 h-3.5" /> Ластик
        </button>
        <button onClick={addTextZone}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all"
          title="Добавить текст">
          <Type className="w-3.5 h-3.5" /> Текст
        </button>
        <button onClick={addBadgeZone}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all"
          title="Бейдж «дата · место»">
          <Type className="w-3.5 h-3.5" /> Бейдж
        </button>
        <div className="relative">
          <button
            onClick={() => {
              const el = document.getElementById('clipart-menu');
              if (el) el.classList.toggle('hidden');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all"
            title="Векторный клипарт">
            <Stamp className="w-3.5 h-3.5" /> Клипарт
          </button>
          <div id="clipart-menu" className="hidden absolute left-0 top-full mt-1 z-[999] p-2 rounded-xl"
            style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 280, maxHeight: 320, overflowY: 'auto' }}>
            <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">Клипарт</div>
            <div className="grid grid-cols-4 gap-1">
              {CLIPART.map(a => (
                <button key={a.key} onClick={() => { addArtZone(a.key); document.getElementById('clipart-menu')?.classList.add('hidden'); }}
                  className="p-2 rounded-lg hover:bg-white/10 flex flex-col items-center gap-0.5"
                  title={a.label}>
                  <svg viewBox="0 0 24 24" className="w-5 h-5"><path d={a.path} fill="var(--color-primary)" /></svg>
                  <span className="font-mono text-[7px] text-gray-500 leading-tight text-center">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="w-px h-6 bg-white/10 mx-1" />
        {/* view zoom / grid */}
        <span className="font-mono text-[10px] text-gray-500">ВИД:</span>
        <button onClick={() => zoomAtCenter(1 / 1.25)} className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10" title="Отдалить">−</button>
        <span className="font-mono text-[10px] text-gray-400 w-10 text-center">{Math.round(viewZoom * 100)}%</span>
        <button onClick={() => zoomAtCenter(1.25)} className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10" title="Приблизить">+</button>
        <button onClick={fitView} className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10" title="Вписать (100%)">Вписать</button>
        <span className="font-mono text-[9px] text-gray-600 hidden xl:inline">колесо — зум · Space+drag — пан · Shift+колесо — зум фото</span>
        <button onClick={() => setShowGrid(v => !v)}
          className="px-2 py-1.5 rounded-lg font-mono text-[10px] transition-all"
          style={showGrid ? { background: 'var(--color-primary)', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
          title="Сетка">
          Сетка
        </button>
        <button onClick={() => setShowThirds(v => !v)}
          className="px-2 py-1.5 rounded-lg font-mono text-[10px] transition-all"
          style={showThirds ? { background: 'var(--color-primary)', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
          title="Трети / направляющие">
          Трети
        </button>
        {showGrid && (
          <input type="range" min={2} max={20} value={gridStep}
            onChange={e => setGridStep(+e.target.value)}
            className="w-20 accent-[var(--color-primary)]" title={`Шаг сетки ${gridStep}%`} />
        )}
        {drawing && (
          <>
            <button onClick={finishPolygon} disabled={drawPts.length < 3}
              className="btn-primary px-3 py-2 rounded-lg font-mono text-xs font-bold disabled:opacity-40"
              >ГОТОВО</button>
            <button onClick={() => { setDrawing(false); setDrawPts([]); }}
              className="px-3 py-2 rounded-lg font-mono text-xs glass text-gray-400">ОТМЕНА</button>
          </>
        )}

        <div className="w-px h-6 bg-white/10 mx-1" />

        <span className="font-mono text-[10px] text-gray-500">ФОРМАТ:</span>
        <div className="relative">
          <button onClick={() => { setFormatMenuOpen(v => !v); setOrientMenuOpen(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all"
            title="Формат холста">
            {fmtDef.label} {fmt.w}×{fmt.h} ▾
          </button>
          {formatMenuOpen && (
            <div className="absolute left-0 top-full mt-1 z-[999] p-2 rounded-xl space-y-2"
              style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 280 }}>
              {FORMAT_GROUPS.map(g => (
                <div key={g.key}>
                  <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">{g.title}</div>
                  {g.key === 'custom' ? (
                    <div className="p-2 rounded-lg space-y-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-2">
                        <label className="font-mono text-[9px] text-gray-500 w-6">W</label>
                        <input type="number" min={16} max={8000} value={customW}
                          onChange={e => setCustomW(+e.target.value || 0)}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 font-mono text-xs text-white outline-none focus:border-[var(--color-primary)]" />
                        <label className="font-mono text-[9px] text-gray-500 w-6">H</label>
                        <input type="number" min={16} max={8000} value={customH}
                          onChange={e => setCustomH(+e.target.value || 0)}
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 font-mono text-xs text-white outline-none focus:border-[var(--color-primary)]" />
                      </div>
                      <button onClick={() => { setFormat('custom'); setFormatMenuOpen(false); }}
                        className="w-full py-1.5 rounded-lg font-mono text-[10px] font-bold"
                        style={{ background: 'var(--color-primary)', color: '#000' }}>ПРИМЕНИТЬ</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1">
                      {g.ids.map(id => {
                        const d = FORMATS[id];
                        const sz = resolveSize(id, d.flippable ? orient : (d.locked || 'portrait'), customW, customH);
                        const active = format === id;
                        return (
                          <button key={id}
                            onClick={() => {
                              setFormat(id);
                              if (d.locked) setOrient(d.locked);
                              setFormatMenuOpen(false);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-left"
                            style={active ? { background: 'var(--color-primary)', color: '#000' } : {}}>
                            {/* ratio thumb */}
                            <span className="shrink-0 rounded-[2px] border"
                              style={{
                                width: 18, height: 18,
                                borderColor: active ? '#000' : 'var(--color-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                              <span style={{
                                background: active ? '#000' : 'var(--color-primary)',
                                width: Math.max(4, 16 * Math.min(1, sz.w / sz.h)),
                                height: Math.max(4, 16 * Math.min(1, sz.h / sz.w)),
                                borderRadius: 1,
                              }} />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-mono text-[11px] truncate">{d.label}</span>
                              <span className="block font-mono text-[8px] opacity-60">{sz.w}×{sz.h}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orientation — separate dropdown (like shapes/masks) */}
        <div className="relative">
          <button onClick={() => { setOrientMenuOpen(v => !v); setFormatMenuOpen(false); }}
            disabled={!canFlip}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title={canFlip ? 'Ориентация' : 'Формат фиксирован'}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              {orient === 'landscape'
                ? <rect x="3" y="6" width="18" height="12" rx="1.5" />
                : <rect x="7" y="3" width="10" height="18" rx="1.5" />}
            </svg>
            {orient === 'landscape' ? 'Гориз.' : 'Верт.'} ▾
          </button>
          {orientMenuOpen && canFlip && (
            <div className="absolute left-0 top-full mt-1 z-[999] p-2 rounded-xl space-y-1"
              style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 170 }}>
              <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">Ориентация</div>
              {([
                ['portrait', 'Вертикальная', <rect key="p" x="7" y="3" width="10" height="18" rx="1.5" />],
                ['landscape', 'Горизонтальная', <rect key="l" x="3" y="6" width="18" height="12" rx="1.5" />],
              ] as const).map(([o, label, icon]) => (
                <button key={o}
                  onClick={() => { setOrient(o); setOrientMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 text-left font-mono text-[11px]"
                  style={orient === o ? { background: 'var(--color-primary)', color: '#000' } : {}}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">{icon}</svg>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <span className="font-mono text-[10px] text-gray-500">ШАБЛОН:</span>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => { setZones(p.build(), true); setSelId(null); }}
            className="px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">{p.label}</button>
        ))}
      </div>
    </>
  );
}
