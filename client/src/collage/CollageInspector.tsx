import {
  X, Trash2, Eye, EyeOff, Lock, Unlock, Download, History, Stamp, Maximize2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { showToast } from '../components/ui/NexusModal';
import type { CollageUIProps } from './editorProps';
import { DEFAULT_FILTERS, exportPixelSize } from './types';
import type { FitMode, TextAlign, Pt } from './types';
import { FONTS } from './constants';
import { Acc } from './ui';
import { formatRuDate, fileToDataUrl, dataUrlToImage } from '../utils/collageStore';

/** Right accordion inspector + export menu */
export function CollageInspector(props: CollageUIProps) {
  const {
    page, pages, fmt, fmtDef, zones, sel, selId, setSelId,
    updateZone, setZones, removeZone, bringForward, sendBackward, bringToFront, sendToBack,
    alignZone, distributeZones,
    bgColor, bgTransparent, outerRadius, setBgColor, setBgTransparent, setBgTexture, setOuterRadius,
    exportScale, setExportScale,
    photoEditId, setPhotoEditId,
    pathDraft, setPathDraft,
    versions, saveVersion, restoreVersion, deleteVersion,
    wm, setWm, wmInputRef,
    exportMenuOpen, setExportMenuOpen, imgFormat, setImgFormat, imgQuality, setImgQuality,
    exportImage, exportPdfScope, exportPptxScope, exportZip, isBusy,
    comparePct, setComparePct,
  } = props;
  return (
    <>
        {/* Inspector — own scroll, canvas stays visible */}
        <div className="space-y-2 lg:overflow-y-auto lg:pr-1 lg:min-h-0 lg:overscroll-contain">
          <Acc title="Канвас" defaultOpen>
            <div>
              <label className="font-mono text-[10px] text-gray-500 mb-1 block">ФОН СТРАНИЦЫ</label>
              <button
                type="button"
                onClick={() => setBgTransparent(!bgTransparent)}
                className="w-full py-2 rounded-lg font-mono text-xs transition-all mb-2"
                style={bgTransparent
                  ? { background: 'var(--color-primary)', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
              >
                {bgTransparent ? '✓ ПРОЗРАЧНЫЙ ФОН' : 'ПРОЗРАЧНЫЙ ФОН'}
              </button>
              <div className="flex items-center gap-2" style={{ opacity: bgTransparent ? 0.35 : 1 }}>
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                  disabled={bgTransparent}
                  className="w-9 h-9 rounded cursor-pointer bg-transparent border border-white/10" />
                <input value={bgColor} onChange={e => setBgColor(e.target.value)}
                  disabled={bgTransparent}
                  className="flex-1 px-2 py-1.5 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] text-gray-500 mb-1 block">ТЕКСТУРА ФОНА</label>
              <div className="grid grid-cols-5 gap-1">
                {([['none', '—'], ['noise', 'Шум'], ['grid', 'Сетка'], ['dots', 'Точки'], ['diag', 'Диаг.']] as const).map(([t, label]) => (
                  <button key={t} onClick={() => setBgTexture(t)}
                    className="py-1.5 rounded font-mono text-[9px]"
                    style={(page.bgTexture || 'none') === t
                      ? { background: 'var(--color-primary)', color: '#000' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] text-gray-500 mb-1 block">ЗАКРУГЛЕНИЕ: {outerRadius}%</label>
              <input type="range" min={0} max={50} value={outerRadius} onChange={e => setOuterRadius(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-gray-500 mb-1 block">КАЧЕСТВО РАСТРА</label>
              <div className="flex gap-2">
                {([1, 2] as const).map(s => (
                  <button key={s} onClick={() => setExportScale(s)}
                    className="flex-1 py-2 rounded-lg font-mono text-xs transition-all"
                    style={exportScale === s
                      ? { background: 'var(--color-primary)', color: '#000' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
                    {s === 1 ? `1x (${fmt.w}px)` : `2x`}
                  </button>
                ))}
              </div>
            </div>
          </Acc>

          <Acc title={`Слои (${zones.length})`} defaultOpen>
            {zones.length === 0 && (
              <p className="font-mono text-[10px] text-gray-600">нет зон на этой странице</p>
            )}
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...zones].reverse().map(z => (
                <div key={z.id}
                  onClick={() => setSelId(z.id)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer"
                  style={z.id === selId
                    ? { background: 'rgba(255,255,255,0.1)', outline: '1px solid var(--color-primary)' }
                    : { background: 'rgba(255,255,255,0.03)' }}
                >
                  <span className="flex-1 min-w-0 truncate font-mono text-[10px] text-gray-300">
                    {z.name || z.type.toUpperCase()}{z.type === 'text' ? ` «${(z.text || '').slice(0, 12)}»` : ''}
                  </span>
                  <button onClick={e => { e.stopPropagation(); updateZone(z.id, { hidden: !z.hidden }); }}
                    className="p-1 rounded hover:bg-white/10 text-gray-500" title={z.hidden ? 'Показать' : 'Скрыть'}>
                    {z.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); updateZone(z.id, { locked: !z.locked }); }}
                    className="p-1 rounded hover:bg-white/10 text-gray-500" title={z.locked ? 'Разблокировать' : 'Заблокировать'}>
                    {z.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); removeZone(z.id); }}
                    className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400" title="Удалить">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {sel && (
              <input
                value={sel.name || ''}
                placeholder="имя слоя"
                onChange={e => updateZone(sel.id, { name: e.target.value }, false)}
                onBlur={() => updateZone(sel.id, {})}
                className="w-full px-2 py-1.5 rounded font-mono text-[10px] bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
              />
            )}
          </Acc>

          <Acc title="Выравнивание">
            <div className="grid grid-cols-3 gap-1">
              <button onClick={() => sel && alignZone(sel.id, 'l')} className="py-2 rounded-lg glass hover:bg-white/10 text-[10px] font-mono" title="По левому краю">◧</button>
              <button onClick={() => sel && alignZone(sel.id, 'c')} className="py-2 rounded-lg glass hover:bg-white/10 text-[10px] font-mono" title="По центру ↔">▦</button>
              <button onClick={() => sel && alignZone(sel.id, 'r')} className="py-2 rounded-lg glass hover:bg-white/10 text-[10px] font-mono" title="По правому краю">◨</button>
              <button onClick={() => sel && alignZone(sel.id, 't')} className="py-2 rounded-lg glass hover:bg-white/10 text-[10px] font-mono" title="По верху">▤</button>
              <button onClick={() => sel && alignZone(sel.id, 'm')} className="py-2 rounded-lg glass hover:bg-white/10 text-[10px] font-mono" title="По центру ↕">▥</button>
              <button onClick={() => sel && alignZone(sel.id, 'b')} className="py-2 rounded-lg glass hover:bg-white/10 text-[10px] font-mono" title="По низу">▦</button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => distributeZones('x')} className="py-2 rounded-lg glass hover:bg-white/10 font-mono text-[10px]">↔ Равные отступы</button>
              <button onClick={() => distributeZones('y')} className="py-2 rounded-lg glass hover:bg-white/10 font-mono text-[10px]">↕ Равные отступы</button>
            </div>
            <p className="font-mono text-[9px] text-gray-600">выровнить — выбранную зону к краям страницы; отступы — 3+ зоны</p>
          </Acc>

          {sel && sel.type !== 'text' && (
            <Acc title="Фото" defaultOpen>
              <button
                onClick={() => setPhotoEditId(v => (sel.imgId && v !== sel.id) ? sel.id : null)}
                className="w-full py-2 rounded-lg font-mono text-xs transition-all"
                style={photoEditId === sel.id
                  ? { background: 'var(--color-primary)', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
                disabled={!sel.imgId}
              >
                {photoEditId === sel.id ? '✓ СДВИГ ФОТО (Esc)' : 'СДВИГАТЬ ФОТО'}
              </button>
              <label className="font-mono text-[10px] text-gray-500 block">ЗУМ: {(sel.imgZoom || 1).toFixed(2)}×</label>
              <input type="range" min={100} max={500} value={Math.round((sel.imgZoom || 1) * 100)}
                onChange={e => updateZone(sel.id, { imgZoom: +e.target.value / 100 }, false)}
                onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
              <label className="font-mono text-[10px] text-gray-500 block">ПРОЗРАЧНОСТЬ: {Math.round((sel.imgOpacity ?? 1) * 100)}%</label>
              <input type="range" min={0} max={100} value={Math.round((sel.imgOpacity ?? 1) * 100)}
                onChange={e => updateZone(sel.id, { imgOpacity: +e.target.value / 100 }, false)}
                onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
              <label className="font-mono text-[10px] text-gray-500 block">РАЗМЫТИЕ ФОНА: {sel.portraitBlur || 0}</label>
              <input type="range" min={0} max={40} value={sel.portraitBlur || 0}
                onChange={e => updateZone(sel.id, { portraitBlur: +e.target.value }, false)}
                onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
              <label className="font-mono text-[10px] text-gray-500 block">ОБТРАВКА ПО ФОРМЕ</label>
              <select
                value={sel.clipZoneId || ''}
                onChange={e => updateZone(sel.id, { clipZoneId: e.target.value || null })}
                className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200"
              >
                <option value="">— своя форма —</option>
                {zones.filter(z => z.id !== sel.id && z.type !== 'text').map(z => (
                  <option key={z.id} value={z.id}>{z.name || z.type}</option>
                ))}
              </select>
              <button
                onClick={() => setComparePct(v => (v === null ? 50 : null))}
                className="w-full py-1.5 rounded-lg font-mono text-[10px] mt-1"
                style={comparePct !== null
                  ? { background: 'var(--color-primary)', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
              >
                {comparePct !== null ? `✓ СПЛИТ ${comparePct}%` : 'СРАВНЕНИЕ ДО/ПОСЛЕ'}
              </button>
              {comparePct !== null && (
                <input type="range" min={0} max={100} value={comparePct}
                  onChange={e => setComparePct(+e.target.value)}
                  className="w-full accent-[var(--color-primary)]" />
              )}

              <label className="font-mono text-[10px] text-gray-500 block">ФИЛЬТРЫ</label>
              {([
                ['brightness', 'Яркость', 0, 200],
                ['contrast', 'Контраст', 0, 200],
                ['saturate', 'Насыщенность', 0, 200],
                ['sepia', 'Сепия', 0, 100],
                ['grayscale', 'Ч/Б', 0, 100],
              ] as const).map(([key, label, min, max]) => {
                const f = sel.filters || DEFAULT_FILTERS;
                return (
                  <label key={key} className="font-mono text-[9px] text-gray-500">
                    {label} {f[key]}%
                    <input type="range" min={min} max={max} value={f[key]}
                      onChange={e => updateZone(sel.id, {
                        filters: { ...f, [key]: +e.target.value },
                      }, false)}
                      onPointerUp={() => updateZone(sel.id, {})}
                      className="w-full accent-[var(--color-primary)]" />
                  </label>
                );
              })}
              <button onClick={() => updateZone(sel.id, { filters: { ...DEFAULT_FILTERS } })}
                className="w-full py-1.5 rounded-lg font-mono text-[10px] glass text-gray-400">СБРОС ФИЛЬТРОВ</button>

              {sel.type === 'rect' && (
                <label className="font-mono text-[10px] text-gray-500 block">СКРУГЛЕНИЕ ЗОНЫ: {sel.radius}%
                  <input type="range" min={0} max={50} value={sel.radius}
                    onChange={e => updateZone(sel.id, { radius: +e.target.value })} className="w-full accent-[var(--color-primary)]" />
                </label>
              )}
              <label className="font-mono text-[10px] text-gray-500 block">РАМКА: {sel.border?.width || 0}%
                <div className="flex gap-2 items-center">
                  <input type="range" min={0} max={20} value={sel.border?.width || 0}
                    onChange={e => updateZone(sel.id, { border: { width: +e.target.value, color: sel.border?.color || '#00ff88' } }, false)}
                    onPointerUp={() => updateZone(sel.id, {})} className="flex-1 accent-[var(--color-primary)]" />
                  <input type="color" value={sel.border?.color || '#00ff88'}
                    onChange={e => updateZone(sel.id, { border: { width: sel.border?.width || 3, color: e.target.value } })}
                    className="w-8 h-8 rounded bg-transparent border border-white/10" />
                </div>
              </label>
              <select value={sel.fit} onChange={e => updateZone(sel.id, { fit: e.target.value as FitMode })}
                className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200">
                <option value="cover">Заполнить (cover)</option>
                <option value="contain">Вместить (contain)</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="font-mono text-[9px] text-gray-500">Ш
                  <input type="range" min={5} max={100} value={Math.round(sel.w * 100)}
                    onChange={e => updateZone(sel.id, { w: +e.target.value / 100 })} className="w-full accent-[var(--color-primary)]" />
                </label>
                <label className="font-mono text-[9px] text-gray-500">В
                  <input type="range" min={5} max={100} value={Math.round(sel.h * 100)}
                    onChange={e => updateZone(sel.id, { h: +e.target.value / 100 })} className="w-full accent-[var(--color-primary)]" />
                </label>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <button onClick={() => sendToBack(sel.id)} className="py-1.5 rounded font-mono text-[9px] glass">⇤</button>
                <button onClick={() => sendBackward(sel.id)} className="py-1.5 rounded font-mono text-[9px] glass">↓</button>
                <button onClick={() => bringForward(sel.id)} className="py-1.5 rounded font-mono text-[9px] glass">↑</button>
                <button onClick={() => bringToFront(sel.id)} className="py-1.5 rounded font-mono text-[9px] glass">⇥</button>
              </div>
            </Acc>
          )}

          {sel && sel.type === 'text' && (
            <Acc title="Текст" defaultOpen>
              <textarea value={sel.text || ''} rows={3}
                onChange={e => updateZone(sel.id, { text: e.target.value })}
                className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 resize-none" />
              <select value={sel.fontFamily || 'Montserrat'}
                onChange={e => updateZone(sel.id, { fontFamily: e.target.value })}
                className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200">
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <label className="font-mono text-[10px] text-gray-500">РАЗМЕР: {Math.round((sel.fontSize || 0.06) * 1000) / 10}%
                <input type="range" min={20} max={200} value={Math.round((sel.fontSize || 0.06) * 1000)}
                  onChange={e => updateZone(sel.id, { fontSize: +e.target.value / 1000 })} className="w-full accent-[var(--color-primary)]" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input type="color" value={sel.fontColor || '#ffffff'}
                  onChange={e => updateZone(sel.id, { fontColor: e.target.value })}
                  className="w-full h-9 rounded bg-transparent border border-white/10" />
                <select value={sel.fontWeight || 'normal'}
                  onChange={e => updateZone(sel.id, { fontWeight: e.target.value as 'normal' | 'bold' })}
                  className="px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200">
                  <option value="normal">Обычное</option>
                  <option value="bold">Жирное</option>
                </select>
              </div>
              <label className="font-mono text-[10px] text-gray-500">МЕЖБУКВЕННЫЙ: {((sel.letterSpacing || 0) * 100).toFixed(0)}%
                <input type="range" min={-20} max={80} value={Math.round((sel.letterSpacing || 0) * 100)}
                  onChange={e => updateZone(sel.id, { letterSpacing: +e.target.value / 100 }, false)}
                  onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
              </label>
              <label className="font-mono text-[10px] text-gray-500">МЕЖСТРОЧНЫЙ: {(sel.lineHeight || 1.15).toFixed(2)}
                <input type="range" min={80} max={220} value={Math.round((sel.lineHeight || 1.15) * 100)}
                  onChange={e => updateZone(sel.id, { lineHeight: +e.target.value / 100 }, false)}
                  onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
              </label>
              <button
                onClick={() => updateZone(sel.id, { smallCaps: !sel.smallCaps })}
                className="w-full py-2 rounded-lg font-mono text-xs transition-all"
                style={sel.smallCaps
                  ? { background: 'var(--color-primary)', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
              >
                {sel.smallCaps ? '✓ КАПИТЕЛЬ' : 'КАПИТЕЛЬ (SMALL CAPS)'}
              </button>
              <label className="font-mono text-[10px] text-gray-500">ДУГА ТЕКСТА: {sel.curve || 0}°
                <input type="range" min={-120} max={120} value={sel.curve || 0}
                  onChange={e => updateZone(sel.id, { curve: +e.target.value }, false)}
                  onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
              </label>
              <button
                onClick={() => {
                  if (sel.textPath) {
                    updateZone(sel.id, { textPath: undefined as any });
                    setPathDraft(null);
                  } else {
                    setPathDraft([]);
                    showToast('Кликайте по канвасу — контур (3+ точки, затем кнопка ниже)', 'info');
                  }
                }}
                className="w-full py-1.5 rounded-lg font-mono text-[10px]"
                style={sel.textPath || pathDraft !== null
                  ? { background: 'var(--color-primary)', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
              >
                {sel.textPath ? '✓ ПО ПУТИ (сбросить)' : pathDraft !== null ? `ПУТЬ… (${pathDraft.length})` : 'ТЕКСТ ПО ПУТИ'}
              </button>
              {pathDraft !== null && pathDraft.length >= 2 && (
                <button
                  onClick={() => {
                    updateZone(sel.id, { textPath: pathDraft.map((p: Pt) => ({ ...p })) });
                    setPathDraft(null);
                  }}
                  className="w-full py-1.5 rounded-lg font-mono text-[10px] font-bold"
                  style={{ background: 'var(--color-primary)', color: '#000' }}
                >
                  ГОТОВО — ПРИМЕНИТЬ ПУТЬ
                </button>
              )}
              <div>
                <label className="font-mono text-[10px] text-gray-500 mb-1 block">ГРАДИЕНТ ТЕКСТА</label>
                <div className="flex items-center gap-1">
                  <input type="color" value={sel.textGradient?.from || sel.fontColor || '#ff0088'}
                    onChange={e => updateZone(sel.id, {
                      textGradient: {
                        from: e.target.value,
                        to: sel.textGradient?.to || '#00ffee',
                        angle: sel.textGradient?.angle ?? 90,
                      },
                    })} className="w-8 h-8 rounded bg-transparent border border-white/10" />
                  <input type="color" value={sel.textGradient?.to || '#00ffee'}
                    onChange={e => updateZone(sel.id, {
                      textGradient: {
                        from: sel.textGradient?.from || '#ff0088',
                        to: e.target.value,
                        angle: sel.textGradient?.angle ?? 90,
                      },
                    })} className="w-8 h-8 rounded bg-transparent border border-white/10" />
                  <input type="range" min={0} max={360} value={sel.textGradient?.angle ?? 90}
                    onChange={e => updateZone(sel.id, {
                      textGradient: {
                        from: sel.textGradient?.from || '#ff0088',
                        to: sel.textGradient?.to || '#00ffee',
                        angle: +e.target.value,
                      },
                    }, false)}
                    onPointerUp={() => updateZone(sel.id, {})}
                    className="flex-1 accent-[var(--color-primary)]" />
                  <button onClick={() => updateZone(sel.id, { textGradient: undefined as any })}
                    className="px-2 py-1.5 rounded font-mono text-[10px] glass text-gray-400">✕</button>
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] text-gray-500 mb-1 block">ТЕНЬ ТЕКСТА</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="font-mono text-[9px] text-gray-500">Сдвиг {sel.textShadow?.x || 0}/{sel.textShadow?.y || 0}
                    <input type="range" min={-20} max={20} value={sel.textShadow?.x ?? 2}
                      onChange={e => updateZone(sel.id, {
                        textShadow: {
                          x: +e.target.value,
                          y: sel.textShadow?.y ?? 3,
                          blur: sel.textShadow?.blur ?? 4,
                          color: sel.textShadow?.color || 'rgba(0,0,0,0.55)',
                        },
                      }, false)}
                      onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
                    <input type="range" min={-20} max={20} value={sel.textShadow?.y ?? 3}
                      onChange={e => updateZone(sel.id, {
                        textShadow: {
                          x: sel.textShadow?.x ?? 2,
                          y: +e.target.value,
                          blur: sel.textShadow?.blur ?? 4,
                          color: sel.textShadow?.color || 'rgba(0,0,0,0.55)',
                        },
                      }, false)}
                      onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
                  </label>
                  <label className="font-mono text-[9px] text-gray-500">Размытие {sel.textShadow?.blur ?? 4}
                    <input type="range" min={0} max={30} value={sel.textShadow?.blur ?? 4}
                      onChange={e => updateZone(sel.id, {
                        textShadow: {
                          x: sel.textShadow?.x ?? 2,
                          y: sel.textShadow?.y ?? 3,
                          blur: +e.target.value,
                          color: sel.textShadow?.color || 'rgba(0,0,0,0.55)',
                        },
                      }, false)}
                      onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
                  </label>
                </div>
                <div className="flex gap-1 mt-1">
                  <input type="color" value="#000000"
                    onChange={e => {
                      const hex = e.target.value;
                      updateZone(sel.id, {
                        textShadow: {
                          x: sel.textShadow?.x ?? 2,
                          y: sel.textShadow?.y ?? 3,
                          blur: sel.textShadow?.blur ?? 4,
                          color: hex + 'aa',
                        },
                      });
                    }}
                    className="w-8 h-8 rounded bg-transparent border border-white/10" />
                  <button onClick={() => updateZone(sel.id, {
                    textShadow: { x: 2, y: 3, blur: 4, color: 'rgba(0,0,0,0.55)' },
                  })}
                    className="flex-1 py-1.5 rounded font-mono text-[10px] glass">ВКЛ ТЕНЬ</button>
                  <button onClick={() => updateZone(sel.id, { textShadow: undefined as any })}
                    className="flex-1 py-1.5 rounded font-mono text-[10px] glass text-gray-400">БЕЗ ТЕНИ</button>
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] text-gray-500 mb-1 block">ПЛАШКА / БЕЙДЖ</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateZone(sel.id, sel.textBg
                      ? { textBg: undefined as any }
                      : { textBg: { color: 'rgba(0,0,0,0.72)', padX: 0.7, padY: 0.35, radius: 0.5 } })}
                    className="flex-1 py-1.5 rounded font-mono text-[10px]"
                    style={sel.textBg
                      ? { background: 'var(--color-primary)', color: '#000' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
                  >
                    {sel.textBg ? '✓ ПЛАШКА' : 'ПЛАШКА'}
                  </button>
                  {sel.textBg && (
                    <input type="color" value={sel.textBg.color.slice(0, 7)}
                      onChange={e => updateZone(sel.id, {
                        textBg: { ...sel.textBg!, color: e.target.value + 'b8' },
                      })}
                      className="w-9 rounded bg-transparent border border-white/10" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['left', 'center', 'right'] as TextAlign[]).map(a => (
                  <button key={a} onClick={() => updateZone(sel.id, { align: a })}
                    className="py-1.5 rounded font-mono text-[10px]"
                    style={(sel.align || 'center') === a
                      ? { background: 'var(--color-primary)', color: '#000' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
                    {a === 'left' ? '←' : a === 'center' ? '↔' : '→'}
                  </button>
                ))}
              </div>
              <label className="font-mono text-[10px] text-gray-500">НАКЛОН: {sel.rotation || 0}°
                <input type="range" min={-45} max={45} value={sel.rotation || 0}
                  onChange={e => updateZone(sel.id, { rotation: +e.target.value }, false)}
                  onPointerUp={() => updateZone(sel.id, {})} className="w-full accent-[var(--color-primary)]" />
              </label>
              <label className="font-mono text-[10px] text-gray-500">ОБВОДКА: {((sel.stroke?.width || 0) * 100).toFixed(0)}%
                <div className="flex gap-2 items-center">
                  <input type="range" min={0} max={30} value={Math.round((sel.stroke?.width || 0) * 100)}
                    onChange={e => updateZone(sel.id, { stroke: { width: +e.target.value / 100, color: sel.stroke?.color || '#000' } }, false)}
                    onPointerUp={() => updateZone(sel.id, {})} className="flex-1 accent-[var(--color-primary)]" />
                  <input type="color" value={sel.stroke?.color || '#000000'}
                    onChange={e => updateZone(sel.id, { stroke: { width: sel.stroke?.width || 0.05, color: e.target.value } })}
                    className="w-8 h-8 rounded bg-transparent border border-white/10" />
                </div>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="font-mono text-[9px] text-gray-500">Ш
                  <input type="range" min={5} max={100} value={Math.round(sel.w * 100)}
                    onChange={e => updateZone(sel.id, { w: +e.target.value / 100 })} className="w-full accent-[var(--color-primary)]" />
                </label>
                <label className="font-mono text-[9px] text-gray-500">В
                  <input type="range" min={5} max={100} value={Math.round(sel.h * 100)}
                    onChange={e => updateZone(sel.id, { h: +e.target.value / 100 })} className="w-full accent-[var(--color-primary)]" />
                </label>
              </div>
            </Acc>
          )}

          <Acc title="Водяной знак">
            <input ref={wmInputRef} type="file" accept="image/*" className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const dataUrl = await fileToDataUrl(f);
                const img = await dataUrlToImage(dataUrl);
                setWm({ dataUrl, opacity: 0.35, corner: 'br', scale: 0.18, img });
              }} />
            {wm ? (
              <>
                <div className="flex items-center gap-2">
                  <img src={wm.dataUrl} alt="" className="w-10 h-10 object-contain rounded bg-black/30" />
                  <button onClick={() => wmInputRef.current?.click()} className="flex-1 py-2 rounded-lg glass font-mono text-[10px]">ЗАМЕНИТЬ</button>
                  <button onClick={() => setWm(null)} className="py-2 px-2 rounded-lg glass text-red-400 font-mono text-[10px]">✕</button>
                </div>
                <label className="font-mono text-[10px] text-gray-500">ПРОЗРАЧНОСТЬ: {Math.round(wm.opacity * 100)}%
                  <input type="range" min={5} max={100} value={Math.round(wm.opacity * 100)}
                    onChange={e => setWm(w => w ? { ...w, opacity: +e.target.value / 100 } : w)}
                    className="w-full accent-[var(--color-primary)]" />
                </label>
                <label className="font-mono text-[10px] text-gray-500">РАЗМЕР: {Math.round(wm.scale * 100)}%
                  <input type="range" min={5} max={50} value={Math.round(wm.scale * 100)}
                    onChange={e => setWm(w => w ? { ...w, scale: +e.target.value / 100 } : w)}
                    className="w-full accent-[var(--color-primary)]" />
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {([['tl', '↖'], ['tr', '↗'], ['center', '◎'], ['bl', '↙'], ['br', '↘']] as const).map(([c, icon]) => (
                    <button key={c} onClick={() => setWm(w => w ? { ...w, corner: c } : w)}
                      className="py-2 rounded-lg font-mono text-xs"
                      style={wm.corner === c
                        ? { background: 'var(--color-primary)', color: '#000' }
                        : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
                      {icon}
                    </button>
                  ))}
                </div>
                <p className="font-mono text-[9px] text-gray-600">накладывается на все страницы при экспорте</p>
              </>
            ) : (
              <button onClick={() => wmInputRef.current?.click()}
                className="w-full py-2.5 rounded-lg font-mono text-xs glass hover:bg-white/10 flex items-center justify-center gap-2">
                <Stamp className="w-3.5 h-3.5" /> ДОБАВИТЬ ЛОГО / ЗНАК
              </button>
            )}
          </Acc>

          <Acc title={`Версии (${versions.length})`}>
            <button onClick={saveVersion}
              className="w-full py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)', color: '#000' }}>
              <History className="w-3.5 h-3.5" /> СОХРАНИТЬ ВЕРСИЮ
            </button>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {versions.map(v => (
                <div key={v.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] text-gray-200 truncate">{v.name}</div>
                    <div className="font-mono text-[8px] text-gray-600">{formatRuDate(v.at)}</div>
                  </div>
                  <button onClick={() => restoreVersion(v)}
                    className="px-2 py-1 rounded font-mono text-[9px] glass hover:bg-white/10">ОТКАТ</button>
                  <button onClick={() => deleteVersion(v.id)}
                    className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {versions.length === 0 && (
                <p className="font-mono text-[10px] text-gray-600">снимков пока нет</p>
              )}
            </div>
          </Acc>

          {/* Export menu — z above neighbouring .glass cards */}
          <div className="relative z-50">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setExportMenuOpen(v => !v)}
              disabled={isBusy}
              className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)', color: '#000' }}>
              <Download className="w-4 h-4" /> {isBusy ? 'ЭКСПОРТ...' : `${fmtDef.label} ${fmt.w}×${fmt.h}`} ▾
            </motion.button>
            {exportMenuOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-[999] p-2 rounded-xl space-y-1 w-full"
                style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">Формат</div>
                <div className="grid grid-cols-2 gap-1 mb-1">
                  {([['png', 'PNG'], ['jpeg', 'JPEG'], ['webp', 'WebP']] as const).map(([f, label]) => (
                    <button key={f}
                      onClick={() => setImgFormat(f)}
                      title={f === 'jpeg' && bgTransparent ? 'JPEG не поддерживает прозрачность' : undefined}
                      className="px-2 py-1.5 rounded-lg font-mono text-[10px]"
                      style={imgFormat === f
                        ? { background: 'var(--color-primary)', color: '#000' }
                        : f === 'jpeg' && bgTransparent
                          ? { background: 'rgba(255,255,255,0.04)', color: '#555' }
                          : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
                      {label}{f === 'jpeg' && bgTransparent ? ' ✕' : ''}
                    </button>
                  ))}
                </div>
                {bgTransparent && (
                  <p className="font-mono text-[8px] text-gray-500 px-1 mb-1 leading-snug">
                    прозрачный фон: PNG / WebP (альфа). JPEG — только залитый фон (формат без альфы).
                  </p>
                )}
                {imgFormat !== 'png' && (
                  <label className="font-mono text-[9px] text-gray-500 px-1 block mb-1">
                    Качество {imgQuality}%
                    <input type="range" min={50} max={100} value={imgQuality}
                      onChange={e => setImgQuality(+e.target.value)}
                      className="w-full accent-[var(--color-primary)]" />
                  </label>
                )}
                <div className="font-mono text-[9px] text-gray-500 px-1 pb-1 uppercase tracking-wider">
                  Страница: {fmtDef.label} · {fmt.w}×{fmt.h}
                </div>
                <button onClick={() => { setExportMenuOpen(false); exportImage(); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  {imgFormat.toUpperCase()} · {fmtDef.label} {(() => { const ex = exportPixelSize(page, exportScale); return `${ex.outW}×${ex.outH}`; })()}
                </button>
                <button onClick={() => { setExportMenuOpen(false); exportPdfScope('current'); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  PDF (текущая)
                </button>
                <button onClick={() => { setExportMenuOpen(false); exportPptxScope('current'); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  PPTX (текущая)
                </button>
                <div className="font-mono text-[9px] text-gray-500 px-1 pt-2 pb-1 uppercase tracking-wider">Все страницы ({pages.length})</div>
                <button onClick={() => { setExportMenuOpen(false); exportPdfScope('all'); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  PDF (все)
                </button>
                <button onClick={() => { setExportMenuOpen(false); exportPptxScope('all'); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  PPTX (все)
                </button>
                <button onClick={() => { setExportMenuOpen(false); exportZip(); }}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-white/10 font-mono text-[11px]">
                  ZIP картинок (все)
                </button>
              </div>
            )}
          </div>

          {zones.length > 0 && (
            <button onClick={() => { setZones([], true); setSelId(null); }}
              className="w-full py-2 rounded-xl glass text-gray-400 hover:text-gray-200 font-mono text-xs flex items-center justify-center gap-2">
              <X className="w-3.5 h-3.5" /> ОЧИСТИТЬ ВСЕ ЗОНЫ
            </button>
          )}

          <div className="glass rounded-xl p-3">
            <p className="font-mono text-[9px] text-gray-600 leading-relaxed">
              <Maximize2 className="w-3 h-3 inline mr-1" />
              Зоны можно перетаскивать и ресайзить мышью/пальцем. Delete — удалить выбранную. Формы: круг, эллипс, ромб, кастомный полигон.
            </p>
          </div>
        </div>
    </>
  );
}
