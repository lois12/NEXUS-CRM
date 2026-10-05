import { Download, FileText, Link2, BarChart3 } from 'lucide-react';
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

/** CSV + PDF + live HTML stats page */
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
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] font-bold"
        style={{ background: 'var(--color-primary)', color: '#000' }}
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
        onClick={openPdf}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10"
      >
        <FileText className="w-3.5 h-3.5" /> PDF
      </button>
    </div>
  );
}
