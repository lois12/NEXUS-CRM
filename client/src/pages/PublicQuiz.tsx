import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import PrivacyFooter from '../components/common/PrivacyFooter';
import { showToast } from '../components/ui/NexusModal';

const api = {
  get: (slug: string) => fetch(`/api/quizzes/public/${slug}`).then((r) => r.json()),
  start: (slug: string, body: any) => fetch(`/api/quizzes/public/${slug}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()),
  submit: (slug: string, body: any) => fetch(`/api/quizzes/public/${slug}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()),
  results: (slug: string) => fetch(`/api/quizzes/public/${slug}/results`).then((r) => r.json()),
};

function deviceId(): string {
  const K = 'nexus_quiz_device_id';
  let v = localStorage.getItem(K);
  if (!v) {
    v = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(K, v);
  }
  return v;
}

function fmtLeft(ms: number) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d > 0 ? `${d}д ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function PublicQuiz() {
  const { slug = '' } = useParams();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'done'>('intro');
  const [participantId, setParticipantId] = useState('');
  const [form, setForm] = useState({ lastName: '', firstName: '', patronymic: '', phone: '', email: '' });
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { answerText?: string; selectedOptionIds?: string[] }>>({});
  const [result, setResult] = useState<any>(null);
  const [left, setLeft] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [step, setStep] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    api.get(`${slug}?deviceId=${encodeURIComponent(deviceId())}`).then((d) => {
      if (d.success) setQuiz(d.data);
      else setError(d.error || 'Квиз не найден');
    }).catch(() => setError('Ошибка сети')).finally(() => setLoading(false));
    api.results(slug).then((d) => { if (d.success) setResults(d.data || []); }).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (!quiz?.startsAt) return;
    const ms0 = new Date(quiz.startsAt).getTime() - Date.now();
    if (ms0 > 0 && quiz.phase === 'upcoming') {
      setLeft(ms0);
      const t = setInterval(() => {
        const ms = new Date(quiz!.startsAt).getTime() - Date.now();
        setLeft(ms);
        if (ms <= 0) {
          clearInterval(t);
          // open entry form immediately, then refresh state in background
          setQuiz((q: any) => (q ? { ...q, phase: 'open' } : q));
          api.get(slug).then((d) => { if (d.success) setQuiz(d.data); }).catch(() => {});
        }
      }, 1000);
      return () => clearInterval(t);
    }
    if (ms0 <= 0) {
      setQuiz((q: any) => (q && q.phase === 'upcoming' ? { ...q, phase: 'open' } : q));
    }
  }, [quiz?.startsAt, quiz?.phase, slug]);

  const start = async () => {
    if (!form.lastName || !form.firstName || !consent) return;
    const d = await api.start(slug, { ...form, consent: true, deviceId: deviceId() });
    if (d.success && d.data?.participantId) {
      setParticipantId(d.data.participantId);
      startRef.current = Date.now();
      setPhase('quiz');
    } else if (d.error && /уже приняли участие/i.test(d.error)) {
      setQuiz((q: any) => (q ? { ...q, alreadyParticipated: true } : q));
    } else {
      showToast(d.error || 'Не удалось начать', 'error');
    }
  };

  const submit = async () => {
    const d = await api.submit(slug, {
      participantId: participantId || undefined,
      deviceId: deviceId(),
      ...form,
      consent: true,
      answers: (quiz.questions || []).map((q: any) => ({
        questionId: q.id,
        answerText: answers[q.id]?.answerText || '',
        selectedOptionIds: answers[q.id]?.selectedOptionIds || [],
      })),
    });
    if (d.success) {
      setResult(d.data);
      setPhase('done');
      api.results(slug).then((r) => { if (r.success) setResults(r.data || []); });
    } else if (d.error && /уже приняли участие/i.test(d.error)) {
      setQuiz((q: any) => (q ? { ...q, alreadyParticipated: true } : q));
      setPhase('intro');
    } else {
      showToast(d.error || 'Ошибка отправки', 'error');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-mono text-gray-500">загрузка…</div>;
  if (error && !quiz) return <div className="min-h-screen flex items-center justify-center font-mono text-red-400">{error}</div>;

  const upcoming = quiz?.phase === 'upcoming';
  const finished = quiz?.phase === 'finished';

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {quiz?.imageUrl && (
          <div className="w-full rounded-2xl overflow-hidden mb-4 bg-white/5 flex items-center justify-center cursor-zoom-in"
            onClick={() => setZoom(quiz.imageUrl)}>
            <img src={quiz.imageUrl} alt="" className="w-full max-h-72 object-contain" />
          </div>
        )}
        <h1 className="font-mono text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{quiz?.title}</h1>
        {quiz?.organizer && <p className="text-xs font-mono text-gray-500 mt-1">ОРГАНИЗАТОР · {quiz.organizer}</p>}
        {quiz?.description && <p className="text-sm text-gray-300 mt-3">{quiz.description}</p>}

        {finished && (
          <div className="glass rounded-2xl p-5 mt-5">
            <p className="font-mono text-sm text-gray-200 mb-2">МЕРОПРИЯТИЕ ЗАВЕРШЕНО</p>
            {quiz.afterEndText && <p className="text-sm text-gray-300">{quiz.afterEndText}</p>}
            {!quiz?.alreadyParticipated && <ResultsTable results={results} />}
          </div>
        )}

        {!finished && quiz?.alreadyParticipated && (
          <div className="glass rounded-2xl p-8 mt-5 text-center">
            <div className="font-mono text-lg font-bold mb-2" style={{ color: 'var(--color-primary)' }}>
              ВЫ УЖЕ ПРИНЯЛИ УЧАСТИЕ В ЭТОМ МЕРОПРИЯТИИ
            </div>
            <p className="text-sm text-gray-400">Повторное прохождение недоступно.</p>
            {quiz.afterEndText && <p className="text-sm text-gray-400 mt-3">{quiz.afterEndText}</p>}
          </div>
        )}

        {!quiz?.alreadyParticipated && !finished && upcoming && (
          <div className="glass rounded-2xl p-6 mt-5 text-center">
            <p className="text-[10px] font-mono tracking-[0.25em] text-gray-500">ДО СТАРТА</p>
            <div className="font-mono text-4xl font-bold my-3" style={{ color: 'var(--color-primary)' }}>{fmtLeft(left)}</div>
            <p className="text-xs text-gray-400">{quiz.startsAt && new Date(quiz.startsAt).toLocaleString('ru-RU')}</p>
          </div>
        )}

        {!quiz?.alreadyParticipated && !upcoming && !finished && phase === 'intro' && (
          <div className="glass rounded-2xl p-5 mt-5">
            <h2 className="font-mono text-sm font-bold mb-3" style={{ color: 'var(--color-primary)' }}>АНКЕТА УЧАСТНИКА</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="ФАМИЛИЯ *" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
              <Field label="ИМЯ *" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
              <Field label="ОТЧЕСТВО" value={form.patronymic} onChange={(v) => setForm({ ...form, patronymic: v })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <Field label="ТЕЛЕФОН" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="EMAIL" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            </div>
            <label className="flex items-start gap-2 mt-4 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-[var(--color-primary)]" />
              <span className="text-[11px] text-gray-400 leading-relaxed">
                Согласен на обработку персональных данных по{' '}
                <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>политике</a> (152-ФЗ)
              </span>
            </label>
            <button
              onClick={start}
              disabled={!form.lastName || !form.firstName || !consent}
              className="btn-primary w-full mt-4 py-3 disabled:opacity-40"
            >
              НАЧАТЬ КВИЗ
            </button>
            <p className="text-[10px] text-gray-600 mt-2 text-center">Таймер пойдёт после нажатия</p>
          </div>
        )}

        {!quiz?.alreadyParticipated && phase === 'quiz' && quiz?.questions?.length > 0 && (
          <div className="mt-5 space-y-4">
            {(() => {
              const total = quiz.questions.length;
              const qi = Math.min(step, total - 1);
              const q = quiz.questions[qi];
              return (
                <>
                  <div className="glass rounded-xl px-4 py-2 font-mono text-xs text-gray-400 flex items-center justify-between">
                    <span>ВОПРОС {qi + 1} / {total}</span>
                    <span>{form.lastName} {form.firstName}</span>
                  </div>
                  <div className="glass rounded-2xl p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="font-mono text-[10px] text-gray-500 mt-1">{qi + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-200">{q.text}</p>
                        {q.comment && (
                          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{q.comment}</p>
                        )}
                        {q.imageUrl && (
                          <img src={q.imageUrl} alt="" className="mt-2 rounded-lg max-h-56 object-contain cursor-zoom-in"
                            onClick={() => setZoom(q.imageUrl)} />
                        )}
                        {q.videoUrl && (
                          <video src={q.videoUrl} controls className="mt-2 rounded-lg max-h-64 w-full" playsInline />
                        )}
                        {q.audioUrl && (
                          <audio src={q.audioUrl} controls className="mt-2 w-full" />
                        )}
                      </div>
                    </div>
                    {q.type === 'open' ? (
                      <textarea
                        value={answers[q.id]?.answerText || ''}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: { ...answers[q.id], answerText: e.target.value } })}
                        rows={3}
                        placeholder="Ваш ответ…"
                        className="w-full px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200"
                      />
                    ) : (
                      <div className="space-y-1.5">
                        {(q.options || []).map((o: any) => {
                          const sel = answers[q.id]?.selectedOptionIds || [];
                          const on = sel.includes(o.id);
                          return (
                            <button
                              key={o.id}
                              onClick={() => {
                                const next = on ? sel.filter((x) => x !== o.id) : [...sel, o.id];
                                setAnswers({ ...answers, [q.id]: { ...answers[q.id], selectedOptionIds: next } });
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all"
                              style={{
                                background: on ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.04)',
                                border: on ? '1px solid rgba(0,255,136,0.45)' : '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[11px] flex-shrink-0"
                                style={{ borderColor: on ? 'var(--color-primary)' : '#666', color: 'var(--color-primary)', background: on ? 'rgba(0,255,136,0.15)' : 'transparent' }}>
                                {on ? '✓' : ''}
                              </span>
                              <span className="flex-1 text-gray-200">{o.text}</span>
                              {o.imageUrl && (
                                <img src={o.imageUrl} alt="" className="w-12 h-12 rounded object-cover cursor-zoom-in"
                                  onClick={(e) => { e.stopPropagation(); setZoom(o.imageUrl); }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {qi > 0 && (
                      <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="btn-ghost flex-1">← НАЗАД</button>
                    )}
                    {qi < total - 1 ? (
                      <button onClick={() => setStep((s) => Math.min(total - 1, s + 1))} className="btn-primary flex-1">ДАЛЕЕ →</button>
                    ) : (
                      <button onClick={submit} className="btn-primary flex-1">ЗАВЕРШИТЬ</button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {!quiz?.alreadyParticipated && phase === 'done' && result && (
          <div className="glass rounded-2xl p-6 mt-5 text-center">
            <p className="font-mono text-[10px] tracking-[0.25em] text-gray-500">ЗАВЕРШЕНО</p>
            <div className="font-mono text-2xl font-bold my-3" style={{ color: 'var(--color-primary)' }}>
              {Math.floor((result.durationMs || 0) / 60000)} мин {Math.round(((result.durationMs || 0) % 60000) / 1000)} сек
            </div>
            <p className="text-sm text-gray-300">Вы ответили на все вопросы за это время.</p>
            {quiz.afterEndText && <p className="text-sm text-gray-400 mt-4">{quiz.afterEndText}</p>}
          </div>
        )}

        <PrivacyFooter compact />
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setZoom(null)}
        >
          <img
            src={zoom}
            alt=""
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-xl cursor-zoom-out"
            onClick={(e) => { e.stopPropagation(); setZoom(null); }}
          />
          <button
            onClick={() => setZoom(null)}
            className="absolute top-4 right-4 px-3 py-2 rounded-full bg-white/10 text-white text-xs font-mono"
          >✕</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-mono text-gray-500 tracking-wider">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200"
      />
    </div>
  );
}

function ResultsTable({ results, highlight }: { results: any[]; highlight?: string }) {
  if (!results?.length) return null;
  return (
    <div className="mt-5">
      <h3 className="font-mono text-[10px] tracking-[0.2em] text-gray-500 mb-2">РЕЙТИНГ</h3>
      <table className="w-full text-xs font-mono">
        <tbody>
          {results.slice(0, 15).map((r, i) => (
            <tr key={r.id} className="border-t border-white/5" style={r.id === highlight ? { background: 'rgba(0,255,136,0.08)' } : {}}>
              <td className="py-1.5 pr-2" style={{ color: i < 3 ? 'var(--color-primary)' : '#6b7280' }}>{i + 1}</td>
              <td className="py-1.5 text-gray-200 truncate">{r.lastName} {r.firstName}</td>
              <td className="py-1.5 text-right" style={{ color: '#7dffb2' }}>{r.score}/{r.totalPoints}</td>
              <td className="py-1.5 pl-2 text-right text-gray-500">{Math.round((r.durationMs || 0) / 1000)}с</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
