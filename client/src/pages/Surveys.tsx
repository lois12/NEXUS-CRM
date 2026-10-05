import { useEffect, useState } from 'react';
import SurveyList from '../components/surveys/SurveyList';
import SurveyBuilder from '../components/surveys/SurveyBuilder';
import SurveyStats from '../components/surveys/SurveyStats';
import { surveyApi, type Survey, type SurveyQuestion, type SurveyStatus } from '../services/surveyApi';
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
    if (s.publicSlug && (s.status === 'published' || s.status === 'completed' || s.isPublic)) {
      window.open(`/opros/${s.publicSlug}`, '_blank');
    } else {
      showToast('Опрос ещё не доступен по ссылке', 'info');
    }
  };

  const setStatus = async (s: Survey, status: SurveyStatus, opensAt?: string) => {
    try {
      const res = await surveyApi.setStatus(s.id, status, opensAt);
      if (res?.success) {
        const labels: Record<SurveyStatus, string> = {
          draft: 'Черновик', scheduled: 'Запланирован', published: 'Опубликован', completed: 'Завершён',
        };
        showToast(labels[status], 'success');
        refresh();
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Ошибка статуса', 'error');
    }
  };

  const duplicate = async (s: Survey) => {
    try {
      const res = await surveyApi.duplicate(s.id);
      if (res?.success) {
        showToast('Опрос скопирован', 'success');
        refresh();
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Ошибка копирования', 'error');
    }
  };

  const remove = async (s: Survey) => {
    try {
      await surveyApi.remove(s.id);
      showToast('Удалено', 'success');
      refresh();
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Ошибка удаления', 'error');
    }
  };

  const copyLink = async (s: Survey) => {
    const url = `${window.location.origin}/opros/${s.publicSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Ссылка скопирована', 'success');
    } catch {
      showToast(url, 'info');
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
      onSetStatus={setStatus}
      onDuplicate={duplicate}
      onDelete={remove}
      onCopyLink={copyLink}
    />
  );
}
