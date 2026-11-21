import { useEffect, useState, useRef, useCallback } from 'react';
import SmartImage from '../components/ui/SmartImage';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit3, Trash2, Copy, QrCode, Calendar, Play, FolderOpen,
  X, Save, Image as ImageIcon, Link2, ArrowLeft, ChevronDown, ChevronRight,
  Film, Music, BarChart3, ChevronsUp, ChevronsDown, Eye, Download,
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
  comment: '',
  points: 1,
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
});

const DRAFT_KEY = 'nexus_quiz_draft_v1';

type UploadKey = string;

function UploadSkeleton({ pct, label }: { pct: number; label?: string }) {
  return (
    <div
      className="w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
      title={label || 'Загрузка'}
    >
      <div
        className="w-5 h-5 rounded-full border-2 border-transparent animate-spin"
        style={{ borderTopColor: 'var(--color-primary)', borderRightColor: 'var(--color-primary)' }}
      />
      <span className="text-[8px] font-mono text-gray-400 mt-0.5">{pct}%</span>
    </div>
  );
}

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
  const [openStatus, setOpenStatus] = useState<string | null>(null);
  const [statusPos, setStatusPos] = useState<{ x: number; y: number } | null>(null);
  const [showPreviewQ, setShowPreviewQ] = useState(false);
  const [previewQ, setPreviewQ] = useState<any | null>(null);

  // клик мимо — закрываем выпадашку статуса
  useEffect(() => {
    if (!openStatus) return;
    const close = () => setOpenStatus(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openStatus]);

  /** textarea растёт по содержимому */
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState<Record<UploadKey, number>>({});
  const [qrFor, setQrFor] = useState<Quiz | null>(null);
  const [showQrFormats, setShowQrFormats] = useState(false);
  const [view, setView] = useState<'list' | 'results'>('list');
  const [resultsFor, setResultsFor] = useState<Quiz | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [qStats, setQStats] = useState<{ totalAnswered: number; stats: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();

  // ── черновик в localStorage, чтобы прогресс не слетал ──
  const saveDraft = useCallback((f: any, qs: QuizQuestion[], editingId: string | null) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: f, questions: qs, editingId, ts: Date.now() }));
    } catch { /* quota */ }
  }, []);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ }
  };

  const readDraft = (): { form: any; questions: QuizQuestion[]; editingId: string | null } | null => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d?.form || !Array.isArray(d?.questions)) return null;
      return d;
    } catch { return null; }
  };

  // автосейв пока форма открыта
  useEffect(() => {
    if (!showForm) return;
    const t = setTimeout(() => saveDraft(form, questions, editing?.id || null), 400);
    return () => clearTimeout(t);
  }, [form, questions, showForm, editing, saveDraft]);

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
    setStep(1);
    setErrors({});
    const draft = readDraft();
    if (draft && !draft.editingId) {
      setEditing(null);
      setForm(draft.form);
      setQuestions(draft.questions.length ? draft.questions : [emptyQ()]);
      setCollapsed({});
      setShowForm(true);
      showToast('Восстановлен черновик', 'info');
      return;
    }
    setEditing(null);
    setForm({ title: '', description: '', organizer: '', imageUrl: '', startsAt: '', endsAt: '', afterEndText: '', status: 'draft' });
    setQuestions([emptyQ()]);
    setCollapsed({});
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
        comment: (q as any).comment || '',
        correctText: (q as any).correctText || '',
        options: (q.options?.length ? q.options : [{ text: '', isCorrect: true }]).map((o) => ({ ...o, isCorrect: !!o.isCorrect })),
      })));
      setCollapsed({});
      setStep(1);
      setErrors({});
      setShowForm(true);
    } catch {
      showToast('Ошибка открытия', 'error');
    }
  };

  /** Закрыть форму ТОЛЬКО кнопками ОТМЕНА / СОХРАНИТЬ */
  const closeForm = () => {
    clearDraft();
    setShowForm(false);
    setEditing(null);
    setUploads({});
  };

  const cancelForm = () => {
    showConfirm('ВЫЙТИ БЕЗ СОХРАНЕНИЯ?', 'Черновик будет удалён', () => {
      closeForm();
    }, 'danger');
  };

  type FormErrors = Record<string, string>;

  /** Валидация шага 1 «Основное» */
  const validateStep1 = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.title.trim()) errs.title = 'Укажите название квиза';
    return errs;
  };

  /** Класс поля с ошибкой */
  const errCls = (key: string) => (errors[key] ? ' border-[var(--color-danger)]' : '');

  /** Подпись ошибки под полем */
  const ErrMsg = ({ k }: { k: string }) =>
    errors[k] ? <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--color-danger)' }}>{errors[k]}</p> : null;

  /** Шаг 1 -> Шаг 2 (с валидацией) */
  const goStep2 = () => {
    const errs = validateStep1();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast('Заполните обязательные поля', 'error');
      return;
    }
    setStep(2);
  };

  const save = async () => {
    const errs = validateStep1();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast('Заполните обязательные поля', 'error');
      setStep(1);
      return;
    }
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
      closeForm();
      load();
    } catch {
      showToast('Ошибка сохранения', 'error');
    }
  };

  const changeStatus = async (q: Quiz, status: QuizStatus) => {
    try {
      await quizzesApi.update(q.id, { status });
      setQuizzes((prev) => prev.map((x) => (x.id === q.id ? { ...x, status } : x)));
      showToast('Статус обновлён', 'success');
    } catch {
      showToast('Ошибка смены статуса', 'error');
    }
  };

  const runUpload = async (key: UploadKey, file: File, onDone: (url: string) => void) => {
    setUploads((u) => ({ ...u, [key]: 0 }));
    try {
      const res = await materialsApi.upload(file, 'quizzes', (pct) => {
        setUploads((u) => ({ ...u, [key]: pct }));
      });
      const url = res.data?.url || res.data?.thumbnailUrl;
      setUploads((u) => { const n = { ...u }; delete n[key]; return n; });
      if (url) onDone(url);
      else showToast('Сервер не вернул ссылку', 'error');
    } catch {
      setUploads((u) => { const n = { ...u }; delete n[key]; return n; });
      showToast('Ошибка загрузки', 'error');
    }
  };

  const uploadQuizImage = (file: File) =>
    runUpload('quiz', file, (url) => setForm((f) => ({ ...f, imageUrl: url })));

  const uploadQuestionImage = (qi: number, file: File) =>
    runUpload(`q${qi}`, file, (url) => {
      setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, imageUrl: url } : q)));
    });

  const uploadQuestionVideo = (qi: number, file: File) =>
    runUpload(`qv${qi}`, file, (url) => {
      setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, videoUrl: url } : q)));
    });

  const uploadQuestionAudio = (qi: number, file: File) =>
    runUpload(`qa${qi}`, file, (url) => {
      setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, audioUrl: url } : q)));
    });

  const uploadOptionImage = (qi: number, oi: number, file: File) =>
    runUpload(`o${qi}_${oi}`, file, (url) => {
      setQuestions((prev) =>
        prev.map((q, i) =>
          i === qi
            ? { ...q, options: (q.options || []).map((o, j) => (j === oi ? { ...o, imageUrl: url } : o)) }
            : q
        )
      );
    });

  const openResults = async (q: Quiz) => {
    setResultsFor(q);
    setView('results');
    setQStats(null);
    try {
      const res = await quizzesApi.getResults(q.id);
      if (res.success && res.data) setResults(res.data);
    } catch { setResults([]); }
    try {
      const st = await quizzesApi.getQuestionStats(q.id);
      if (st.success && st.data) setQStats(st.data);
    } catch { setQStats(null); }
  };

  const deleteParticipant = (participantId: string, name: string) => {
    if (!resultsFor) return;
    showConfirm('УДАЛИТЬ ПОЗИЦИЮ?', name, async () => {
      try {
        await quizzesApi.deleteResult(resultsFor.id, participantId);
        setResults((prev) => prev.filter((r) => r.id !== participantId));
        showToast('Позиция удалена', 'success');
        load();
      } catch {
        showToast('Ошибка удаления', 'error');
      }
    }, 'danger');
  };

  const copyLink = (q: Quiz) => {
    const url = `${window.location.origin}/quiz/${q.publicSlug || q.id}`;
    navigator.clipboard?.writeText(url).then(
      () => showToast('Ссылка скопирована', 'success'),
      () => showToast(url, 'info')
    );
  };

  /** Скачать QR в выбранном формате */
  const downloadQr = (format: 'svg' | 'png' | 'jpg') => {
    const svg = document.getElementById('quiz-qr-svg');
    if (!svg || !qrFor) return;
    const base = `qr-${qrFor.publicSlug || qrFor.id}`;
    if (format === 'svg') {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${base}.svg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d')!;
        // белый фон обязателен для JPG
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 0, 0, 512, 512);
        const a = document.createElement('a');
        a.href = c.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
        a.download = `${base}.${format}`;
        a.click();
      };
      img.src = url;
    }
    setShowQrFormats(false);
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
    return <div className="p-3 md:p-6"><p className="font-mono text-xs md:text-sm text-gray-500">Загрузка…</p></div>;
  }

  if (view === 'results' && resultsFor) {
    const avgScore = results.length
      ? Math.round(results.reduce((s, r) => s + (r.score || 0), 0) / results.length * 10) / 10
      : 0;
    const avgTime = results.length
      ? Math.round(results.reduce((s, r) => s + (r.durationMs || 0), 0) / results.length / 1000)
      : 0;

    return (
      <div className="space-y-3 md:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 md:gap-3">
          <div>
            <button
              onClick={() => { setView('list'); setResultsFor(null); }}
              className="flex items-center gap-2 font-mono text-xs md:text-sm text-gray-400 hover:text-gray-200 transition-colors mb-1 md:mb-2 nx-press"
            >
              <ArrowLeft className="w-4 h-4" /> Назад к квизам
            </button>
            <h1 className="text-lg md:text-2xl font-bold font-mono" style={{ color: 'var(--color-primary)' }}>
              ИТОГИ · {resultsFor.title}
            </h1>
            <p className="text-gray-400 mt-0.5 md:mt-1 font-mono text-[10px] md:text-xs">
              {resultsFor.organizer || '—'} · участников: {results.length}
            </p>
          </div>
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
            className="btn-primary nx-press px-3 md:px-4 py-2 rounded-xl font-mono text-[10px] md:text-xs flex-shrink-0"
          >PDF</button>
        </div>

        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
            <div className="nx-tile p-2.5 md:p-3 nx-rise nx-rise-1">
              <p className="text-[9px] font-mono text-gray-500 tracking-wider">УЧАСТНИКОВ</p>
              <p className="font-mono text-lg md:text-xl font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{results.length}</p>
            </div>
            <div className="nx-tile p-2.5 md:p-3 nx-rise nx-rise-2">
              <p className="text-[9px] font-mono text-gray-500 tracking-wider">СРЕДНИЙ БАЛЛ</p>
              <p className="font-mono text-lg md:text-xl font-bold mt-1" style={{ color: '#7dffb2' }}>{avgScore}</p>
            </div>
            <div className="nx-tile p-2.5 md:p-3 nx-rise nx-rise-3">
              <p className="text-[9px] font-mono text-gray-500 tracking-wider">СРЕДНЕЕ ВРЕМЯ</p>
              <p className="font-mono text-lg md:text-xl font-bold mt-1 text-gray-200">{avgTime}с</p>
            </div>
            <div className="nx-tile p-2.5 md:p-3 nx-rise nx-rise-4">
              <p className="text-[9px] font-mono text-gray-500 tracking-wider">ВЫПОЛНИЛИ</p>
              <p className="font-mono text-lg md:text-xl font-bold mt-1 text-gray-200">
                {results.filter((r) => r.finishedAt).length}/{results.length}
              </p>
            </div>
          </div>
        )}

        {results.length === 0 ? (
          <EmptyState
            title="Пока никто не прошёл"
            description="Результаты появятся здесь после прохождения квиза."
          />
        ) : (
          <div className="nx-panel overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="px-2 py-2 md:p-3">#</th>
                  <th className="px-2 py-2 md:p-3">УЧАСТНИК</th>
                  <th className="px-2 py-2 md:p-3">ТЕЛЕФОН</th>
                  <th className="px-2 py-2 md:p-3">EMAIL</th>
                  <th className="px-2 py-2 md:p-3">БАЛЛ</th>
                  <th className="px-2 py-2 md:p-3">НАЧАЛ</th>
                  <th className="px-2 py-2 md:p-3">ВРЕМЯ</th>
                  <th className="px-2 py-2 md:p-3"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-2 py-2 md:p-3" style={{ color: i < 3 ? 'var(--color-primary)' : '#8b9bbb' }}>{i + 1}</td>
                    <td className="px-2 py-2 md:p-3 text-gray-200 break-words whitespace-normal">
                      {r.lastName} {r.firstName} {r.patronymic || ''}
                    </td>
                    <td className="px-2 py-2 md:p-3 text-gray-400">{r.phone || '—'}</td>
                    <td className="px-2 py-2 md:p-3 text-gray-400">{r.email || '—'}</td>
                    <td className="px-2 py-2 md:p-3" style={{ color: '#7dffb2' }}>{r.score}/{r.totalPoints}</td>
                    <td className="px-2 py-2 md:p-3 text-gray-400">
                      {r.startedAt
                        ? new Date(r.startedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-2 py-2 md:p-3 text-gray-400">{Math.round((r.durationMs || 0) / 1000)}с</td>
                    <td className="px-2 py-2 md:p-3 text-right">
                      <button
                        onClick={() => deleteParticipant(r.id, `${r.lastName} ${r.firstName}`)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors nx-press"
                        title="Удалить позицию"
                        aria-label="Удалить позицию"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {qStats && qStats.stats.length > 0 && (
          <div className="nx-panel p-3 md:p-4">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                <h2 className="font-mono text-xs tracking-wider text-gray-300">СТАТИСТИКА ПО ВОПРОСАМ</h2>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                <span>ответов: <span className="text-gray-200">{qStats.totalAnswered}</span></span>
                <span>
                  ср% ={' '}
                  <span className="text-gray-200">
                    {Math.round((qStats.stats.reduce((a, x) => a + (x.pct || 0), 0) / qStats.stats.length) * 100)}%
                  </span>
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              {qStats.stats.map((s: any, i: number) => {
                const pct = s.pct == null ? 0 : Math.round(s.pct * 100);
                return (
                  <div key={s.questionId || i}>
                    <div className="flex items-center gap-2 text-[11px] font-mono mb-1">
                      <span className="text-gray-500 w-6">Q{i + 1}</span>
                      <span className="text-gray-300 line-clamp-2 min-w-0 flex-1">{s.text || '—'}</span>
                      <span className="text-gray-500 flex-shrink-0">
                        {s.correct}/{s.answered}
                      </span>
                      <span
                        className="w-12 text-right flex-shrink-0"
                        style={{ color: pct >= 60 ? '#7dffb2' : pct >= 30 ? '#eab308' : '#ff6b6b' }}
                      >
                        {s.pct == null ? '—' : `${pct}%`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 60 ? '#7dffb2' : pct >= 30 ? '#eab308' : '#ff6b6b',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
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

  return (
    <div className="space-y-3 md:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3">
        <div>
          <h1 className="text-lg md:text-3xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>КВИЗЫ</h1>
          <p className="text-gray-400 mt-0.5 md:mt-1 font-mono text-[10px] md:text-sm">// СОРЕВНОВАНИЯ · ВИКТОРИНЫ · ЧЕЛЛЕНДЖИ</p>
        </div>
        <button onClick={openCreate} className="btn-primary nx-press flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl font-mono text-[10px] md:text-xs flex-shrink-0">
          <Plus className="w-4 h-4" /> НОВЫЙ КВИЗ
        </button>
      </div>

      {/* folders */}
      <div className="flex flex-wrap items-center gap-1.5 pb-0.5 -mx-1 px-1">
        {([['all', `Все (${counts.all})`], ['draft', `Черновики (${counts.draft})`], ['scheduled', `Запланирован (${counts.scheduled})`], ['conducted', `Проведён (${counts.conducted})`]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFolder(k as any)}
            className={`flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-lg text-[10px] md:text-xs font-mono transition-all nx-press flex-shrink-0 ${
              folder === k ? 'glass-accent' : 'bg-white/5 text-gray-400 hover:text-gray-200'
            }`}
            style={folder === k ? { color: 'var(--color-primary)' } : {}}
          >
            <FolderOpen className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
        <div className="relative w-full basis-full mt-1.5 md:mt-0 md:w-auto md:basis-0 md:flex-1 md:min-w-[140px] flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск квиза…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-4">
          {filtered.map((q) => (
            <div key={q.id} className={`nx-tile p-3 md:p-4 relative ${openStatus === q.id ? 'z-30' : ''}`}>
<div className="flex items-start gap-2 md:gap-3">
                {q.imageUrl ? (
                  <SmartImage loading="lazy" src={q.imageUrl} alt="" className="w-10 h-10 md:w-14 md:h-14 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-border)' }}>
                    <span className="text-base md:text-lg">🧠</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-200 line-clamp-2 text-sm md:text-base min-w-0 break-words">{q.title}</h3>
                    {/* Статус — компактная выпадашка */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openStatus === q.id) { setOpenStatus(null); return; }
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setStatusPos({ x: Math.min(r.left, window.innerWidth - 170), y: r.bottom + 6 });
                        setOpenStatus(q.id);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full nx-press flex-shrink-0"
                      style={{
                        background: `${STATUS[q.status]?.color || '#6b7280'}26`,
                        color: STATUS[q.status]?.color || '#6b7280',
                        border: `1px solid ${STATUS[q.status]?.color || '#6b7280'}55`,
                        minHeight: 28,
                      }}
                      title="Сменить статус"
                      aria-label="Сменить статус"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[q.status]?.color }} />
                      <span className="font-mono text-[9px] whitespace-nowrap">{STATUS[q.status]?.label}</span>
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-gray-500 line-clamp-2 break-words">{q.organizer || '—'}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[9px] font-mono text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {q.startsAt ? new Date(q.startsAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2 md:mt-3 flex-wrap">
                <button onClick={() => openEdit(q)} title="Редактировать" aria-label="Редактировать" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                <button onClick={() => { setQrFor(q); }} title="QR-код" aria-label="QR-код" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0"><QrCode className="w-3.5 h-3.5 text-gray-400" /></button>
                <button onClick={() => copyLink(q)} title="Скопировать ссылку" aria-label="Скопировать ссылку" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0"><Link2 className="w-3.5 h-3.5 text-gray-400" /></button>
                <button onClick={() => openResults(q)} title="Итоги" aria-label="Итоги" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0"><Play className="w-3.5 h-3.5 text-gray-400" /></button>
                <button onClick={async () => {
                  // в списке нет вопросов — подгружаем квиз целиком
                  let full: any = q;
                  try {
                    const res = await quizzesApi.get(q.id);
                    if (res.success && res.data) full = res.data;
                  } catch { /* показываем хотя бы то, что есть */ }
                  setPreviewQ({
                    title: full.title, organizer: full.organizer, imageUrl: full.imageUrl,
                    description: full.description, startsAt: full.startsAt, endsAt: full.endsAt,
                    afterEndText: full.afterEndText, questions: full.questions || [],
                  });
                  setShowPreviewQ(true);
                }} title="Предпросмотр" aria-label="Предпросмотр" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0"><Eye className="w-3.5 h-3.5 text-gray-400" /></button>
                <button
                  onClick={async () => {
                    await quizzesApi.duplicate(q.id);
                    showToast('Копия создана', 'success');
                    load();
                  }}
                  title="Дублировать" aria-label="Дублировать"
                  className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0"
                ><Copy className="w-3.5 h-3.5 text-gray-400" /></button>
                <button onClick={() => del(q)} title="Удалить" aria-label="Удалить" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0" style={{ color: '#ff6b6b' }}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDITOR — закрывается ТОЛЬКО кнопками ОТМЕНА / СОХРАНИТЬ */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center p-3"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              className="nx-bezel w-full max-w-2xl my-6 flex flex-col max-h-[calc(100dvh-4.5rem)]"
            >
              <div className="nx-core p-3 sm:p-5 flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                <h2 className="font-mono text-base sm:text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                  {editing ? 'РЕДАКТИРОВАТЬ КВИЗ' : 'НОВЫЙ КВИЗ'}
                </h2>
                <span className="text-[10px] font-mono text-gray-500">черновик сохраняется</span>
              </div>

              {/* шаги мастера — кликабельны, можно переключаться в любой момент */}
              <div className="flex items-center gap-2 mb-3 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[40px] rounded-full text-[9px] sm:text-[10px] font-mono tracking-wider nx-press"
                  style={step === 1
                    ? { background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)', color: 'var(--color-primary)', border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#8b9bbb', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={step === 1
                      ? { background: 'var(--color-primary)', color: '#000' }
                      : { background: 'rgba(255,255,255,0.08)', color: '#8b9bbb' }}
                  >1</span>
                  ОСНОВНОЕ
                </button>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <button
                  type="button"
                  onClick={() => (step === 2 ? undefined : goStep2())}
                  className="flex items-center gap-1.5 px-3 min-h-[40px] rounded-full text-[10px] font-mono tracking-wider nx-press"
                  style={step === 2
                    ? { background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)', color: 'var(--color-primary)', border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#8b9bbb', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={step === 2
                      ? { background: 'var(--color-primary)', color: '#000' }
                      : { background: 'rgba(255,255,255,0.08)', color: '#8b9bbb' }}
                  >2</span>
                  ВОПРОСЫ
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
              {step === 1 && (
              <div className="space-y-2.5 sm:space-y-3">
                <div>
                  <label className="text-[10px] font-mono text-gray-500 tracking-wider">НАЗВАНИЕ *</label>
                  <textarea value={form.title} rows={1} ref={autoGrow}
                    onChange={(e) => { const v = e.target.value; setForm({ ...form, title: v }); autoGrow(e.target); if (errors.title) setErrors((p) => ({ ...p, title: '' })); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 resize-none overflow-hidden [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]${errCls('title')}`} />
                  <ErrMsg k="title" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-gray-500 tracking-wider">ОРГАНИЗАТОР</label>
                    <input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-gray-500 tracking-wider">СТАТУС / ПАПКА</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as QuizStatus })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 appearance-none [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]">
                      <option value="draft">Черновик</option>
                      <option value="scheduled">Запланирован</option>
                      <option value="conducted">Проведён</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-500 tracking-wider">ОПИСАНИЕ</label>
                  <textarea value={form.description} onChange={(e) => { const v = e.target.value; setForm({ ...form, description: v }); autoGrow(e.target); }}
                    rows={2} ref={autoGrow} className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 resize-none overflow-hidden [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-gray-500 tracking-wider">КАРТИНКА КВИЗА</label>
                  <div className="flex items-center gap-2 min-h-[48px]">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQuizImage(f); e.target.value = ''; }} />
                    <button onClick={() => fileRef.current?.click()} className="btn-ghost nx-press px-3 py-2 text-[10px]">
                      <ImageIcon className="w-3.5 h-3.5 inline mr-1" /> ЗАГРУЗИТЬ
                    </button>
                    {uploads['quiz'] !== undefined ? (
                      <UploadSkeleton pct={uploads['quiz']} />
                    ) : form.imageUrl ? (
                      <SmartImage loading="lazy" src={form.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-gray-500 tracking-wider">СТАРТ (обратный отсчёт)</label>
                    <input type="datetime-local" value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-gray-500 tracking-wider">ФИНИШ</label>
                    <input type="datetime-local" value={form.endsAt}
                      onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-500 tracking-wider">ТЕКСТ ПОСЛЕ ОКОНЧАНИЯ</label>
                  <textarea value={form.afterEndText} onChange={(e) => { const v = e.target.value; setForm({ ...form, afterEndText: v }); autoGrow(e.target); }}
                    rows={2} ref={autoGrow} placeholder="Благодарим за участие…"
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
                </div>
              </div>
              )}

              {/* QUESTIONS */}
              {step === 2 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-mono text-xs font-bold tracking-wider text-gray-400">ВОПРОСЫ ({questions.length})</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCollapsed(Object.fromEntries(questions.map((_, i) => [i, true])))}
                      className="btn-ghost nx-press p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"
                      title="Свернуть все" aria-label="Свернуть все"
                    ><ChevronsUp className="w-4 h-4" /></button>
                    <button
                      onClick={() => setCollapsed({})}
                      className="btn-ghost nx-press p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"
                      title="Развернуть все" aria-label="Развернуть все"
                    ><ChevronsDown className="w-4 h-4" /></button>
                    <button
                      onClick={() => setQuestions((p) => [...p, emptyQ()])}
                      className="btn-primary nx-press p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"
                      title="Добавить вопрос" aria-label="Добавить вопрос"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setPreviewQ({ title: form.title, organizer: form.organizer, imageUrl: form.imageUrl, description: form.description, startsAt: form.startsAt, endsAt: form.endsAt, afterEndText: form.afterEndText, questions }); setShowPreviewQ(true); }}
                      className="btn-ghost nx-press p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"
                      title="Предпросмотр квиза" aria-label="Предпросмотр"
                    ><Eye className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="space-y-3">
                  {questions.map((q, qi) => {
                    const isCollapsed = !!collapsed[qi];
                    return (
                      <div key={qi} className="rounded-xl overflow-hidden [box-shadow:var(--depth-contact),var(--depth-rim-top),var(--depth-rim-bottom)]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {/* header — свернуть / развернуть */}
                        <div
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-white/[0.03]"
                          onClick={() => setCollapsed((c) => ({ ...c, [qi]: !c[qi] }))}
                        >
                          {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                          <span className="font-mono text-[10px] text-gray-500">ВОПРОС {qi + 1}</span>
                          <span className="text-[11px] text-gray-300 line-clamp-2 min-w-0 flex-1">
                            {q.text || (isCollapsed ? '—' : '')}
                          </span>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* тип — кнопки, без «плывущего» select */}
                            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                              <button
                                type="button"
                                onClick={() => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, type: 'choice' } : x))}
                                className="px-2 py-1 text-[9px] font-mono nx-press"
                                style={q.type === 'choice'
                                  ? { background: 'var(--color-primary)', color: '#000' }
                                  : { background: 'transparent', color: '#8b9bbb' }}
                              >ЗАКРЫТЫЙ</button>
                              <button
                                type="button"
                                onClick={() => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, type: 'open' } : x))}
                                className="px-2 py-1 text-[9px] font-mono nx-press"
                                style={q.type === 'open'
                                  ? { background: 'var(--color-primary)', color: '#000' }
                                  : { background: 'transparent', color: '#8b9bbb' }}
                              >ОТКРЫТЫЙ</button>
                            </div>
                            <button onClick={() => setQuestions((p) => p.filter((_, i) => i !== qi))} className="p-1 text-red-400 nx-press">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="px-3 pb-3 min-w-0">
                            <textarea
                              value={q.text}
                              onChange={(e) => { const v = e.target.value; setQuestions((p) => p.map((x, i) => i === qi ? { ...x, text: v } : x)); autoGrow(e.target); }}
                              placeholder="Текст вопроса…"
                              rows={1}
                              ref={autoGrow}
                              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200 mb-2 resize-none overflow-hidden [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
                            />
                            {/* комментарий мелким шрифтом — сразу под вопросом */}
                            <textarea
                              value={q.comment || ''}
                              onChange={(e) => { const v = e.target.value; setQuestions((p) => p.map((x, i) => i === qi ? { ...x, comment: v } : x)); autoGrow(e.target); }}
                              placeholder="Комментарий к вопросу (мелким шрифтом под вопросом)"
                              rows={1}
                              ref={autoGrow}
                              className="w-full px-3 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-gray-400 mb-2 resize-none overflow-hidden [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
                            />
                            <div className="flex items-center gap-1.5 mb-2 min-h-[40px] flex-wrap">
                              <input
                                ref={(el) => { qFileRefs.current[`q${qi}`] = el; }}
                                type="file" accept="image/*" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQuestionImage(qi, f); e.target.value = ''; }}
                              />
                              <button onClick={() => qFileRefs.current[`q${qi}`]?.click()} className="btn-ghost nx-press p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg" title="Картинка вопроса">
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                              <input
                                ref={(el) => { qFileRefs.current[`qv${qi}`] = el; }}
                                type="file" accept="video/mp4,video/webm" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQuestionVideo(qi, f); e.target.value = ''; }}
                              />
                              <button onClick={() => qFileRefs.current[`qv${qi}`]?.click()} className="btn-ghost nx-press p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg" title="Видео к вопросу (MP4/WebM)">
                                <Film className="w-3.5 h-3.5" />
                              </button>
                              <input
                                ref={(el) => { qFileRefs.current[`qa${qi}`] = el; }}
                                type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQuestionAudio(qi, f); e.target.value = ''; }}
                              />
                              <button onClick={() => qFileRefs.current[`qa${qi}`]?.click()} className="btn-ghost nx-press p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg" title="Аудио к вопросу (MP3/WAV/OGG)">
                                <Music className="w-3.5 h-3.5" />
                              </button>
                              {uploads[`q${qi}`] !== undefined ? (
                                <UploadSkeleton pct={uploads[`q${qi}`]} />
                              ) : q.imageUrl ? (
                                <SmartImage loading="lazy" src={q.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
                              ) : null}
                              {uploads[`qv${qi}`] !== undefined && <UploadSkeleton pct={uploads[`qv${qi}`]} />}
                              {uploads[`qa${qi}`] !== undefined && <UploadSkeleton pct={uploads[`qa${qi}`]} />}
                              {(q.videoUrl || q.audioUrl) && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,255,136,0.12)', color: 'var(--color-primary)' }}>
                                  {q.videoUrl ? '🎬' : '🎵'} есть
                                </span>
                              )}
                              <span className="text-[10px] text-gray-500 ml-auto">Баллы:</span>
                              <input
                                type="number" min={1} value={q.points || 1}
                                onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, points: Number(e.target.value) || 1 } : x))}
                                className="w-16 px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
                              />
                            </div>

                            {q.type === 'open' && (
                              <div className="mb-2">
                                <label className="text-[10px] font-mono text-gray-500 tracking-wider">ПРАВИЛЬНЫЙ ОТВЕТ (можно несколько через |)</label>
                                <input
                                  value={(q as any).correctText || ''}
                                  onChange={(e) => setQuestions((p) => p.map((x, i) => (i === qi ? { ...x, correctText: e.target.value } : x)))}
                                  placeholder="например: 42 | сорок два"
                                  className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
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
                                      className="px-2 py-1.5 rounded-lg text-[9px] font-mono font-bold flex-shrink-0 min-w-[52px] nx-press"
                                      style={{
                                        background: o.isCorrect ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                                        color: o.isCorrect ? '#000' : '#9ca3af',
                                        border: o.isCorrect ? '1px solid transparent' : '1px solid rgba(255,255,255,0.12)',
                                      }}
                                      title="Переключить: правильный / нет"
                                    >
                                      {o.isCorrect ? '✓' : '○'}
                                    </button>
                                    <textarea
                                      value={o.text}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setQuestions((p) =>
                                          p.map((x, i) =>
                                            i === qi
                                              ? { ...x, options: (x.options || []).map((op, j) => j === oi ? { ...op, text: v } : op) }
                                              : x
                                          )
                                        );
                                        autoGrow(e.target);
                                      }}
                                      placeholder={`Вариант ${oi + 1}`}
                                      rows={1}
                                      ref={autoGrow}
                                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-gray-200 resize-none overflow-hidden [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
                                    />
                                    <input
                                      ref={(el) => { qFileRefs.current[`o${qi}_${oi}`] = el; }}
                                      type="file" accept="image/*" className="hidden"
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOptionImage(qi, oi, f); e.target.value = ''; }}
                                    />
                                    <button onClick={() => qFileRefs.current[`o${qi}_${oi}`]?.click()} className="p-1.5 text-gray-500 hover:text-gray-300 nx-press" title="Картинка варианта">
                                      <ImageIcon className="w-3.5 h-3.5" />
                                    </button>
                                    {uploads[`o${qi}_${oi}`] !== undefined ? (
                                      <UploadSkeleton pct={uploads[`o${qi}_${oi}`]} />
                                    ) : o.imageUrl ? (
                                      <SmartImage loading="lazy" src={o.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                                    ) : null}
                                    <button
                                      onClick={() =>
                                        setQuestions((p) =>
                                          p.map((x, i) =>
                                            i === qi ? { ...x, options: (x.options || []).filter((_, j) => j !== oi) } : x
                                          )
                                        )
                                      }
                                      className="p-1 text-red-400 nx-press"
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
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              </div>

              {/* кнопки всегда внизу модалки — не уезжают за экран на мобиле */}
              <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {step === 2 && (
                  <button onClick={() => setStep(1)} className="btn-ghost nx-press px-3 sm:px-5 py-2.5 min-h-[40px] flex-shrink-0">НАЗАД</button>
                )}
                <div className="flex-1 min-w-0" />
                <button onClick={cancelForm} className="btn-ghost nx-press px-3 sm:px-5 py-2.5 min-h-[40px] flex-shrink-0">ОТМЕНА</button>
                {step === 1 ? (
                  <button onClick={goStep2} className="btn-primary nx-press px-3 sm:px-5 py-2.5 min-h-[40px] flex-shrink-0">ДАЛЕЕ</button>
                ) : (
                  <button onClick={save} className="btn-primary nx-press px-3 sm:px-5 py-2.5 min-h-[40px] flex-shrink-0"><Save className="w-4 h-4 inline mr-1" />СОХРАНИТЬ</button>
                )}
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

            {/* Предпросмотр квиза */}
      {showPreviewQ && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center p-3 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowPreviewQ(false)}>
          <div className="nx-bezel w-full max-w-md my-6" onClick={(e) => e.stopPropagation()}>
            <div className="nx-core p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="nx-eyebrow">ПРЕДПРОСМОТР</span>
                <button onClick={() => setShowPreviewQ(false)} className="p-2 rounded-lg hover:bg-white/10 nx-press" aria-label="Закрыть">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                {previewQ?.imageUrl && (
                  <div className="rounded-xl overflow-hidden">
                    <img src={previewQ.imageUrl} alt="" className="w-full max-h-40 object-contain" />
                  </div>
                )}
                <h3 className="font-mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{previewQ?.title || 'Название квиза'}</h3>
                {previewQ?.organizer && <p className="text-[10px] font-mono text-gray-500">ОРГАНИЗАТОР · {previewQ.organizer}</p>}
                {previewQ?.description && <p className="text-xs text-gray-400 leading-relaxed">{previewQ.description}</p>}
                {(previewQ?.startsAt || previewQ?.endsAt) && (
                  <p className="text-[10px] font-mono text-gray-500">
                    {previewQ?.startsAt && <>СТАРТ {new Date(previewQ.startsAt).toLocaleString('ru-RU')}</>}
                    {previewQ?.startsAt && previewQ?.endsAt && ' · '}
                    {previewQ?.endsAt && <>ФИНИШ {new Date(previewQ.endsAt).toLocaleString('ru-RU')}</>}
                  </p>
                )}
                <div className="nx-divider" />
                {(previewQ?.questions || []).filter((q: any) => (q.text || '').trim()).map((q: any, qi: number) => (
                  <div key={qi} className="nx-tile p-3">
                    <p className="text-sm text-gray-200">{qi + 1}. {q.text}</p>
                    {q.comment && <p className="text-[11px] text-gray-500 mt-1">{q.comment}</p>}
                    {q.type === 'choice' ? (
                      <div className="mt-2 space-y-1.5">
                        {(q.options || []).filter((o: any) => (o.text || '').trim()).map((o: any, oi: number) => (
                          <div key={oi} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-300"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <span className="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                            <span className="min-w-0 break-words">{o.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 px-3 py-2 rounded-lg text-xs text-gray-500"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        Ваш ответ…
                      </div>
                    )}
                  </div>
                ))}
                {previewQ?.afterEndText && (
                  <p className="text-[10px] font-mono text-gray-500 text-center pt-2">{previewQ.afterEndText}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR модалка — как в опросах */}
      {qrFor && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setQrFor(null)}
        >
          <div className="nx-bezel" onClick={(e) => e.stopPropagation()}>
            <div className="nx-core p-6 text-center">
              <div className="flex items-center justify-between mb-3">
                <span className="nx-eyebrow">QR-КОД</span>
                <div className="flex items-center gap-1 relative">
                  <button
                    onClick={() => copyLink(qrFor)}
                    className="p-1 rounded-lg hover:bg-white/10 nx-press"
                    aria-label="Скопировать ссылку"
                    title="Скопировать ссылку"
                  >
                    <Copy className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  </button>
                  <button
                    onClick={() => setShowQrFormats(v => !v)}
                    className="p-1 rounded-lg hover:bg-white/10 nx-press"
                    aria-label="Скачать QR"
                    title="Скачать"
                  >
                    <Download className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  </button>
                  {showQrFormats && (
                    <div
                      className="absolute top-full right-0 mt-1 flex gap-1 p-1 rounded-xl z-10"
                      style={{ background: 'rgba(20,20,35,0.98)', border: '1px solid rgba(255,255,255,0.12)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(['svg', 'png', 'jpg'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => downloadQr(f)}
                          className="px-2 py-1 rounded-lg font-mono text-[9px] font-bold uppercase hover:bg-white/10 nx-press"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setQrFor(null)} className="p-1 rounded-lg hover:bg-white/10 nx-press" aria-label="Закрыть">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="inline-block p-3 bg-white rounded-xl">
                <QRCodeSVG value={`${window.location.origin}/quiz/${qrFor.publicSlug || qrFor.id}`} size={180} id="quiz-qr-svg" />
              </div>
              <p className="font-mono text-[10px] text-gray-500 mt-3 break-all max-w-[260px] mx-auto">
                {window.location.origin}/quiz/{qrFor.publicSlug || qrFor.id}
              </p>
              <button
                onClick={() => copyLink(qrFor)}
                className="mt-3 px-4 py-2 rounded-lg font-mono text-[10px] glass hover:bg-white/10 nx-press"
              >
                <Copy className="w-3.5 h-3.5 inline mr-1" />СКОПИРОВАТЬ ССЫЛКУ
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Статус — фиксированная выпадашка */}
      {openStatus && statusPos && (
        <div
          className="fixed rounded-xl overflow-hidden"
          style={{ left: statusPos.x, top: statusPos.y, zIndex: 300, minWidth: 150, background: 'rgba(20,20,35,0.98)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {(Object.keys(STATUS) as QuizStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const target = quizzes.find((x) => x.id === openStatus);
                setOpenStatus(null);
                if (target && target.status !== st) changeStatus(target, st);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left nx-press hover:bg-white/5"
              style={{ color: STATUS[st].color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[st].color }} />
              <span className="font-mono text-[10px]">{STATUS[st].label}</span>
            </button>
          ))}
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
