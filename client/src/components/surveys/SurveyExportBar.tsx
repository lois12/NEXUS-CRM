import { Download, FileText, Link2, BarChart3, Table2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { surveyApi } from '../../services/surveyApi';
import { showToast } from '../ui/NexusModal';

interface Props {
  surveyId: string;
  publicSlug?: string | null;
}

async function fetchAuthed(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || ''}`,
    },
  });
  return res.text();
}

/** CSV + XLSX + PDF + live HTML stats page */
export default function SurveyExportBar({ surveyId, publicSlug }: Props) {
  const statsUrl = publicSlug ? `${window.location.origin}/opros/${publicSlug}/stats` : null;

  const downloadCsv = async () => {
    try {
      const blob = await surveyApi.downloadCsv(surveyId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey_${surveyId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('CSV сохранён', 'success');
    } catch {
      showToast('Ошибка CSV', 'error');
    }
  };

  const downloadXlsx = async () => {
    try {
      const res = await surveyApi.stats(surveyId);
      if (!res?.success) throw new Error('no data');
      const questions: { id: string; title: string; type: string }[] = res.data.stats || [];
      const responses: any[] = res.data.responses || [];

      const header = ['Дата', 'ФИО', 'Телефон', 'Email', ...questions.map((q) => q.title)];
      const rows = responses.map((r) => {
        const a = r.answers || {};
        return [
          r.createdAt,
          r.contactName || '',
          r.contactPhone || '',
          r.contactEmail || '',
          ...questions.map((q) => (a[q.id] ?? '')),
        ];
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws['!cols'] = header.map((_, i) => ({ wch: i < 4 ? 18 : 28 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Ответы');

      // summary sheet
      const summary: any[][] = [['Вопрос', 'Вариант/ответ', 'Чел.', '%']];
      for (const q of questions) {
        if (q.type === 'choice') {
          const st = (res.data.stats || []).find((x: any) => x.id === q.id);
          for (const d of st?.distribution || []) {
            summary.push([q.title, d.option, d.count, `${d.percent}%`]);
          }
        } else {
          const st = (res.data.stats || []).find((x: any) => x.id === q.id);
          for (const t of st?.openAnswers || []) summary.push([q.title, t, '', '']);
        }
      }
      const ws2 = XLSX.utils.aoa_to_sheet(summary);
      ws2['!cols'] = [{ wch: 28 }, { wch: 36 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Сводка');

      XLSX.writeFile(wb, `survey_${surveyId}.xlsx`);
      showToast('XLSX сохранён', 'success');
    } catch {
      showToast('Ошибка XLSX', 'error');
    }
  };

  const openPdf = async () => {
    try {
      const html = await fetchAuthed(surveyApi.exportPdfUrl(surveyId));
      const w = window.open('', '_blank');
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      }
    } catch {
      showToast('Ошибка PDF', 'error');
    }
  };

  const openLiveStats = () => {
    if (statsUrl) window.open(statsUrl, '_blank');
    else showToast('Сначала опубликуйте опрос', 'info');
  };

  const copyStatsLink = async () => {
    if (!statsUrl) {
      showToast('Сначала опубликуйте опрос', 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(statsUrl);
      showToast('Ссылка на статистику скопирована', 'success');
    } catch {
      showToast(statsUrl, 'info');
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={openLiveStats}
        className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] font-bold"
        
        title="Живая страница статистики"
      >
        <BarChart3 className="w-3.5 h-3.5" /> HTML СТАТИСТИКА
      </button>
      <button
        onClick={copyStatsLink}
        disabled={!statsUrl}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10 disabled:opacity-40"
      >
        <Link2 className="w-3.5 h-3.5" /> ССЫЛКА
      </button>
      <button
        onClick={downloadCsv}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10"
      >
        <Download className="w-3.5 h-3.5" /> CSV
      </button>
      <button
        onClick={downloadXlsx}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10"
      >
        <Table2 className="w-3.5 h-3.5" /> XLSX
      </button>
      <button
        onClick={openPdf}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10"
      >
        <FileText className="w-3.5 h-3.5" /> PDF
      </button>
    </div>
  );
}
