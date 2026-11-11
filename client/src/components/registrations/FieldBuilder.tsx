import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, GripVertical, Trash2, Settings, X, Copy } from 'lucide-react';
import { RegistrationField, FieldType, FIELD_TYPE_CONFIG } from '../../types';

interface FieldBuilderProps {
  fields: RegistrationField[];
  onAdd: (type: FieldType) => void;
  onUpdate: (fieldId: string, data: Partial<RegistrationField>) => void;
  onDelete: (fieldId: string) => void;
  onDuplicate: (fieldId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export default function FieldBuilder({ fields, onAdd, onUpdate, onDelete, onDuplicate, onReorder }: FieldBuilderProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const categories = {
    input: Object.entries(FIELD_TYPE_CONFIG).filter(([, v]) => v.category === 'input'),
    choice: Object.entries(FIELD_TYPE_CONFIG).filter(([, v]) => v.category === 'choice'),
    media: Object.entries(FIELD_TYPE_CONFIG).filter(([, v]) => v.category === 'media'),
    layout: Object.entries(FIELD_TYPE_CONFIG).filter(([, v]) => v.category === 'layout'),
  };

  const categoryLabels: Record<string, string> = {
    input: 'Поля ввода',
    choice: 'Выбор',
    media: 'Медиа',
    layout: 'Оформление',
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      onReorder(dragIdx, idx);
      setDragIdx(idx);
    }
  };

  const handleDragEnd = () => setDragIdx(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
      {/* Left: field palette */}
      <aside className="nx-tile p-4 self-start lg:sticky lg:top-6">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <span className="font-mono text-xs font-bold text-gray-300">ДОБАВИТЬ БЛОК</span>
        </div>
        <div className="nx-divider mb-3" />
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat}>
              <p className="nx-eyebrow mb-2">{categoryLabels[cat]}</p>
              <div className="space-y-1.5">
                {items.map(([type, config]) => (
                  <button key={type} onClick={() => onAdd(type as FieldType)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 transition-colors nx-press">
                    <span className="text-base w-6 text-center">{config.icon}</span>
                    <span className="font-mono text-xs text-gray-200">{config.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Center: field canvas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="nx-eyebrow">БЛОКИ ФОРМЫ</h3>
          <span className="font-mono text-[10px] text-gray-500">{fields.length}</span>
        </div>
        <div className="nx-divider" />

        {/* Field list */}
        <div className="space-y-4">
        {fields.length === 0 && (
          <div className="text-center py-10 rounded-2xl border-2 border-dashed border-gray-700">
            <p className="font-mono text-xs text-gray-500">// НЕТ БЛОКОВ</p>
            <p className="font-mono text-[10px] text-gray-600 mt-1">Нажмите «Добавить блок» чтобы начать</p>
          </div>
        )}
        {fields.map((field, idx) => {
          const config = FIELD_TYPE_CONFIG[field.type];
          const isExpanded = expandedField === field.id;
          const settings: Record<string, any> = (typeof field.settings === 'object' && field.settings !== null && !Array.isArray(field.settings)) ? field.settings : {};
          const options: string[] = Array.isArray(field.options) ? field.options : [];

          return (
            <div key={field.id}
              draggable
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`nx-bezel transition-all duration-200 ${dragIdx === idx ? 'opacity-50 scale-[0.99]' : ''}`}>
              <div className="nx-core">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300">
                  <GripVertical className="w-4 h-4" />
                </div>
                <span className="text-lg">{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-bold text-gray-200 truncate">{field.label}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="nx-eyebrow">{config.label}</span>
                    {field.required === 1 && <span className="font-mono text-[9px] text-gray-500">• обязательное</span>}
                  </div>
                </div>
                <button onClick={() => setExpandedField(isExpanded ? null : field.id)}
                  className={`p-2 rounded-lg transition-colors nx-press ${isExpanded ? 'bg-white/10 text-gray-200' : 'hover:bg-white/10 text-gray-400'}`}>
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(field.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-gray-400 hover:text-red-400 nx-press">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDuplicate(field.id)}
                  className="p-2 rounded-lg hover:bg-blue-500/20 transition-colors text-gray-400 hover:text-blue-400 nx-press"
                  title="Дублировать">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Expanded settings */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <div className="px-4 pb-4 pt-3 space-y-4 border-t border-white/5">
                      {/* Label */}
                      <div>
                        <label className="font-mono text-[10px] text-gray-500 block mb-1">ТЕКСТ ВОПРОСА</label>
                        <input value={field.label} onChange={e => onUpdate(field.id, { label: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                      </div>

                      {/* Placeholder (for input types) */}
                      {!['select_single', 'select_multi', 'checkbox', 'rating', 'file', 'heading', 'paragraph'].includes(field.type) && (
                        <div>
                          <label className="font-mono text-[10px] text-gray-500 block mb-1">ПЛЕЙСХОЛДЕР</label>
                          <input value={field.placeholder} onChange={e => onUpdate(field.id, { placeholder: e.target.value })}
                            placeholder="// ПОДСКАЗКА"
                            className="w-full px-3 py-2.5 rounded-xl font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                        </div>
                      )}

                      {/* Required toggle */}
                      {!['heading', 'paragraph', 'divider', 'page_break', 'link_block', 'button_block'].includes(field.type) && (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div onClick={() => onUpdate(field.id, { required: field.required === 1 ? 0 : 1 })}
                            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${field.required === 1 ? '' : 'bg-gray-700'}`}
                            style={field.required === 1 ? { background: 'var(--color-primary)' } : {}}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${field.required === 1 ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="font-mono text-xs text-gray-300">Обязательное поле</span>
                        </label>
                      )}

                      {/* Options for select/choice types */}
                      {['select_single', 'select_multi', 'dropdown', 'image_choice', 'ranking'].includes(field.type) && (
                        <div>
                          <label className="font-mono text-[10px] text-gray-500 block mb-1">ВАРИАНТЫ ОТВЕТОВ</label>
                          <div className="space-y-1.5">
                            {options.map((opt, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <div className="flex flex-col gap-0.5">
                                  <button disabled={i === 0} onClick={() => {
                                    if (i === 0) return;
                                    const newOpts = [...options];[newOpts[i - 1], newOpts[i]] = [newOpts[i], newOpts[i - 1]];
                                    onUpdate(field.id, { options: newOpts as any });
                                  }} className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 disabled:opacity-20 disabled:cursor-default nx-press" title="Вверх">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><polyline points="18 15 12 9 6 15"/></svg>
                                  </button>
                                  <button disabled={i === options.length - 1} onClick={() => {
                                    if (i === options.length - 1) return;
                                    const newOpts = [...options];[newOpts[i], newOpts[i + 1]] = [newOpts[i + 1], newOpts[i]];
                                    onUpdate(field.id, { options: newOpts as any });
                                  }} className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 disabled:opacity-20 disabled:cursor-default nx-press" title="Вниз">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><polyline points="6 9 12 15 18 9"/></svg>
                                  </button>
                                </div>
                                <input value={opt} onChange={e => {
                                  const newOpts = [...options]; newOpts[i] = e.target.value;
                                  onUpdate(field.id, { options: newOpts as any });
                                }}
                                  className="flex-1 px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                                <button onClick={() => {
                                  const newOpts = options.filter((_, j) => j !== i);
                                  onUpdate(field.id, { options: newOpts as any });
                                }} className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 nx-press">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button onClick={() => onUpdate(field.id, { options: [...options, `Вариант ${options.length + 1}`] as any })}
                              className="text-xs font-mono px-3 py-2 rounded-xl hover:bg-white/5 transition-colors nx-press" style={{ color: 'var(--color-primary)' }}>
                              + Добавить вариант
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Phone mask */}
                      {field.type === 'phone' && (
                        <div>
                          <label className="font-mono text-[10px] text-gray-500 block mb-1">МАСКА</label>
                          <select value={settings.mask || '+7 (999) 999-99-99'} onChange={e => onUpdate(field.id, { settings: { ...settings, mask: e.target.value } as any })}
                            className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                            <option value="+7 (999) 999-99-99">Россия +7</option>
                            <option value="+380 (99) 999-99-99">Украина +380</option>
                            <option value="+375 (99) 999-99-99">Беларусь +375</option>
                            <option value="+1 (999) 999-9999">США +1</option>
                            <option value="+44 9999 999999">Великобритания +44</option>
                            <option value="">Без маски</option>
                          </select>
                        </div>
                      )}

                      {/* Number min/max */}
                      {field.type === 'number' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 block mb-1">МИН</label>
                            <input type="number" value={settings.min || ''} onChange={e => onUpdate(field.id, { settings: { ...settings, min: e.target.value ? Number(e.target.value) : undefined } as any })}
                              className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 block mb-1">МАКС</label>
                            <input type="number" value={settings.max || ''} onChange={e => onUpdate(field.id, { settings: { ...settings, max: e.target.value ? Number(e.target.value) : undefined } as any })}
                              className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                        </div>
                      )}

                      {/* Rating max */}
                      {field.type === 'rating' && (
                        <div>
                          <label className="font-mono text-[10px] text-gray-500 block mb-1">МАКСИМУМ ЗВЁЗД</label>
                          <select value={settings.max || 5} onChange={e => onUpdate(field.id, { settings: { ...settings, max: Number(e.target.value) } as any })}
                            className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                            {[3, 4, 5, 7, 10].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      )}

                      {/* Slider settings */}
                      {field.type === 'slider' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 block mb-1">МИН</label>
                            <input type="number" value={settings.min ?? 0} onChange={e => onUpdate(field.id, { settings: { ...settings, min: Number(e.target.value) } as any })}
                              className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 block mb-1">МАКС</label>
                            <input type="number" value={settings.max ?? 100} onChange={e => onUpdate(field.id, { settings: { ...settings, max: Number(e.target.value) } as any })}
                              className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 block mb-1">ШАГ</label>
                            <input type="number" value={settings.step ?? 1} onChange={e => onUpdate(field.id, { settings: { ...settings, step: Number(e.target.value) } as any })}
                              className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                        </div>
                      )}

                      {/* Linear scale settings */}
                      {field.type === 'linear_scale' && (
                        <div className="space-y-2">
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 block mb-1">МАКСИМУМ</label>
                            <select value={settings.max || 5} onChange={e => onUpdate(field.id, { settings: { ...settings, max: Number(e.target.value) } as any })}
                              className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                              {[3, 4, 5, 7, 10].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="font-mono text-[10px] text-gray-500 block mb-1">ЛЕВАЯ МЕТКА</label>
                              <input type="text" value={(settings.labels && settings.labels[0]) || ''} onChange={e => {
                                const labels = settings.labels || ['', '']; labels[0] = e.target.value;
                                onUpdate(field.id, { settings: { ...settings, labels } as any });
                              }} placeholder="Не согласен" className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                            </div>
                            <div>
                              <label className="font-mono text-[10px] text-gray-500 block mb-1">ПРАВАЯ МЕТКА</label>
                              <input type="text" value={(settings.labels && settings.labels[1]) || ''} onChange={e => {
                                const labels = settings.labels || ['', '']; labels[1] = e.target.value;
                                onUpdate(field.id, { settings: { ...settings, labels } as any });
                              }} placeholder="Согласен" className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Matrix settings */}
                      {field.type === 'matrix' && (
                        <div className="space-y-2">
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 block mb-1">СТРОКИ (через запятую)</label>
                            <input type="text" value={(settings.rows || []).join(', ')} onChange={e => onUpdate(field.id, { settings: { ...settings, rows: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) } as any })}
                              placeholder="Качество, Цена, Сервис" className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 block mb-1">СТОЛБЦЫ (через запятую)</label>
                            <input type="text" value={(settings.cols || []).join(', ')} onChange={e => onUpdate(field.id, { settings: { ...settings, cols: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) } as any })}
                              placeholder="Да, Нет, Не важно" className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                        </div>
                      )}

                      {/* Multi file max */}
                      {field.type === 'multi_file' && (
                        <div>
                          <label className="font-mono text-[10px] text-gray-500 block mb-1">МАКСИМУМ ФАЙЛОВ</label>
                          <input type="number" value={settings.maxFiles || 5} min={1} max={20} onChange={e => onUpdate(field.id, { settings: { ...settings, maxFiles: Number(e.target.value) } as any })}
                            className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                        </div>
                      )}

                      {/* Link block settings */}
                      {field.type === 'link_block' && (
                        <>
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 mb-1 block">URL ССЫЛКИ</label>
                            <input value={settings.url || ''} onChange={e => onUpdate(field.id, { settings: { ...settings, url: e.target.value } as any })}
                              placeholder="https://..." className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 mb-1 block">ТЕКСТ ССЫЛКИ</label>
                            <input value={settings.linkText || ''} onChange={e => onUpdate(field.id, { settings: { ...settings, linkText: e.target.value } as any })}
                              placeholder="Перейти по ссылке" className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                        </>
                      )}

                      {/* Button block settings */}
                      {field.type === 'button_block' && (
                        <>
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 mb-1 block">URL КНОПКИ</label>
                            <input value={settings.url || ''} onChange={e => onUpdate(field.id, { settings: { ...settings, url: e.target.value } as any })}
                              placeholder="https://..." className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                          <div>
                            <label className="font-mono text-[10px] text-gray-500 mb-1 block">ТЕКСТ КНОПКИ</label>
                            <input value={settings.buttonText || ''} onChange={e => onUpdate(field.id, { settings: { ...settings, buttonText: e.target.value } as any })}
                              placeholder="Нажми" className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                          </div>
                        </>
                      )}

                      {/* Acknowledgment settings */}
                      {field.type === 'acknowledgment' && (
                        <div>
                          <label className="font-mono text-[10px] text-gray-500 mb-1 block">ТЕКСТ ДОКУМЕНТА</label>
                          <textarea value={field.label || ''} onChange={e => onUpdate(field.id, { label: e.target.value })}
                            placeholder="Я ознакомился(ась) с условиями..."
                            rows={3} className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)] resize-none" />
                        </div>
                      )}

                      {/* Conditional logic (showIf) */}
                      <div className="border-t border-white/5 pt-4">
                        <label className="font-mono text-[10px] text-gray-500 mb-1 block">УСЛОВИЕ ПОКАЗА</label>
                        <div className="space-y-1.5">
                          <select value={settings.showIf?.fieldId || ''} onChange={e => {
                            const showIf = e.target.value ? { fieldId: e.target.value, operator: settings.showIf?.operator || 'equals', value: settings.showIf?.value || '' } : undefined;
                            onUpdate(field.id, { settings: { ...settings, showIf } as any });
                          }} className="w-full px-3 py-2 rounded-xl font-mono text-[10px] bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]">
                            <option value="">-- Всегда показывать --</option>
                            {fields.filter(f => f.id !== field.id && ['select_single', 'select_multi', 'dropdown', 'checkbox', 'text_short', 'email', 'radio'].includes(f.type)).map(f => (
                              <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                          </select>
                          {settings.showIf?.fieldId && (
                            <div className="flex gap-1">
                              <select value={settings.showIf?.operator || 'equals'} onChange={e => onUpdate(field.id, { settings: { ...settings, showIf: { ...settings.showIf, operator: e.target.value } } as any })}
                                className="flex-1 px-3 py-2 rounded-xl font-mono text-[10px] bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]">
                                <option value="equals">Равно</option>
                                <option value="not_equals">Не равно</option>
                                <option value="contains">Содержит</option>
                                <option value="not_empty">Не пусто</option>
                                <option value="empty">Пусто</option>
                              </select>
                              {!['not_empty', 'empty'].includes(settings.showIf?.operator) && (
                                <input value={settings.showIf?.value || ''} onChange={e => onUpdate(field.id, { settings: { ...settings, showIf: { ...settings.showIf, value: e.target.value } } as any })}
                                  placeholder="Значение" className="flex-1 px-3 py-2 rounded-xl font-mono text-[10px] bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
