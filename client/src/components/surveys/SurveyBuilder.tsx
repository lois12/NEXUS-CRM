import { useState } from 'react';
import { Plus, Save, ArrowLeft } from 'lucide-react';
import SurveyMetaFields from './SurveyMetaFields';
import SurveyQuestionCard from './SurveyQuestionCard';
import type { Survey, SurveyQuestion } from '../../services/surveyApi';
import { surveyApi } from '../../services/surveyApi';
import { showToast } from '../ui/NexusModal';

interface Props {
  survey: Survey;
  onSaved: () => void;
  onBack: () => void;
}

/** Block-builder: meta + questions + save */
export default function SurveyBuilder({ survey, onSaved, onBack }: Props) {
  const [name, setName] = useState(survey.name);
  const [description, setDescription] = useState(survey.description || '');
  const [imageUrl, setImageUrl] = useState(survey.imageUrl || '');
  const [isAnonymous, setIsAnonymous] = useState(!!survey.isAnonymous);
  const [questions, setQuestions] = useState<SurveyQuestion[]>(
    (survey.questions || []).map((q) => ({
      id: q.id,
      type: q.type,
      title: q.title,
      options: q.options || [],
      required: !!q.required,
    })),
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const setQ = (i: number, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) => prev.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  };

  const moveQ = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestions(next);
  };

  const reorderQ = (from: number, to: number) => {
    if (from === to) return;
    const next = [...questions];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setQuestions(next);
  };

  const save = async () => {
    if (!name.trim()) {
      showToast('Укажите название', 'error');
      return;
    }
    setSaving(true);
    try {
      await surveyApi.update(survey.id, {
        name: name.trim(),
        description,
        imageUrl,
        isAnonymous,
      });

      // questions: create missing, update existing, delete removed
      const existingIds = (survey.questions || []).map((q) => q.id).filter(Boolean) as string[];
      const keepIds: string[] = [];
      for (const q of questions) {
        if (q.id) {
          await surveyApi.updateQuestion(survey.id, q.id, {
            title: q.title,
            type: q.type,
            options: q.options,
            required: q.required,
          });
          keepIds.push(q.id);
        } else {
          const res = await surveyApi.createQuestion(survey.id, {
            type: q.type,
            title: q.title,
            options: q.options,
            required: q.required,
          });
          if (res?.data?.id) keepIds.push(res.data.id);
        }
      }
      for (const id of existingIds) {
        if (!keepIds.includes(id)) await surveyApi.deleteQuestion(survey.id, id);
      }
      if (keepIds.length) await surveyApi.reorderQuestions(survey.id, keepIds);

      showToast('Опрос сохранён', 'success');
      onSaved();
    } catch (e: any) {
      showToast(e?.response?.data?.error || e?.message || 'Ошибка сохранения', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">
          <ArrowLeft className="w-3.5 h-3.5" /> НАЗАД
        </button>
        <h2 className="font-mono text-lg font-bold flex-1 min-w-0 truncate" style={{ color: 'var(--color-primary)' }}>
          КОНСТРУКТОР · {name || 'новый опрос'}
        </h2>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold disabled:opacity-50"
          style={{ background: 'var(--color-primary)', color: '#000' }}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'СОХРАНЕНИЕ…' : 'СОХРАНИТЬ'}
        </button>
      </div>

      <SurveyMetaFields
        name={name}
        description={description}
        imageUrl={imageUrl}
        isAnonymous={isAnonymous}
        onChange={(p) => {
          if (p.name !== undefined) setName(p.name);
          if (p.description !== undefined) setDescription(p.description);
          if (p.imageUrl !== undefined) setImageUrl(p.imageUrl);
          if (p.isAnonymous !== undefined) setIsAnonymous(p.isAnonymous);
        }}
        onUploadCover={async (file) => {
          try {
            const res = await surveyApi.uploadImage(survey.id, file);
            if (res?.data?.imageUrl) setImageUrl(res.data.imageUrl);
          } catch {
            showToast('Ошибка загрузки обложки', 'error');
          }
        }}
      />

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-gray-500">ВОПРОСЫ ({questions.length})</span>
        <button
          onClick={() => setQuestions((prev) => [...prev, { type: 'choice', title: '', options: ['', ''], required: false }])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] glass hover:bg-white/10"
        >
          <Plus className="w-3.5 h-3.5" /> ВОПРОС
        </button>
      </div>

      <div className="space-y-2">
        {questions.map((q, i) => (
          <SurveyQuestionCard
            key={q.id || `new-${i}`}
            q={q}
            index={i}
            total={questions.length}
            onChange={(patch) => setQ(i, patch)}
            onRemove={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
            onMove={(d) => moveQ(i, d)}
            onDragStart={() => setDragIdx(i)}
            onDrop={() => {
              if (dragIdx !== null) reorderQ(dragIdx, i);
              setDragIdx(null);
            }}
          />
        ))}
        {questions.length === 0 && (
          <p className="font-mono text-[10px] text-gray-600 text-center py-4">добавьте первый вопрос</p>
        )}
      </div>
    </div>
  );
}
