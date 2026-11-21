import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export interface ExportMenuItem {
  key: string;
  label: string;
  hint?: string;
}

interface Props {
  items: ExportMenuItem[];
  onPick: (key: string) => void;
  label?: string;
}

/** Одна кнопка «Экспорт» — фикс-выпадашка с форматами (PDF / PDF блюр / CSV / HTML …) */
export default function ExportMenu({ items, onPick, label = 'ЭКСПОРТ' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (open) { setOpen(false); return; }
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPos({ x: Math.min(r.left, Math.max(8, window.innerWidth - 190)), y: r.bottom + 6 });
          setOpen(true);
        }}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono text-xs glass hover:bg-white/10 nx-press"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="w-3.5 h-3.5" /> {label}
      </button>
      {open && pos && (
        <div
          className="fixed rounded-xl overflow-hidden"
          style={{ left: pos.x, top: pos.y, zIndex: 300, minWidth: 178, background: 'rgba(20,20,35,0.98)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(it.key); }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left nx-press hover:bg-white/5"
            >
              <span className="font-mono text-[10px] text-gray-200 whitespace-nowrap">{it.label}</span>
              {it.hint && <span className="font-mono text-[9px] text-gray-500 whitespace-nowrap">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Скачать HTML-страницу файла (без авто-печати) */
export function downloadHtml(html: string, filename: string) {
  const cleaned = html
    .replace(/<script>[\s\S]*?window\.print\(\);?[\s\S]*?<\/script>/gi, '')
    .replace(/window\.onload\s*=\s*(?:\(\)\s*=>)?\s*\{?\s*window\.print\(\);?\s*\}?/gi, '');
  const blob = new Blob([cleaned], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Скачать CSV с BOM (Excel-локаль) */
export function downloadCsv(csvText: string, filename: string) {
  const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
