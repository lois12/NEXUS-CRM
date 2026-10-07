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
  description?: string;
}

const PHRASES = [
  'Калькулятор считает, что вы лучший респондент.',
  '2+2=5 в маркетинге. Но в опросе всё честно.',
  'Тынц! Арифметика закончилась — начинается мнение.',
  'Ноль, единица, много. Вот и вся математика опроса.',
  'Проценты посчитали сами. Калькулятор отдыхает.',
];

function safeFileName(name: string): string {
  return (name || 'survey')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60);
}

function fmtNow(): string {
  return new Date().toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Expandable export menu (Linux-style) */
export default function SurveyExportMenu({ surveyName, stats, responseCount, description }: Props) {
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

  const base = safeFileName(surveyName);

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      [`Опрос`, surveyName].map(esc).join(';'),
      [`Проголосовало`, responseCount].map(esc).join(';'),
      [`Сформировано`, fmtNow()].map(esc).join(';'),
      '',
      ['Вопрос', 'Вариант/ответ', 'Чел.', '%'].map(esc).join(';'),
    ];
    for (const q of stats) {
      if (q.type === 'choice') {
        for (const d of q.distribution) {
          lines.push([q.title, d.option, d.count, `${d.percent}%`].map(esc).join(';'));
        }
      } else {
        for (const t of q.openAnswers) lines.push([q.title, t, '', ''].map(esc).join(';'));
      }
    }
    downloadBlob(
      new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
      `${base}_stats.csv`
    );
    showToast('CSV сохранён', 'success');
    setOpen(false);
  };

  const exportXlsx = () => {
    const meta: any[][] = [
      ['Опрос', surveyName],
      ['Проголосовало', responseCount],
      ['Сформировано', fmtNow()],
      [],
      ['Вопрос', 'Вариант/ответ', 'Чел.', '%'],
    ];
    for (const q of stats) {
      if (q.type === 'choice') {
        for (const d of q.distribution) meta.push([q.title, d.option, d.count, `${d.percent}%`]);
      } else {
        for (const t of q.openAnswers) meta.push([q.title, t, '', '']);
      }
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(meta);
    ws['!cols'] = [{ wch: 28 }, { wch: 48 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Статистика');

    // answers sheet if we have open answers
    const opens: any[][] = [['Вопрос', 'Ответ']];
    for (const q of stats) {
      for (const t of q.openAnswers || []) opens.push([q.title, t]);
    }
    if (opens.length > 1) {
      const ws2 = XLSX.utils.aoa_to_sheet(opens);
      ws2['!cols'] = [{ wch: 36 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Открытые ответы');
    }

    XLSX.writeFile(wb, `${base}_stats.xlsx`);
    showToast('Excel сохранён', 'success');
    setOpen(false);
  };

  /** Clean printable PDF report (not window.print of the dark SPA) */
  const exportPdf = () => {
    setOpen(false);
    const questionsHtml = stats
      .map((q) => {
        const body =
          q.type === 'choice'
            ? `
            <table class="dist">
              <thead><tr><th>Вариант</th><th>Чел.</th><th style="width:45%">Доля</th></tr></thead>
              <tbody>
                ${q.distribution
                  .map(
                    (d) => `
                  <tr>
                    <td>${escapeHtml(d.option)}</td>
                    <td class="num">${d.count}</td>
                    <td>
                      <div class="bar-wrap">
                        <div class="bar" style="width:${Math.max(2, d.percent)}%"></div>
                        <span class="pct">${d.percent}%</span>
                      </div>
                    </td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>`
            : q.openAnswers.length
            ? `<div class="opens">${q.openAnswers
                .map((a) => `<div class="open-item">${escapeHtml(a)}</div>`)
                .join('')}</div>`
            : `<p class="muted">— ответов нет —</p>`;

        return `
        <section class="q">
          <h3>${escapeHtml(q.title)}</h3>
          <div class="meta">всего отметок: ${q.total}${q.type === 'open' ? ` · открытых ответов: ${q.openAnswers.length}` : ''}</div>
          ${body}
        </section>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<title>${escapeHtml(surveyName)} — статистика</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 28px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .sub { color: #555; margin-bottom: 4px; }
  .badge {
    display: inline-block; margin: 10px 0 16px; padding: 6px 12px;
    border: 1px solid #0f766e; border-radius: 6px; color: #0f766e; font-weight: 700;
  }
  .q { border: 1px solid #ddd; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
  .q h3 { font-size: 13px; margin: 0 0 4px; }
  .meta { color: #777; font-size: 10px; margin-bottom: 8px; }
  table.dist { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.dist th { text-align: left; background: #f3f4f6; padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 10px; text-transform: uppercase; color: #555; }
  table.dist td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
  .num { width: 50px; text-align: right; font-variant-numeric: tabular-nums; }
  .bar-wrap { display: flex; align-items: center; gap: 8px; }
  .bar { height: 8px; background: #0f766e; border-radius: 4px; min-width: 2px; }
  .pct { color: #444; font-variant-numeric: tabular-nums; min-width: 36px; }
  .opens { display: grid; gap: 6px; }
  .open-item { padding: 6px 8px; background: #f8fafc; border-left: 3px solid #0f766e; border-radius: 4px; }
  .muted { color: #999; font-style: italic; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; color: #888; font-size: 10px; }
  @media print { @page { margin: 12mm; } body { margin: 0; } }
</style></head>
<body>
  <h1>${escapeHtml(surveyName)}</h1>
  ${description ? `<div class="sub">${escapeHtml(description)}</div>` : ''}
  <div class="badge">ПРОГОЛОСОВАЛО: ${responseCount} чел.</div>
  ${questionsHtml}
  <div class="footer">NEXUS CRM · сформировано ${fmtNow()}</div>
  <script>window.onload = () => window.print();</script>
</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      showToast('Разрешите всплывающие окна для PDF', 'error');
      return;
    }
    w.document.write(html);
    w.document.close();
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
            { label: 'PDF', hint: 'чистый отчёт', fn: exportPdf },
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

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
