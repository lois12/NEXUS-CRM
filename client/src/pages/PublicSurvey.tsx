import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import SurveyFillForm from '../components/surveys/SurveyFillForm';
import { publicSurveyApi, type Survey, type SurveyQuestion } from '../services/surveyApi';

/** Public survey page /survey/:slug */
export default function PublicSurvey() {
  const { slug } = useParams<{ slug: string }>();
  const [survey, setSurvey] = useState<(Survey & { questions: SurveyQuestion[] }) | null>(null);
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

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <SurveyFillForm survey={survey} slug={slug!} />
      </div>
    </div>
  );
}
