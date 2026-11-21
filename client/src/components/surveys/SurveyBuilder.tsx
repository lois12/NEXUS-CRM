import { useState } from 'react';
import { Plus, Save, Globe, EyeOff, Copy, ExternalLink, Eye, Clock } from 'lucide-react';
import SurveyMetaFields from './SurveyMetaFields';
import SurveyQuestionCard from './SurveyQuestionCard';
import SurveyPreviewModal from './SurveyPreviewModal';
import type { Survey, SurveyQuestion, SurveyStatus } from '../../services/surveyApi';
import { surveyApi } from '../../services/surveyApi';
import SurveyStatusSelect, { STATUS_META, toLocalInput } from './SurveyStatusSelect';
import { showToast } from '../ui/NexusModal';

interface Props {
  survey: Survey;
  onSaved: () => void;
  onBack: () => void;
}

const STEPS = [
  { n: 1, label: 'ДАННЫЕ' },
  { n: 2, label: 'ВРЕМЯ' },
  { n: 3, label: 'ВОПРОСЫ' },
] as const;

const FIELD = 'w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]';
const LABEL = 'text-[10px] font-mono text-gray-500 tracking-wider';

/** Block-builder wizard (modal): 1 данные → 2 время → 3 вопросы */
export default function SurveyBuilder({ survey, onSaved, onBack }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(survey.name);
  const [description, setDescription] = useState(survey.description || '');
  const [imageUrl, setImageUrl] = useState(survey.imageUrl || '');
  const [isAnonymous, setIsAnonymous] = useState(!!survey.isAnonymous);
  const [isPublic, setIsPublic] = useState(!!survey.isPublic);
  const [status, setStatus] = useState<SurveyStatus>(survey.status || (survey.isPublic ? 'published' : 'draft'));
  const [opensAt, setOpensAt] = useState<string | null>(survey.opensAt || null);
  const [closesAt, setClosesAt] = useState<string | null>(survey.closesAt || null);
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
  const [previewOpen, setPreviewOpen] = useState(false);

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

  const goStep = (n: 1 | 2 | 3) => {
    if (n > 1 && !name.trim()) {
      showToast('Укажите название', 'error');
      return;
    }
    setStep(n);
  };

  const togglePublish = async () => {
    try {
      await save(true);
      const next: SurveyStatus = status === 'published' ? 'draft' : 'published';
      const res = await surveyApi.setStatus(survey.id, next, opensAt || undefined);
      if (res?.success && res.data) {
        setStatus(res.data.status || next);
        setIsPublic(!!res.data.isPublic);
        setPublicSlug(res.data.publicSlug || publicSlug || '');
        setOpensAt(res.data.opensAt || null);
        showToast(next === 'published' ? 'Опрос опубликован' : 'Снят с публикации', 'success');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || e?.message || 'Ошибка публикации', 'error');
    }
  };

  const changeStatus = async (next: SurveyStatus, nextOpen?: string) => {
    try {
      await save(true);
      const res = await surveyApi.setStatus(survey.id, next, nextOpen ?? (opensAt || undefined));
      if (res?.success && res.data) {
        setStatus(res.data.status || next);
        setIsPublic(!!res.data.isPublic);
        setPublicSlug(res.data.publicSlug || publicSlug || '');
        setOpensAt(res.data.opensAt ?? null);
        showToast('Статус обновлён', 'success');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Ошибка статуса', 'error');
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
        opensAt,
        closesAt,
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
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div className="nx-bezel w-full max-w-2xl my-6 flex flex-col max-h-[calc(100dvh-4.5rem)]">
        <div className="nx-core p-3 sm:p-5 flex flex-col min-h-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="font-mono text-base sm:text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
              РЕДАКТИРОВАТЬ ОПРОС
            </h2>
            <button
              onClick={() => setPreviewOpen(true)}
              className="btn-ghost nx-press p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg"
              title="Предпросмотр"
              aria-label="Предпросмотр"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* шаги мастера — кликабельны */}
          <div className="flex items-center gap-2 mb-3 flex-wrap shrink-0">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1 min-w-fit">
                {i > 0 && <div className="flex-1 h-px min-w-3" style={{ background: 'rgba(255,255,255,0.1)' }} />}
                <button
                  type="button"
                  onClick={() => goStep(s.n)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[40px] rounded-full text-[9px] sm:text-[10px] font-mono tracking-wider nx-press"
                  style={step === s.n
                    ? { background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)', color: 'var(--color-primary)', border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#8b9bbb', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={step === s.n
                      ? { background: 'var(--color-primary)', color: '#000' }
                      : { background: 'rgba(255,255,255,0.08)', color: '#8b9bbb' }}
                  >{s.n}</span>
                  {s.label}
                </button>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
          {step === 1 && (
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
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>ВРЕМЯ СТАРТА</label>
                  <input
                    type="datetime-local"
                    value={opensAt ? toLocalInput(opensAt) : ''}
                    onChange={(e) => setOpensAt(e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>ВРЕМЯ ОКОНЧАНИЯ</label>
                  <input
                    type="datetime-local"
                    value={closesAt ? toLocalInput(closesAt) : ''}
                    onChange={(e) => setClosesAt(e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className={FIELD}
                  />
                </div>
              </div>
              <p className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> после времени окончания приём ответов закрывается автоматически
              </p>

              <div
                className="rounded-xl p-3 space-y-2 [box-shadow:var(--depth-contact),var(--depth-rim-top),var(--depth-rim-bottom)]"
                style={{
                  background: status === 'published' ? 'rgba(0,255,136,0.08)' : STATUS_META[status]?.bg || 'rgba(255,255,255,0.03)',
                  border: `1px solid ${status === 'published' ? 'rgba(0,255,136,0.25)' : (STATUS_META[status]?.color + '33') || 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="nx-eyebrow">
                  Статус и ссылка для пользователей
                </div>
                <div className="flex items-stretch gap-2 flex-wrap">
                  <div className="w-40 shrink-0">
                    <SurveyStatusSelect
                      value={status}
                      opensAt={opensAt}
                      hideOpensAt
                      onChange={changeStatus}
                    />
                  </div>
                  <div className="flex items-stretch flex-1 min-w-[180px]">
                    <span className="px-2.5 flex items-center rounded-l-lg font-mono text-[11px] text-gray-400 border border-r-0 border-white/10 bg-white/5">
                      /opros/
                    </span>
                    <input
                      value={publicSlug}
                      onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9а-яё_-]/g, '-'))}
                      placeholder="ocenka-meropriyatiya"
                      className="flex-1 min-w-0 px-2 py-2.5 rounded-r-lg font-mono text-sm bg-white/5 border border-white/10 text-white focus:outline-none [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
                    />
                  </div>
                  <button
                    onClick={() => save()}
                    disabled={saving}
                    className="btn-ghost nx-press px-3 py-2 min-h-[40px] rounded-lg font-mono text-[11px] font-bold disabled:opacity-50"
                    title="Сохранить адрес"
                  >
                    <Save className="w-3.5 h-3.5 inline mr-1" />АДРЕС
                  </button>
                  <button
                    onClick={copyLink}
                    disabled={!publicSlug}
                    className="btn-primary nx-press flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg font-mono text-[11px] font-bold disabled:opacity-40"
                  >
                    <Copy className="w-3.5 h-3.5" /> КОПИРОВАТЬ
                  </button>
                  {publicUrl && (
                    <button
                      onClick={() => window.open(publicUrl, '_blank')}
                      className="btn-ghost nx-press flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg font-mono text-[11px]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> ОТКРЫТЬ
                    </button>
                  )}
                  <button
                    onClick={togglePublish}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg font-mono text-[11px] font-bold disabled:opacity-50 nx-press"
                    style={isPublic
                      ? { background: 'rgba(234,179,8,0.2)', color: '#eab308', border: '1px solid rgba(234,179,8,0.4)' }
                      : { background: 'var(--color-primary)', color: '#000' }}
                    title={isPublic ? 'Снять с публикации' : 'Сохранить и опубликовать'}
                  >
                    {isPublic ? <><EyeOff className="w-3.5 h-3.5" /> СНЯТЬ</> : <><Globe className="w-3.5 h-3.5" /> ОПУБЛИКОВАТЬ</>}
                  </button>
                </div>
                <div className="font-mono text-[11px] truncate" style={{ color: status === 'published' ? 'var(--color-primary)' : '#666' }}>
                  {publicUrl || `/opros/${publicSlug || '…'}`}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-mono text-xs font-bold tracking-wider text-gray-400">ВОПРОСЫ ({questions.length})</h3>
                <button
                  onClick={() => setQuestions((prev) => [...prev, { type: 'choice', title: '', options: ['', ''], required: false }])}
                  className="btn-primary nx-press p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg"
                  title="Добавить вопрос"
                  aria-label="Добавить вопрос"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
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
                  <p className="text-[10px] font-mono text-gray-600 text-center py-4">добавьте первый вопрос</p>
                )}
              </div>
            </div>
          )}

          </div>

          {/* кнопки всегда внизу модалки — не уезжают за экран на мобиле */}
          <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} className="btn-ghost nx-press px-3 sm:px-5 py-2.5 min-h-[40px] flex-shrink-0">НАЗАД</button>
            )}
            <div className="flex-1 min-w-0" />
            <button onClick={onBack} className="btn-ghost nx-press px-3 sm:px-5 py-2.5 min-h-[40px] flex-shrink-0">ОТМЕНА</button>
            {step < 3 ? (
              <button onClick={() => goStep((step + 1) as 2 | 3)} className="btn-primary nx-press px-3 sm:px-5 py-2.5 min-h-[40px] flex-shrink-0">ДАЛЕЕ</button>
            ) : (
              <button onClick={() => save()} disabled={saving} className="btn-primary nx-press px-3 sm:px-5 py-2.5 min-h-[40px] flex-shrink-0">
                <Save className="w-4 h-4 inline mr-1" />{saving ? 'СОХРАНЕНИЕ…' : 'СОХРАНИТЬ'}
              </button>
            )}
          </div>
        </div>
      </div>

      <SurveyPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        survey={{
          ...survey,
          name,
          description,
          imageUrl,
          isAnonymous,
          thanksText,
          thanksRedirectUrl,
          publicSlug,
          questions,
        }}
      />
    </div>
  );
}
