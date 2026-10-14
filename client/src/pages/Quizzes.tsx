import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit3, Trash2, Copy, QrCode, Calendar, Play, FolderOpen,
  X, Save, Image as ImageIcon, Link2, Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { quizzesApi, materialsApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import EmptyState from '../components/ui/EmptyState';
import type { Quiz, QuizQuestion, QuizStatus } from '../types';

const STATUS: Record<QuizStatus, { label: string; color: string }> = {
  draft: { label: 'ЧЕРНОВИК', color: '#6b7280' },
  scheduled: { label: 'ЗАПЛАНИРОВАН', color: '#eab308' },
  conducted: { label: 'ПРОВЕДЁН', color: '#22c55e' },
};

const emptyQ = (): QuizQuestion => ({
  type: 'choice',
  text: '',
  points: 1,
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
});

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<'all' | QuizStatus>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', organizer: '', imageUrl: '',
    startsAt: '', endsAt: '', afterEndText: '', status: 'draft' as QuizStatus,
  });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [qrFor, setQrFor] = useState<Quiz | null>(null);
  const [resultsFor, setResultsFor] = useState<Quiz | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const qFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await quizzesApi.getAll();
      if (res.success && res.data) setQuizzes(res.data);
    } catch { /* */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = quizzes.filter((q) => {
    if (folder !== 'all' && q.status !== folder) return false;
    if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', organizer: '', imageUrl: '', startsAt: '', endsAt: '', afterEndText: '', status: 'draft' });
    setQuestions([emptyQ()]);
    setShowForm(true);
  };

  const openEdit = async (q: Quiz) => {
    try {
      const res = await quizzesApi.get(q.id);
      const d = res.data as Quiz;
      setEditing(d);
      setForm({
        title: d.title || '',
        description: d.description || '',
        organizer: d.organizer || '',
        imageUrl: d.imageUrl || '',
        startsAt: d.startsAt ? String(d.startsAt).slice(0, 16) : '',
        endsAt: d.endsAt ? String(d.endsAt).slice(0, 16) : '',
        afterEndText: d.afterEndText || '',
        status: d.status || 'draft',
      });
      setQuestions((d.questions || []).map((q) => ({
        ...q,
        correctText: (q as any).correctText || '',
        options: (q.options?.length ? q.options : [{ text: '', isCorrect: true }]).map((o) => ({ ...o, isCorrect: !!o.isCorrect })),
      })));
      setShowForm(true);
    } catch {
      showToast('Ошибка открытия', 'error');
    }
  };

  const save = async () => {
    if (!form.title.trim()) { showToast('Название обязательно', 'error'); return; }
    try {
      const payload = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };
      let id = editing?.id;
      if (editing) {
        const res = await quizzesApi.update(editing.id, payload);
        id = res.data?.id || editing.id;
      } else {
        const res = await quizzesApi.create(payload);
        id = res.data?.id;
      }
      if (id) {
        await quizzesApi.saveQuestions(id, questions.filter((q) => q.text.trim() || q.options?.some((o) => o.text.trim())));
      }
      showToast('Квиз сохранён', 'success');
      setShowForm(false);
      load();
    } catch {
      showToast('Ошибка сохранения', 'error');
    }
  };

  const uploadQuizImage = async (file: File) => {
    try {
      const res = await materialsApi.upload(file, 'quizzes');
      const url = res.data?.url || res.data?.thumbnailUrl;
      if (url) setForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      showToast('Ошибка загрузки', 'error');
    }
  };

  const uploadQuestionImage = async (qi: number, file: File) => {
    try {
      const res = await materialsApi.upload(file, 'quizzes');
      const url = res.data?.url;
      if (url) {
        setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, imageUrl: url } : q)));
      }
    } catch {
      showToast('Ошибка загрузки', 'error');
    }
  };

  const uploadOptionImage = async (qi: number, oi: number, file: File) => {
    try {
      const res = await materialsApi.upload(file, 'quizzes');
      const url = res.data?.url;
      if (url) {
        setQuestions((prev) =>
          prev.map((q, i) =>
            i === qi
              ? { ...q, options: (q.options || []).map((o, j) => (j === oi ? { ...o, imageUrl: url } : o)) }
              : q
          )
        );
      }
    } catch {
      showToast('Ошибка загрузки', 'error');
    }
  };

  const openResults = async (q: Quiz) => {
    setResultsFor(q);
    try {
      const res = await quizzesApi.getResults(q.id);
      if (res.success && res.data) setResults(res.data);
    } catch { setResults([]); }
  };

  const copyLink = (q: Quiz) => {
    const url = `${window.location.origin}/quiz/${q.publicSlug || q.id}`;
    navigator.clipboard?.writeText(url).then(
      () => showToast('Ссылка скопирована', 'success'),
      () => showToast(url, 'info')
    );
  };

  const del = (q: Quiz) => {
    showConfirm('УДАЛИТЬ КВИЗ?', q.title, async () => {
      await quizzesApi.delete(q.id);
      showToast('Удалён', 'success');
      load();
    }, 'danger');
  };

  const counts = {
    all: quizzes.length,
    draft: quizzes.filter((q) => q.status === 'draft').length,
    scheduled: quizzes.filter((q) => q.status === 'scheduled').length,
    conducted: quizzes.filter((q) => q.status === 'conducted').length,
  };

  if (loading) {
    return <div className="p-6"><p className="font-mono text-sm text-gray-500">Загрузка…</p></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>КВИЗЫ</h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// СОРЕВНОВАНИЯ · ВИКТОРИНЫ · ЧЕЛЛЕНДЖИ</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs">
          <Plus className="w-4 h-4" /> НОВЫЙ КВИЗ
        </button>
      </div>

      {/* folders */}
      <div className="flex flex-wrap items-center gap-2">
        {([['all', `Все (${counts.all})`], ['draft', `Черновики (${counts.draft})`], ['scheduled', `Запланирован (${counts.scheduled})`], ['conducted', `Проведён (${counts.conducted})`]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFolder(k as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
              folder === k ? 'glass-accent' : 'bg-white/5 text-gray-400 hover:text-gray-200'
            }`}
            style={folder === k ? { color: 'var(--color-primary)' } : {}}
          >
            <FolderOpen className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск квиза…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={search || folder !== 'all' ? 'Ничего не найдено' : 'Квизов пока нет'}
          description="Создайте первый квиз — вопросы, таймер, QR и рейтинг."
          actionLabel={!search && folder === 'all' ? 'СОЗДАТЬ КВИЗ' : undefined}
          onAction={!search && folder === 'all' ? openCreate : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((q) => (
            <div key={q.id} className="glass rounded-2xl p-4 hover:bg-white/5 transition-all">
              <div className="flex items-start gap-3">
                {q.imageUrl ? (
                  <img src={q.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-border)' }}>
                    <span className="text-lg">🧠</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-200 truncate">{q.title}</h3>
                  <p className="text-[10px] font-mono text-gray-500 truncate">{q.organizer || '—'}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: `${STATUS[q.status]?.color || '#6b7280'}20`, color: STATUS[q.status]?.color }}>
                      {STATUS[q.status]?.label || q.status}
                    </span>
                    <span className="text-[9px] font-mono text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {q.participantCount || 0}
                    </span>
                    {q.startsAt && (
                      <span className="text-[9px] font-mono text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(q.startsAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <button onClick={() => openEdit(q)} className="btn-ghost px-2.5 py-1.5 text-[10px]"><Edit3 className="w-3 h-3 inline mr-1" />ПРАВИТЬ</button>
                <button onClick={() => { setQrFor(q); }} className="btn-ghost px-2.5 py-1.5 text-[10px]"><QrCode className="w-3 h-3 inline mr-1" />QR</button>
                <button onClick={() => copyLink(q)} className="btn-ghost px-2.5 py-1.5 text-[10px]"><Link2 className="w-3 h-3 inline mr-1" />ССЫЛКА</button>
                <button onClick={() => openResults(q)} className="btn-ghost px-2.5 py-1.5 text-[10px]"><Play className="w-3 h-3 inline mr-1" />ИТОГИ</button>
                <button
                  onClick={async () => {
                    await quizzesApi.duplicate(q.id);
                    showToast('Копия создана', 'success');
                    load();
                  }}
                  className="btn-ghost px-2.5 py-1.5 text-[10px]"
                ><Copy className="w-3 h-3 inline mr-1" />КОПИЯ</button>
                <button onClick={() => del(q)} className="btn-ghost px-2.5 py-1.5 text-[10px]" style={{ color: '#ff6b6b' }}>
                  <Trash2 className="w-3 h-3 inline" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDITOR */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center p-3 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-frost rounded-2xl p-5 w-full max-w-2xl my-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                  {editing ? 'РЕДАКТИРОВАТЬ КВИЗ' : 'НОВЫЙ КВИЗ'}
                </h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono text-gray-500 tracking-wider">НАЗВАНИЕ *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-gray-500 tracking-wider">ОРГАНИЗАТОР</label>
                    <input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-gray-500 tracking-wider">СТАТУС / ПАПКА</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as QuizStatus })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200">
                      <option value="draft">Черновик</option>
                      <option value="scheduled">Запланирован</option>
                      <option value="conducted">Проведён</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-500 tracking-wider">ОПИСАНИЕ</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2} className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200" />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-gray-500 tracking-wider">КАРТИНКА КВИЗА</label>
                  <div className="flex items-center gap-2">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQuizImage(f); e.target.value = ''; }} />
                    <button onClick={() => fileRef.current?.click()} className="btn-ghost px-3 py-2 text-[10px]">
                      <ImageIcon className="w-3.5 h-3.5 inline mr-1" /> ЗАГРУЗИТЬ
                    </button>
                    {form.imageUrl && <img src={form.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-gray-500 tracking-wider">СТАРТ (обратный отсчёт)</label>
                    <input type="datetime-local" value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-gray-500 tracking-wider">ФИНИШ</label>
                    <input type="datetime-local" value={form.endsAt}
                      onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-500 tracking-wider">ТЕКСТ ПОСЛЕ ОКОНЧАНИЯ</label>
                  <textarea value={form.afterEndText} onChange={(e) => setForm({ ...form, afterEndText: e.target.value })}
                    rows={2} placeholder="Благодарим за участие…"
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200" />
                </div>
              </div>

              {/* QUESTIONS */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-mono text-xs font-bold tracking-wider text-gray-400">ВОПРОСЫ ({questions.length})</h3>
                  <button
                    onClick={() => setQuestions((p) => [...p, emptyQ()])}
                    className="btn-primary px-3 py-1.5 text-[10px]"
                  >
                    <Plus className="w-3 h-3 inline mr-1" /> ДОБАВИТЬ
                  </button>
                </div>

                <div className="space-y-3">
                  {questions.map((q, qi) => (
                    <div key={qi} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] text-gray-500">ВОПРОС {qi + 1}</span>
                        <div className="flex items-center gap-1">
                          <select
                            value={q.type}
                            onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, type: e.target.value as any } : x))}
                            className="px-2 py-1 rounded text-[10px] bg-white/5 border border-white/10 text-gray-300"
                          >
                            <option value="choice">Закрытый</option>
                            <option value="open">Открытый</option>
                          </select>
                          <button onClick={() => setQuestions((p) => p.filter((_, i) => i !== qi))} className="p-1 text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        value={q.text}
                        onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, text: e.target.value } : x))}
                        placeholder="Текст вопроса…"
                        className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200 mb-2"
                      />
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          ref={(el) => { qFileRefs.current[`q${qi}`] = el; }}
                          type="file" accept="image/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQuestionImage(qi, f); e.target.value = ''; }}
                        />
                        <button onClick={() => qFileRefs.current[`q${qi}`]?.click()} className="btn-ghost px-2 py-1 text-[10px]">
                          <ImageIcon className="w-3 h-3 inline mr-1" /> КАРТИНКА
                        </button>
                        {q.imageUrl && <img src={q.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                        <span className="text-[10px] text-gray-500 ml-auto">Баллы:</span>
                        <input
                          type="number" min={1} value={q.points || 1}
                          onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, points: Number(e.target.value) || 1 } : x))}
                          className="w-16 px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-gray-200"
                        />
                      </div>

                      {q.type === 'open' && (
                        <div className="mb-2">
                          <label className="text-[10px] font-mono text-gray-500 tracking-wider">ПРАВИЛЬНЫЙ ОТВЕТ (можно несколько через |)</label>
                          <input
                            value={(q as any).correctText || ''}
                            onChange={(e) => setQuestions((p) => p.map((x, i) => (i === qi ? { ...x, correctText: e.target.value } : x)))}
                            placeholder="например: 42 | сорок два"
                            className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200"
                          />
                        </div>
                      )}

                      {q.type === 'choice' && (
                        <div className="space-y-1.5">
                          {(q.options || []).map((o, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuestions((p) =>
                                    p.map((x, i) =>
                                      i === qi
                                        ? { ...x, options: (x.options || []).map((op, j) => j === oi ? { ...op, isCorrect: !op.isCorrect } : op) }
                                        : x
                                    )
                                  )
                                }
                                className="px-2 py-1.5 rounded-lg text-[9px] font-mono font-bold flex-shrink-0 min-w-[52px]"
                                style={{
                                  background: o.isCorrect ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                                  color: o.isCorrect ? '#000' : '#9ca3af',
                                  border: o.isCorrect ? '1px solid transparent' : '1px solid rgba(255,255,255,0.12)',
                                }}
                                title="Переключить: правильный / нет"
                              >
                                {o.isCorrect ? '✓ ВЕРНО' : 'ВЕРНО?'}
                              </button>
                              <input
                                value={o.text}
                                onChange={(e) =>
                                  setQuestions((p) =>
                                    p.map((x, i) =>
                                      i === qi
                                        ? { ...x, options: (x.options || []).map((op, j) => j === oi ? { ...op, text: e.target.value } : op) }
                                        : x
                                    )
                                  )
                                }
                                placeholder={`Вариант ${oi + 1}`}
                                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-gray-200"
                              />
                              <input
                                ref={(el) => { qFileRefs.current[`o${qi}_${oi}`] = el; }}
                                type="file" accept="image/*" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOptionImage(qi, oi, f); e.target.value = ''; }}
                              />
                              <button onClick={() => qFileRefs.current[`o${qi}_${oi}`]?.click()} className="p-1.5 text-gray-500 hover:text-gray-300" title="Картинка варианта">
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                              {o.imageUrl && <img src={o.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />}
                              <button
                                onClick={() =>
                                  setQuestions((p) =>
                                    p.map((x, i) =>
                                      i === qi ? { ...x, options: (x.options || []).filter((_, j) => j !== oi) } : x
                                    )
                                  )
                                }
                                className="p-1 text-red-400"
                              ><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                          <button
                            onClick={() =>
                              setQuestions((p) =>
                                p.map((x, i) =>
                                  i === qi ? { ...x, options: [...(x.options || []), { text: '', isCorrect: false }] } : x
                                )
                              )
                            }
                            className="text-[10px] font-mono text-gray-400 hover:text-gray-200"
                          >+ вариант</button>
                          <p className="text-[9px] text-gray-600">Кнопка «ВЕРНО» — правильный ответ (можно несколько)</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowForm(false)} className="btn-ghost">ОТМЕНА</button>
                <button onClick={save} className="btn-primary"><Save className="w-4 h-4 inline mr-1" />СОХРАНИТЬ</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR */}
      {qrFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)' }} onClick={() => setQrFor(null)}>
          <div className="glass-frost rounded-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-mono text-sm font-bold mb-3" style={{ color: 'var(--color-primary)' }}>QR КВИЗА</h3>
            <div className="bg-white p-4 rounded-xl inline-block">
              <QRCodeSVG value={`${window.location.origin}/quiz/${qrFor.publicSlug || qrFor.id}`} size={200} />
            </div>
            <p className="text-[10px] font-mono text-gray-500 mt-3 break-all px-4">
              {window.location.origin}/quiz/{qrFor.publicSlug || qrFor.id}
            </p>
            <button onClick={() => setQrFor(null)} className="btn-primary mt-4">ЗАКРЫТЬ</button>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {resultsFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)' }} onClick={() => setResultsFor(null)}>
          <div className="glass-frost rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                ИТОГИ · {resultsFor.title}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
                      const res = await fetch(`/api/quizzes/${resultsFor.id}/results/pdf`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const html = await res.text();
                      const w = window.open('', '_blank');
                      if (w) { w.document.write(html); w.document.close(); }
                    } catch {
                      showToast('Ошибка PDF', 'error');
                    }
                  }}
                  className="btn-ghost px-2.5 py-1.5 text-[10px]"
                >PDF</button>
                <button onClick={() => setResultsFor(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
            </div>
            {results.length === 0 ? (
              <p className="text-xs font-mono text-gray-500 text-center py-6">// ПОКА НИКТО НЕ ПРОШЁЛ</p>
            ) : (
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="pb-2">#</th>
                    <th className="pb-2">УЧАСТНИК</th>
                    <th className="pb-2">БАЛЛ</th>
                    <th className="pb-2">ВРЕМЯ</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="py-1.5" style={{ color: i < 3 ? 'var(--color-primary)' : '#8b9bbb' }}>{i + 1}</td>
                      <td className="py-1.5 text-gray-200 truncate">{r.lastName} {r.firstName}</td>
                      <td className="py-1.5" style={{ color: '#7dffb2' }}>{r.score}/{r.totalPoints}</td>
                      <td className="py-1.5 text-gray-400">{Math.round((r.durationMs || 0) / 1000)}с</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        onConfirm={() => { confirmState.onConfirm?.(); closeConfirm(); }}
        onCancel={closeConfirm}
      />
    </div>
  );
}
