import { Download, FileText } from 'lucide-react';
import { surveyApi } from '../../services/surveyApi';
import { showToast } from '../ui/NexusModal';

interface Props {
  surveyId: string;
}

/** CSV download + printable PDF */
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
      // authed fetch — bare window.open misses the Bearer token
      const res = await fetch(`/api/surveys/${surveyId}/export/pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || ''}`,
        },
      });
      const html = await res.text();
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

  return (
    <div className="flex gap-2">
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
