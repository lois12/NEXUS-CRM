import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RefreshCw, Users } from 'lucide-react';
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
      <div className="max-w-2xl mx-auto space-y-3">
        {/* brand */}
        <div className="flex items-center justify-between pb-2" style={{ borderBottom: '2px solid var(--color-primary)' }}>
          <h1 className="font-mono text-sm tracking-[0.2em]" style={{ color: 'var(--color-primary)' }}>NEXUS CRM</h1>
          <span className="font-mono text-[10px] text-gray-500 tracking-widest">СТАТИСТИКА ОПРОСА</span>
        </div>

        <div>
          <h2 className="font-mono text-xl font-bold text-white">{data.name}</h2>
          {data.description && (
            <p className="font-mono text-xs text-gray-400 mt-1 leading-relaxed">{data.description}</p>
          )}
        </div>

        <div
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-bold"
          style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.35)', color: 'var(--color-primary)' }}
        >
          <Users className="w-4 h-4" />
          ПРОГОЛОСОВАЛО: {data.responseCount} {data.responseCount === 1 ? 'ЧЕЛОВЕК' : 'ЧЕЛ.'}
        </div>

        <div className="flex items-center gap-2 flex-wrap font-mono text-[9px] text-gray-600">
          <RefreshCw className="w-3 h-3" />
          автообновление каждые 15 сек · обновлено {fmtRu(new Date(updatedAt).toISOString())}
          {data.updatedAt ? ` · данные ${fmtRu(data.updatedAt)}` : ''}
        </div>

        {data.stats.map((q) => (
          <div key={q.id} className="glass rounded-2xl p-4 space-y-3">
            <h3 className="font-mono text-sm font-semibold text-gray-200 leading-snug">{q.title}</h3>
            {q.type === 'choice' ? (
              q.total === 0 ? (
                <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
              ) : (
                <div className="space-y-2.5">
                  {q.distribution.map((d) => (
                    <div key={d.option} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-[11px] text-gray-300 truncate min-w-0">{d.option}</span>
                        <span className="font-mono text-[11px] tabular-nums shrink-0" style={{ color: 'var(--color-primary)' }}>
                          {d.percent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${d.percent}%`, background: 'var(--color-primary)', opacity: 0.9 }}
                        />
                      </div>
                      <div className="font-mono text-[9px] text-gray-600">{d.count} чел.</div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-1.5">
                {q.openAnswers.length === 0 && (
                  <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
                )}
                {q.openAnswers.map((a, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg font-mono text-[11px] text-gray-300 leading-relaxed"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    {a}
                  </div>
                ))}
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
