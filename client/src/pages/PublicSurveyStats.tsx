import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RefreshCw, Users } from 'lucide-react';
import SurveyDailyChart from '../components/surveys/SurveyDailyChart';
import SurveyChartView, { type ChartView } from '../components/surveys/SurveyChartView';
import SurveyExportGlitch from '../components/surveys/SurveyExportGlitch';
import { AnimatedNumber } from '../components/surveys/useCountUp';
import { publicSurveyApi } from '../services/surveyApi';

interface StatQ {
  id: string;
  type: 'choice' | 'open';
  title: string;
  total: number;
  distribution: { option: string; count: number; percent: number }[];
  openAnswers: string[];
}

interface StatsData {
  name: string;
  description: string;
  responseCount: number;
  updatedAt?: string;
  stats: StatQ[];
  byDay?: { date: string; count: number }[];
}

const POLL_MS = 15000;

function fmtRu(sqlite?: string | null): string {
  if (!sqlite) return '';
  const iso = /[TzZ]/.test(String(sqlite)) ? String(sqlite) : String(sqlite).replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(sqlite);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Live public stats page — /opros/:slug/stats
 * Same look as HTML export, auto-refreshes while open.
 */
export default function PublicSurveyStats() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [chartView, setChartView] = useState<ChartView>('bars');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const res = await publicSurveyApi.getStats(slug!);
        if (cancelled) return;
        if (res?.success && res.data) {
          setData(res.data);
          setError('');
        } else {
          setError(res?.error || 'Опрос не найден');
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Опрос не найден');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setUpdatedAt(Date.now());
        }
      }
    };

    load();
    timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [slug]);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm text-gray-500">загрузка…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass rounded-xl p-8 text-center max-w-md">
          <p className="font-mono text-sm text-gray-300 mb-2">{error || 'Опрос не найден'}</p>
          <Link to="/" className="font-mono text-xs" style={{ color: 'var(--color-primary)' }}>на главную</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <style>{`
        @keyframes surveyFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      `}</style>
      <div className="max-w-2xl mx-auto space-y-3">
        {/* brand */}
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '2px solid var(--color-primary)' }}>
          <h1 className="font-mono text-sm tracking-[0.2em]" style={{ color: 'var(--color-primary)' }}>NEXUS CRM</h1>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-gray-500 tracking-widest hidden sm:inline">СТАТИСТИКА ОПРОСА</span>
            <SurveyExportGlitch
              surveyName={data.name}
              stats={data.stats}
              responseCount={data.responseCount}
            />
          </div>
        </div>

        <div>
          <h2 className="font-mono text-xl font-bold text-white">{data.name}</h2>
          {data.description && (
            <p className="font-mono text-xs text-gray-400 mt-1 leading-relaxed">{data.description}</p>
          )}
        </div>

        <div
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-bold transition-transform duration-300 hover:scale-[1.03]"
          style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.35)', color: 'var(--color-primary)' }}
        >
          <Users className="w-4 h-4" />
          ПРОГОЛОСОВАЛО: <AnimatedNumber value={data.responseCount} /> {data.responseCount === 1 ? 'ЧЕЛОВЕК' : 'ЧЕЛ.'}
        </div>

        <div className="flex items-center gap-2 flex-wrap font-mono text-[9px] text-gray-600">
          <RefreshCw className="w-3 h-3" />
          автообновление каждые 15 сек · обновлено {fmtRu(new Date(updatedAt).toISOString())}
          {data.updatedAt ? ` · данные ${fmtRu(data.updatedAt)}` : ''}
        </div>

        {/* global chart view — applies to all questions */}
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

        <SurveyDailyChart byDay={data.byDay || []} />

        {data.stats.map((q, qi) => (
          <div
            key={q.id}
            style={{
              animation: `surveyFade .45s ease ${(qi * 0.07).toFixed(2)}s both`,
            }}
          >
            {q.type === 'choice' ? (
              q.total === 0 ? (
                <div className="glass rounded-2xl p-4">
                  <h3 className="font-mono text-sm font-semibold text-gray-200 mb-2 leading-snug">{q.title}</h3>
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

        <div className="flex justify-between font-mono text-[10px] text-gray-600 pt-3 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span>NEXUS CRM · nexus-liberty.online</span>
          <span>{fmtRu(new Date().toISOString())}</span>
        </div>
      </div>
    </div>
  );
}
