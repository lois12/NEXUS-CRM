import { useEffect, useState } from 'react';
import SurveyList from '../components/surveys/SurveyList';
import SurveyBuilder from '../components/surveys/SurveyBuilder';
import SurveyStats from '../components/surveys/SurveyStats';
import { surveyApi, type Survey, type SurveyQuestion } from '../services/surveyApi';
import { showToast } from '../components/ui/NexusModal';

type View = 'list' | 'builder' | 'stats';

/** Thin orchestrator — UI lives in components/surveys/* */
export default function Surveys() {
  const [view, setView] = useState<View>('list');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [current, setCurrent] = useState<Survey | null>(null);

  const refresh = async () => {
    try {
      const res = await surveyApi.getAll();
      if (res?.success) setSurveys(res.data || []);
    } catch {
      showToast('Ошибка загрузки опросов', 'error');
    }
  };

  useEffect(() => { refresh(); }, []);

  const createSurvey = async () => {
    try {
      const res = await surveyApi.create({ name: 'Новый опрос', description: '', isAnonymous: false });
      if (res?.success && res.data) {
        setCurrent({ ...res.data, questions: [] as SurveyQuestion[] });
        setView('builder');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Ошибка создания', 'error');
    }
  };

  const openEdit = async (s: Survey) => {
    try {
      const res = await surveyApi.getOne(s.id);
      if (res?.success) {
        setCurrent(res.data);
        setView('builder');
      }
    } catch {
      showToast('Ошибка открытия', 'error');
    }
  };

  const openStats = (s: Survey) => {
    setCurrent(s);
    setView('stats');
  };

  const openPublic = (s: Survey) => {
    if (s.isPublic && s.publicSlug) {
      window.open(`/survey/${s.publicSlug}`, '_blank');
    } else {
      showToast('Сначала опубликуйте опрос', 'info');
    }
  };

  if (view === 'builder' && current) {
    return (
      <SurveyBuilder
        survey={current}
        onBack={() => { setView('list'); refresh(); }}
        onSaved={async () => {
          const res = await surveyApi.getOne(current.id);
          if (res?.success) setCurrent(res.data);
          refresh();
        }}
      />
    );
  }

  if (view === 'stats' && current) {
    return <SurveyStats surveyId={current.id} onBack={() => { setView('list'); refresh(); }} />;
  }

  return (
    <SurveyList
      surveys={surveys}
      onCreate={createSurvey}
      onEdit={openEdit}
      onStats={openStats}
      onOpenPublic={openPublic}
    />
  );
}
