import { useEffect, useState } from 'react';
import { ArrowLeft, Users, Clock } from 'lucide-react';
import SurveyChartView, { type ChartView, type ChoiceStat } from './SurveyChartView';
import SurveyExportBar from './SurveyExportBar';
import SurveyDailyChart from './SurveyDailyChart';
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
  const [byDay, setByDay] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<ChartView>('bars');

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
          setByDay(res.data.byDay || []);
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
        <SurveyExportBar surveyId={surveyId} publicSlug={survey?.publicSlug} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3 flex items-center gap-2">
          <Users className="w-5 h-5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <div>
            <div className="font-mono text-[10px] text-gray-500">ПРОГОЛОСОВАЛО</div>
            <div className="font-mono text-lg font-bold text-white">
              {responseCount} {responseCount === 1 ? 'человек' : 'чел.'}
            </div>
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

      <SurveyDailyChart byDay={byDay} />

      {/* global chart view */}
      <div className="glass rounded-xl px-3 py-2.5 flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">ВИД</span>
        {([
          ['bars', 'Гистограмма'],
          ['pie3d', 'Круговая 3D'],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setChartView(v)}
            className="px-3 py-1.5 rounded-lg font-mono text-[11px] transition-all duration-200 hover:scale-105"
            style={chartView === v
              ? { background: 'var(--color-primary)', color: '#000', boxShadow: '0 0 16px rgba(0,255,136,0.35)' }
              : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="font-mono text-xs text-gray-500">загрузка…</p>
      ) : (
        <div className="space-y-3">
          {stats.map((q) => (
            <div key={q.id || q.title}>
              {q.type === 'choice' ? (
                q.total === 0 ? (
                  <div className="glass rounded-2xl p-4">
                    <h3 className="font-mono text-sm font-semibold text-gray-200 mb-2 leading-snug" style={{ wordBreak: 'break-word' }}>{q.title}</h3>
                    <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
                  </div>
                ) : (
                  <SurveyChartView
                    title={q.title}
                    data={q.distribution}
                    view={chartView}
                    onViewChange={setChartView}
                  />
                )
              ) : (
                <div className="glass rounded-2xl p-4 space-y-3">
                  <h3 className="font-mono text-sm font-semibold text-gray-200 leading-snug" style={{ wordBreak: 'break-word' }}>{q.title}</h3>
                  <div className="space-y-1.5">
                    {q.openAnswers.length === 0 && (
                      <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
                    )}
                    {q.openAnswers.map((a, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 rounded-lg font-mono text-[11px] text-gray-300 leading-relaxed"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {stats.length === 0 && (
            <p className="font-mono text-[10px] text-gray-600 text-center py-6">в опросе пока нет вопросов</p>
          )}
        </div>
      )}
    </div>
  );
}
