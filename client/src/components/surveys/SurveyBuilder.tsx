import { useState } from 'react';
import { Plus, Save, ArrowLeft, Globe, EyeOff, Copy, ExternalLink } from 'lucide-react';
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
  const [isPublic, setIsPublic] = useState(!!survey.isPublic);
  const [publicSlug, setPublicSlug] = useState(survey.publicSlug || '');
  const [thanksText, setThanksText] = useState(
    survey.thanksText || 'Спасибо что уделили время и проши опрос, Ваше мнение важно для нас',
  );
  const [thanksRedirectUrl, setThanksRedirectUrl] = useState(
    survey.thanksRedirectUrl || 'https://visit-norilsk.ru',
  );
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

  const publicUrl = (publicSlug || '')
    ? `${window.location.origin}/opros/${publicSlug}`
    : null;

  const togglePublish = async () => {
    try {
      await save(true);
      const res = await surveyApi.togglePublish(survey.id);
      if (res?.success && res.data) {
        setIsPublic(!!res.data.isPublic);
        setPublicSlug(res.data.publicSlug || publicSlug || '');
        showToast(res.data.isPublic ? 'Опрос опубликован' : 'Снят с публикации', 'success');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || e?.message || 'Ошибка публикации', 'error');
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast('Ссылка скопирована', 'success');
    } catch {
      showToast(publicUrl, 'info');
    }
  };

  const save = async (quiet = false) => {
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
        thanksText,
        thanksRedirectUrl,
        publicSlug,
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

      if (!quiet) showToast('Опрос сохранён', 'success');
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
          onClick={() => save()}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#ccc' }}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'СОХРАНЕНИЕ…' : 'СОХРАНИТЬ'}
        </button>
        <button
          onClick={togglePublish}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold disabled:opacity-50"
          style={isPublic
            ? { background: 'rgba(234,179,8,0.2)', color: '#eab308', border: '1px solid rgba(234,179,8,0.4)' }
            : { background: 'var(--color-primary)', color: '#000' }}
          title={isPublic ? 'Снять с публикации' : 'Сохранить и опубликовать'}
        >
          {isPublic ? <><EyeOff className="w-3.5 h-3.5" /> СНЯТЬ С ПУБЛИКАЦИИ</> : <><Globe className="w-3.5 h-3.5" /> ОПУБЛИКОВАТЬ</>}
        </button>
      </div>

      {/* Link plate — edit path + copy */}
      <div
        className="rounded-xl p-3 space-y-2"
        style={{
          background: isPublic ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isPublic ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        <div className="font-mono text-[9px] text-gray-500 uppercase tracking-wider">
          Ссылка для пользователей · можно задать свой адрес
        </div>
        <div className="flex items-stretch gap-2 flex-wrap">
          <div className="flex items-stretch flex-1 min-w-[220px]">
            <span className="px-2.5 flex items-center rounded-l-lg font-mono text-[11px] text-gray-400 border border-r-0 border-gray-700 bg-white/5">
              /opros/
            </span>
            <input
              value={publicSlug}
              onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9а-яё_-]/g, '-'))}
              placeholder="ocenka-meropriyatiya"
              className="flex-1 px-2 py-2.5 rounded-r-lg font-mono text-sm bg-black/40 border border-gray-700 text-white focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <button
            onClick={() => save()}
            disabled={saving}
            className="px-3 py-2 rounded-lg font-mono text-[11px] font-bold disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#ddd' }}
            title="Сохранить адрес"
          >
            <Save className="w-3.5 h-3.5 inline mr-1" />СОХРАНИТЬ АДРЕС
          </button>
          <button
            onClick={copyLink}
            disabled={!isPublic}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] font-bold disabled:opacity-40"
            style={{ background: 'var(--color-primary)', color: '#000' }}
          >
            <Copy className="w-3.5 h-3.5" /> КОПИРОВАТЬ
          </button>
          {isPublic && publicUrl && (
            <button
              onClick={() => window.open(publicUrl, '_blank')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10"
            >
              <ExternalLink className="w-3.5 h-3.5" /> ОТКРЫТЬ
            </button>
          )}
        </div>
        <div className="font-mono text-[11px] truncate" style={{ color: isPublic ? 'var(--color-primary)' : '#666' }}>
          {publicUrl || `после публикации: /opros/${publicSlug || '…'}`}
        </div>
      </div>

      <SurveyMetaFields
        name={name}
        description={description}
        imageUrl={imageUrl}
        isAnonymous={isAnonymous}
        thanksText={thanksText}
        thanksRedirectUrl={thanksRedirectUrl}
        onChange={(p) => {
          if (p.name !== undefined) setName(p.name);
          if (p.description !== undefined) setDescription(p.description);
          if (p.imageUrl !== undefined) setImageUrl(p.imageUrl);
          if (p.isAnonymous !== undefined) setIsAnonymous(p.isAnonymous);
          if (p.thanksText !== undefined) setThanksText(p.thanksText);
          if (p.thanksRedirectUrl !== undefined) setThanksRedirectUrl(p.thanksRedirectUrl);
          if (p.publicSlug !== undefined) setPublicSlug(p.publicSlug || '');
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
