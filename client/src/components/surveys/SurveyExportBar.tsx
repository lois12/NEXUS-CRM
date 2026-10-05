import { Download, FileText, Globe } from 'lucide-react';
import { surveyApi } from '../../services/surveyApi';
import { showToast } from '../ui/NexusModal';

interface Props {
  surveyId: string;
}

async function fetchAuthed(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || ''}`,
    },
  });
  return res.text();
}

/** CSV + PDF + HTML */
export default function SurveyExportBar({ surveyId }: Props) {
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

  const downloadHtml = async () => {
    try {
      const html = await fetchAuthed(surveyApi.exportHtmlUrl(surveyId));
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey_${surveyId}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('HTML сохранён', 'success');
    } catch {
      showToast('Ошибка HTML', 'error');
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
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
      <button
        onClick={downloadHtml}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10"
      >
        <Globe className="w-3.5 h-3.5" /> HTML
      </button>
    </div>
  );
}
