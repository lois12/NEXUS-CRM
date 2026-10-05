import { useState, useRef, useEffect } from 'react';
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
  'Калькулятор думает, что вы лучший респондент. 2+2=5 в маркетинге.',
  'Считаем взглядом: один вы тут чего стоите…',
  'Тынц! Арифметика закончилась — начинается мнение.',
  'Ноль, единица, много. Вот и вся математика опроса.',
  'Калькулятор устал. Пусть проценты сами себя посчитают.',
];

/** Glitch-style export dropdown: PDF / CSV / Excel / Calculator (easter egg) */
export default function SurveyExportGlitch({ surveyName, stats, responseCount }: Props) {
  const [open, setOpen] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const triggerGlitch = () => {
    setGlitch(true);
    setTimeout(() => setGlitch(false), 350);
    setOpen((v) => !v);
  };

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
        for (const t of q.openAnswers) {
          lines.push([q.title, t, '', ''].map(esc).join(';'));
        }
      }
    }
    downloadBlob(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'survey_stats.csv');
    showToast('CSV сохранён', 'success');
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
    ws['!cols'] = [{ wch: 28 }, { wch: 36 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Статистика');
    XLSX.writeFile(wb, 'survey_stats.xlsx');
    showToast('Excel сохранён', 'success');
  };

  const exportPdf = () => {
    showToast('Открываем печать — выберите «Сохранить как PDF»', 'info');
    setTimeout(() => window.print(), 300);
  };

  const calculator = () => {
    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    showToast(phrase, 'info');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={triggerGlitch}
        className="px-4 py-2.5 rounded-xl font-mono text-xs font-bold relative overflow-hidden"
        style={{
          background: 'rgba(0,255,136,0.12)',
          border: '1px solid rgba(0,255,136,0.35)',
          color: 'var(--color-primary)',
          textShadow: glitch ? '2px 0 #ff00aa, -2px 0 #00e5ff' : 'none',
          transform: glitch ? 'skewX(-3deg)' : 'none',
          transition: 'transform .15s ease, text-shadow .15s ease',
        }}
      >
        {glitch ? 'В Ы Г Р У З К А' : 'ВЫГРУЗКА'} ▾
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden z-50"
          style={{
            background: 'linear-gradient(160deg, rgba(12,14,20,0.98), rgba(8,10,16,0.99))',
            border: '1px solid rgba(0,255,136,0.25)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 24px rgba(0,255,136,0.12)',
            animation: 'glitchIn .22s ease',
          }}
        >
          <style>{`
            @keyframes glitchIn {
              0% { opacity: 0; transform: translateY(-6px) scaleX(0.96); clip-path: inset(0 0 80% 0); }
              35% { clip-path: inset(20% 0 30% 0); }
              65% { clip-path: inset(0 0 10% 0); }
              100% { opacity: 1; transform: none; clip-path: inset(0); }
            }
          `}</style>
          {[
            { id: 'pdf', label: 'PDF', hint: 'печать в PDF', fn: exportPdf },
            { id: 'csv', label: 'CSV', hint: 'таблица для Excel', fn: exportCsv },
            { id: 'xlsx', label: 'EXCEL', hint: 'xlsx', fn: exportXlsx },
            { id: 'calc', label: 'КАЛЬКУЛЯТОР', hint: 'сюрприз', fn: calculator },
          ].map((item, i) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id !== 'calc') setOpen(false);
                item.fn();
              }}
              className="w-full text-left px-4 py-2.5 font-mono text-[11px] transition-colors hover:bg-white/10 flex items-center justify-between"
              style={{
                color: item.id === 'calc' ? '#ff8a3d' : '#d4d4dc',
                borderTop: i ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <span>{item.label}</span>
              <span className="text-[8px] text-gray-600">{item.hint}</span>
            </button>
          ))}
          <div className="px-4 py-2 font-mono text-[8px] text-gray-600" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {surveyName} · {responseCount} чел.
          </div>
        </div>
      )}
    </div>
  );
}
