import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { showToast } from '../ui/NexusModal';

interface StatQ {
  id: string;
  type: 'choice' | 'open';
  title: string;
  total: number;
  distribution: { option: string; count: number; percent: number }[];
  openAnswers: string[];
}

interface Props {
  surveyName: string;
  stats: StatQ[];
  responseCount: number;
}

const PHRASES = [
  'Калькулятор считает, что вы лучший респондент.',
  '2+2=5 в маркетинге. Но в опросе всё честно.',
  'Тынц! Арифметика закончилась — начинается мнение.',
  'Ноль, единица, много. Вот и вся математика опроса.',
  'Проценты посчитали сами. Калькулятор отдыхает.',
];

/** Expandable export menu (Linux-style) */
export default function SurveyExportMenu({ surveyName, stats, responseCount }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Вопрос', 'Вариант/ответ', 'Чел.', '%'].map(esc).join(';')];
    for (const q of stats) {
      if (q.type === 'choice') {
        for (const d of q.distribution) {
          lines.push([q.title, d.option, d.count, `${d.percent}%`].map(esc).join(';'));
        }
      } else {
        for (const t of q.openAnswers) lines.push([q.title, t, '', ''].map(esc).join(';'));
      }
    }
    downloadBlob(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'survey_stats.csv');
    showToast('CSV сохранён', 'success');
    setOpen(false);
  };

  const exportXlsx = () => {
    const rows: any[][] = [['Вопрос', 'Вариант/ответ', 'Чел.', '%']];
    for (const q of stats) {
      if (q.type === 'choice') {
        for (const d of q.distribution) rows.push([q.title, d.option, d.count, `${d.percent}%`]);
      } else {
        for (const t of q.openAnswers) rows.push([q.title, t, '', '']);
      }
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 28 }, { wch: 48 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Статистика');
    XLSX.writeFile(wb, 'survey_stats.xlsx');
    showToast('Excel сохранён', 'success');
    setOpen(false);
  };

  const exportPdf = () => {
    setOpen(false);
    showToast('Печать — выберите «Сохранить как PDF»', 'info');
    setTimeout(() => window.print(), 250);
  };

  const calculator = () => {
    showToast(PHRASES[Math.floor(Math.random() * PHRASES.length)], 'info');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3.5 py-2 rounded-xl font-mono text-[11px] font-bold flex items-center gap-2 transition-colors"
        style={{
          background: open ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#c8c8d0',
        }}
      >
        ВЫГРУЗКА
        <span
          className="inline-block transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-52 overflow-hidden z-50"
          style={{
            borderRadius: 14,
            background: 'linear-gradient(160deg, rgba(16,20,28,0.98), rgba(10,12,18,0.99))',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.55), 0 0 30px rgba(0,255,136,0.08)',
            animation: 'exportUnfold .28s cubic-bezier(.2,.9,.25,1)',
            transformOrigin: 'top right',
          }}
        >
          <style>{`
            @keyframes exportUnfold {
              0% { opacity: 0; transform: scaleY(0.15) scaleX(0.92) translateY(-10px); filter: blur(4px); }
              55% { opacity: 1; filter: blur(0); }
              100% { opacity: 1; transform: none; }
            }
          `}</style>
          {([
            { label: 'PDF', hint: 'как на странице', fn: exportPdf },
            { label: 'CSV', hint: 'таблица', fn: exportCsv },
            { label: 'EXCEL', hint: 'xlsx', fn: exportXlsx },
            { label: 'КАЛЬКУЛЯТОР', hint: 'сюрприз', fn: calculator },
          ] as const).map((item, i) => (
            <button
              key={item.label}
              onClick={item.fn}
              className="w-full text-left px-3.5 py-2.5 font-mono text-[11px] transition-colors hover:bg-white/8 flex items-center justify-between"
              style={{
                color: item.label === 'КАЛЬКУЛЯТОР' ? '#ff8a3d' : '#d4d4dc',
                borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <span>{item.label}</span>
              <span className="text-[8px] text-gray-600">{item.hint}</span>
            </button>
          ))}
          <div className="px-3.5 py-1.5 font-mono text-[8px] text-gray-600 truncate" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {surveyName} · {responseCount} чел.
          </div>
        </div>
      )}
    </div>
  );
}
