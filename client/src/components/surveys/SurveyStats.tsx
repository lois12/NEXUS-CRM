import { useEffect, useState } from 'react';
import { ArrowLeft, Users, Clock } from 'lucide-react';
import SurveyCharts, { type ChoiceStat } from './SurveyCharts';
import SurveyExportBar from './SurveyExportBar';
import { surveyApi, type Survey, type SurveyQuestion } from '../../services/surveyApi';
import { showToast } from '../ui/NexusModal';

interface StatQ extends SurveyQuestion {
  total: number;
  distribution: ChoiceStat[];
  openAnswers: string[];
}

interface Props {
  surveyId: string;
  onBack: () => void;
}

/** Stats dashboard + export for one survey */
export default function SurveyStats({ surveyId, onBack }: Props) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [stats, setStats] = useState<StatQ[]>([]);
  const [responseCount, setResponseCount] = useState(0);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await surveyApi.stats(surveyId);
        if (cancelled) return;
        if (res?.success && res.data) {
          setSurvey(res.data.survey);
          setStats(res.data.stats || []);
          setResponseCount(res.data.responseCount || 0);
          setLastAt(res.data.lastResponseAt || null);
        }
      } catch {
        showToast('Ошибка загрузки статистики', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [surveyId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">
          <ArrowLeft className="w-3.5 h-3.5" /> НАЗАД
        </button>
        <h2 className="font-mono text-base sm:text-lg font-bold flex-1 min-w-0 truncate" style={{ color: 'var(--color-primary)' }}>
          СТАТИСТИКА · {survey?.name || '…'}
        </h2>
        <SurveyExportBar surveyId={surveyId} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3 flex items-center gap-2">
          <Users className="w-5 h-5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <div>
            <div className="font-mono text-[10px] text-gray-500">ОТВЕТОВ</div>
            <div className="font-mono text-lg font-bold text-white">{responseCount}</div>
          </div>
        </div>
        <div className="glass rounded-xl p-3 flex items-center gap-2">
          <Clock className="w-5 h-5 shrink-0" style={{ color: '#3b82f6' }} />
          <div className="min-w-0">
            <div className="font-mono text-[10px] text-gray-500">ПОСЛЕДНИЙ ОТВЕТ</div>
            <div className="font-mono text-xs text-white truncate">
              {lastAt ? new Date(lastAt).toLocaleString('ru-RU') : '—'}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="font-mono text-xs text-gray-500">загрузка…</p>
      ) : (
        <div className="space-y-3">
          {stats.map((q) => (
            <SurveyCharts
              key={q.id || q.title}
              title={q.title}
              type={q.type}
              total={q.total}
              distribution={q.distribution}
              openAnswers={q.openAnswers}
            />
          ))}
          {stats.length === 0 && (
            <p className="font-mono text-[10px] text-gray-600 text-center py-6">в опросе пока нет вопросов</p>
          )}
        </div>
      )}
    </div>
  );
}
