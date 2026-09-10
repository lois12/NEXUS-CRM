import { useRef, useEffect, useState } from 'react';
import { RegistrationField } from '../../types';

interface FieldRendererProps {
  field: RegistrationField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  const settings: Record<string, any> = (() => {
    const s = field.settings;
    if (typeof s === 'object' && s !== null && !Array.isArray(s)) return s;
    if (typeof s === 'string' && s.length > 0 && s[0] === '{') {
      try { const p = JSON.parse(s); return (typeof p === 'object' && p !== null && !Array.isArray(p)) ? p : {}; } catch { return {}; }
    }
    return {};
  })();
  const options: string[] = (() => {
    const o = field.options;
    if (Array.isArray(o)) return o;
    if (typeof o === 'string' && o.length > 0 && o[0] === '[') {
      try { const p = JSON.parse(o); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
  })();
  const baseClass = `w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border text-gray-200 focus:outline-none focus:border-[var(--color-primary)] transition-colors ${error ? 'border-red-500' : 'border-gray-700'}`;

  // ── Layout types (no input, no label wrapper) ──
  if (field.type === 'heading') {
    return <h3 className="text-lg font-bold font-mono text-gray-200 pt-2">{field.label}</h3>;
  }
  if (field.type === 'paragraph') {
    return <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{field.label}</p>;
  }
  if (field.type === 'divider') {
    return <hr className="border-0 h-[1px] my-2" style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)', boxShadow: '0 0 8px var(--color-glow)' }} />;
  }
  if (field.type === 'page_break') {
    return (
      <div className="flex items-center gap-3 py-4">
        <div className="flex-1 h-[1px]" style={{ background: 'rgba(0,255,136,0.15)' }} />
        <span className="font-mono text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(0,255,136,0.06)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.15)' }}>СЛЕДУЮЩАЯ СТРАНИЦА</span>
        <div className="flex-1 h-[1px]" style={{ background: 'rgba(0,255,136,0.15)' }} />
      </div>
    );
  }
  if (field.type === 'link_block') {
    const url = settings.url || '#';
    const linkText = settings.linkText || field.label || 'Перейти по ссылке';
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-sm transition-all hover:brightness-110" style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        {linkText}
      </a>
    );
  }
  if (field.type === 'acknowledgment') {
    return (
      <label onClick={() => onChange(value === 'true' ? '' : 'true')} className="flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all hover:bg-white/5" style={{ border: value === 'true' ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.06)', background: value === 'true' ? 'rgba(0,255,136,0.05)' : 'transparent' }}>
        <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ borderColor: value === 'true' ? 'var(--color-primary)' : '#4a4a60', background: value === 'true' ? 'var(--color-primary)' : 'transparent' }}>
          {value === 'true' && <span className="text-black text-xs font-bold">✓</span>}
        </div>
        <div>
          <span className="font-mono text-sm text-gray-200 block">Ознакомлен(а)</span>
          {field.label && field.label !== 'Ознакомлен(а)' && <span className="font-mono text-xs text-gray-400 mt-1 block">{field.label}</span>}
        </div>
      </label>
    );
  }
  if (field.type === 'button_block') {
    const btnUrl = settings.url || '#';
    const btnText = settings.buttonText || field.label || 'Нажми';
    return (
      <a href={btnUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 rounded-xl font-mono text-sm font-bold transition-all hover:brightness-110" style={{ background: 'var(--color-primary)', color: '#000' }}>
        {btnText}
      </a>
    );
  }

  const renderInput = () => {
    switch (field.type) {
      // ── Basic input ──
      case 'text_short':
        return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || '// ВВЕДИТЕ ТЕКСТ'} maxLength={settings.maxLength || 500} className={baseClass} />;

      case 'text_long':
        return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || '// ВВЕДИТЕ ТЕКСТ'} rows={settings.rows || 4} maxLength={settings.maxLength || 5000} className={`${baseClass} resize-none`} />;

      case 'email':
        return <input type="email" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || 'email@example.com'} className={baseClass} />;

      case 'phone':
        return <input type="tel" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || '+7 (999) 999-99-99'} className={baseClass} />;

      case 'number':
        return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || '0'} min={settings.min} max={settings.max} step={settings.step || 1} className={baseClass} />;

      case 'date':
        return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={baseClass} />;

      case 'datetime':
        return <input type="datetime-local" value={value} onChange={e => onChange(e.target.value)} className={baseClass} />;

      case 'time':
        return <input type="time" value={value} onChange={e => onChange(e.target.value)} className={baseClass} />;

      case 'url':
        return <input type="url" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || 'https://...'} className={baseClass} />;

      case 'address':
        return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || '// ГОРОД, УЛИЦА, ДОМ'} rows={2} className={`${baseClass} resize-none`} />;

      case 'color':
        return (
          <div className="flex items-center gap-3">
            <input type="color" value={value || '#00ff88'} onChange={e => onChange(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent" />
            <span className="font-mono text-sm text-gray-400">{value || '#00ff88'}</span>
          </div>
        );

      // ── Slider / Scale ──
      case 'slider': {
        const min = settings.min ?? 0;
        const max = settings.max ?? 100;
        const step = settings.step ?? 1;
        const current = value ? Number(value) : min;
        return (
          <div className="space-y-2">
            <input type="range" min={min} max={max} step={step} value={current} onChange={e => onChange(e.target.value)} className="w-full accent-green-500" />
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-gray-500">{min}</span>
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{current}</span>
              <span className="font-mono text-[10px] text-gray-500">{max}</span>
            </div>
          </div>
        );
      }

      case 'linear_scale': {
        const max = settings.max || 5;
        const labels = settings.labels || ['Не согласен', 'Согласен'];
        const current = parseInt(value) || 0;
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-gray-500">{labels[0] || ''}</span>
              <span className="font-mono text-[10px] text-gray-500">{labels[1] || ''}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: max }, (_, i) => (
                <button key={i} type="button" onClick={() => onChange(String(i + 1))}
                  className="flex-1 py-2 rounded-lg font-mono text-sm font-bold transition-all"
                  style={current === i + 1
                    ? { background: 'var(--color-primary)', color: '#000', boxShadow: '0 0 10px var(--color-glow)' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#6a6a80', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 'nps': {
        const current = parseInt(value) || -1;
        return (
          <div className="space-y-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 11 }, (_, i) => {
                const hue = (i / 10) * 120; // red(0) → green(120)
                const isSelected = current === i;
                return (
                  <button key={i} type="button" onClick={() => onChange(String(i))}
                    className="flex-1 py-2 rounded-lg font-mono text-xs font-bold transition-all"
                    style={isSelected
                      ? { background: `hsl(${hue}, 80%, 50%)`, color: '#000', boxShadow: `0 0 10px hsl(${hue}, 80%, 50%)` }
                      : { background: 'rgba(255,255,255,0.03)', color: '#6a6a80', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {i}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-[9px] text-gray-500">Не буду рекомендовать</span>
              <span className="font-mono text-[9px] text-gray-500">Обязательно порекомендую</span>
            </div>
          </div>
        );
      }

      // ── Choice ──
      case 'select_single':
        return (
          <div className="space-y-2">
            {options.map((opt, i) => (
              <label key={i} onClick={() => onChange(opt)} className="flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-white/5" style={{ border: value === opt ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.06)', background: value === opt ? 'rgba(0,255,136,0.05)' : 'transparent' }}>
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: value === opt ? 'var(--color-primary)' : '#4a4a60' }}>
                  {value === opt && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />}
                </div>
                <span className="font-mono text-sm text-gray-200">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'select_multi': {
        const selected: string[] = (() => { try { return value ? JSON.parse(value) : []; } catch { return []; } })();
        const toggleMulti = (opt: string) => {
          const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
          onChange(JSON.stringify(next));
        };
        return (
          <div className="space-y-2">
            {options.map((opt, i) => (
              <label key={i} onClick={() => toggleMulti(opt)} className="flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-white/5" style={{ border: selected.includes(opt) ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.06)', background: selected.includes(opt) ? 'rgba(0,255,136,0.05)' : 'transparent' }}>
                <div className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: selected.includes(opt) ? 'var(--color-primary)' : '#4a4a60', background: selected.includes(opt) ? 'var(--color-primary)' : 'transparent' }}>
                  {selected.includes(opt) && <span className="text-black text-[10px] font-bold">✓</span>}
                </div>
                <span className="font-mono text-sm text-gray-200">{opt}</span>
              </label>
            ))}
          </div>
        );
      }

      case 'dropdown':
        return (
          <select value={value} onChange={e => onChange(e.target.value)} className={baseClass}>
            <option value="">-- Выберите --</option>
            {options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
          </select>
        );

      case 'image_choice': {
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {options.map((opt, i) => (
              <button key={i} type="button" onClick={() => onChange(opt)}
                className="p-3 rounded-xl text-center transition-all"
                style={value === opt
                  ? { background: 'rgba(0,255,136,0.1)', border: '2px solid var(--color-primary)', boxShadow: '0 0 12px var(--color-glow)' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="font-mono text-xs text-gray-200">{opt}</span>
              </button>
            ))}
          </div>
        );
      }

      case 'ranking': {
        const order: string[] = (() => { try { return value ? JSON.parse(value) : [...options]; } catch { return [...options]; } })();
        const moveUp = (idx: number) => {
          if (idx <= 0) return;
          const next = [...order];[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
          onChange(JSON.stringify(next));
        };
        const moveDown = (idx: number) => {
          if (idx >= order.length - 1) return;
          const next = [...order];[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
          onChange(JSON.stringify(next));
        };
        return (
          <div className="space-y-1.5">
            {order.map((opt, i) => (
              <div key={opt} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="font-mono text-[10px] font-bold w-5 text-center" style={{ color: 'var(--color-primary)' }}>{i + 1}</span>
                <span className="flex-1 font-mono text-sm text-gray-200">{opt}</span>
                <button type="button" onClick={() => moveUp(i)} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 text-xs">▲</button>
                <button type="button" onClick={() => moveDown(i)} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 text-xs">▼</button>
              </div>
            ))}
          </div>
        );
      }

      case 'matrix': {
        const rows: string[] = settings.rows || ['Строка 1', 'Строка 2'];
        const cols: string[] = settings.cols || ['Столбец 1', 'Столбец 2'];
        const answers: Record<string, string> = (() => { try { return value ? JSON.parse(value) : {}; } catch { return {}; } })();
        const setCell = (row: string, col: string) => onChange(JSON.stringify({ ...answers, [row]: col }));
        return (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  {cols.map(col => <th key={col} className="p-2 font-mono text-[10px] text-gray-400 text-center">{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row}>
                    <td className="p-2 font-mono text-xs text-gray-300">{row}</td>
                    {cols.map(col => (
                      <td key={col} className="p-2 text-center">
                        <button type="button" onClick={() => setCell(row, col)}
                          className="w-5 h-5 rounded-full border-2 mx-auto transition-all"
                          style={{ borderColor: answers[row] === col ? 'var(--color-primary)' : '#4a4a60', background: answers[row] === col ? 'var(--color-primary)' : 'transparent' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'checkbox':
        return (
          <label onClick={() => onChange(value === 'true' ? '' : 'true')} className="flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-white/5" style={{ border: value === 'true' ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: value === 'true' ? 'var(--color-primary)' : '#4a4a60', background: value === 'true' ? 'var(--color-primary)' : 'transparent' }}>
              {value === 'true' && <span className="text-black text-xs font-bold">✓</span>}
            </div>
            <span className="font-mono text-sm text-gray-200">{field.label}</span>
          </label>
        );

      case 'rating': {
        const max = settings.max || 5;
        const current = parseInt(value) || 0;
        return (
          <div className="flex gap-1">
            {Array.from({ length: max }, (_, i) => (
              <button key={i} type="button" onClick={() => onChange(String(i + 1))}
                className="text-2xl transition-transform hover:scale-125"
                style={{ filter: i < current ? 'none' : 'grayscale(1) opacity(0.3)' }}>⭐</button>
            ))}
          </div>
        );
      }

      // ── Media ──
      case 'file':
        return (
          <div>
            <input type="file" onChange={e => { const file = e.target.files?.[0]; if (file) onChange(file.name); }} className="font-mono text-sm text-gray-300" />
          </div>
        );

      case 'multi_file': {
        const files: string[] = (() => { try { return value ? JSON.parse(value) : []; } catch { return []; } })();
        return (
          <div className="space-y-2">
            <input type="file" multiple onChange={e => {
              const names = Array.from(e.target.files || []).map(f => f.name);
              onChange(JSON.stringify([...files, ...names]));
            }} className="font-mono text-sm text-gray-300" />
            {files.length > 0 && (
              <div className="space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
                    <span className="font-mono text-xs text-gray-300 flex-1 truncate">{f}</span>
                    <button type="button" onClick={() => { const next = files.filter((_, j) => j !== i); onChange(JSON.stringify(next)); }}
                      className="text-gray-500 hover:text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'signature':
        return <SignaturePad value={value} onChange={onChange} />;

      case 'map': {
        const MapField = require('./MapField').default;
        return <MapField value={value} onChange={onChange} />;
      }

      default:
        return <input type="text" value={value} onChange={e => onChange(e.target.value)} className={baseClass} />;
    }
  };

  return (
    <div className="space-y-2">
      {field.type !== 'checkbox' && (
        <label className="block">
          <span className="font-mono text-sm text-gray-300">
            {field.label}
            {field.required === 1 && <span className="text-red-400 ml-1">*</span>}
          </span>
        </label>
      )}
      {renderInput()}
      {error && <p className="text-xs font-mono text-red-400">{error}</p>}
    </div>
  );
}

// ── Signature Pad Component ──
function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new window.Image();
    img.onload = () => { ctx.drawImage(img, 0, 0); };
    img.src = value;
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx || !lastPos.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#e8e8ec';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    setDrawing(false);
    lastPos.current = null;
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <canvas ref={canvasRef} width={400} height={150}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        className="w-full rounded-lg cursor-crosshair touch-none"
        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 150 }} />
      <button type="button" onClick={clear} className="font-mono text-[10px] text-gray-500 hover:text-gray-300 transition-colors">ОЧИСТИТЬ</button>
    </div>
  );
}
