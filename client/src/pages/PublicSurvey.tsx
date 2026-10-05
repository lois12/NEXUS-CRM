import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Wrench, Clock, CheckCircle2 } from 'lucide-react';
import SurveyFillForm from '../components/surveys/SurveyFillForm';
import { publicSurveyApi, type Survey, type SurveyQuestion } from '../services/surveyApi';

type PubMode = 'open' | 'scheduled' | 'completed';

interface PubData extends Survey {
  questions: SurveyQuestion[];
  mode?: PubMode;
  opensAt?: string | null;
}

/** Public survey page /survey/:slug or /opros/:slug */
export default function PublicSurvey() {
  const { slug } = useParams<{ slug: string }>();
  const [survey, setSurvey] = useState<PubData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await publicSurveyApi.getBySlug(slug!);
        if (cancelled) return;
        if (res?.success) setSurvey(res.data);
        else setError(res?.error || 'Опрос не найден');
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || e?.message || 'Опрос не найден');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm text-gray-500">загрузка…</p>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass rounded-xl p-8 text-center max-w-md">
          <Wrench className="w-10 h-10 mx-auto mb-4 text-gray-600" />
          <p className="font-mono text-sm text-gray-300 mb-2">{error || 'Опрос не найден'}</p>
          <Link to="/" className="font-mono text-xs" style={{ color: 'var(--color-primary)' }}>
            на главную
          </Link>
        </div>
      </div>
    );
  }

  const mode: PubMode = survey.mode || 'open';

  if (mode === 'scheduled') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 text-center max-w-md space-y-3">
          <Clock className="w-12 h-12 mx-auto" style={{ color: '#eab308' }} />
          <h1 className="font-mono text-xl font-bold text-white">{survey.name}</h1>
          {survey.description && (
            <p className="font-mono text-xs text-gray-400 leading-relaxed">{survey.description}</p>
          )}
          <p className="font-mono text-sm" style={{ color: '#eab308' }}>
            Приём ответов откроется{' '}
            {survey.opensAt ? new Date(survey.opensAt).toLocaleString('ru-RU', {
              day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
            }) : 'позже'}
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 text-center max-w-md space-y-3">
          <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: '#6c9eff' }} />
          <h1 className="font-mono text-xl font-bold text-white">ОПРОС ЗАВЕРШЁН</h1>
          <p className="font-mono text-sm text-gray-300 leading-relaxed">
            {survey.thanksText || 'Спасибо всем, кто принял участие.'}
          </p>
          {survey.thanksRedirectUrl && (
            <a
              href={survey.thanksRedirectUrl}
              className="inline-block mt-2 px-4 py-2 rounded-lg font-mono text-xs font-bold"
              style={{ background: 'var(--color-primary)', color: '#000' }}
            >
              ПЕРЕЙТИ
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <SurveyFillForm survey={survey} slug={slug!} />
      </div>
    </div>
  );
}
