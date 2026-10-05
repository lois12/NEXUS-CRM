import { useEffect, useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import SurveyConsent from './SurveyConsent';
import { publicSurveyApi, getSurveyDeviceId, type Survey, type SurveyQuestion } from '../../services/surveyApi';
import { showToast } from '../ui/NexusModal';

interface Props {
  survey: Survey & { questions: SurveyQuestion[] };
  slug: string;
}

const DEFAULT_THANKS = 'Спасибо что уделили время и проши опрос, Ваше мнение важно для нас';
const DEFAULT_THANKS_URL = 'https://visit-norilsk.ru';

/** Public survey fill form (one response per device) */
export default function SurveyFillForm({ survey, slug }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ privacy?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const isAnon = !!survey.isAnonymous;
  const thanksText = survey.thanksText || DEFAULT_THANKS;
  const thanksUrl = survey.thanksRedirectUrl || DEFAULT_THANKS_URL;

  // after submit: 5s then redirect
  useEffect(() => {
    if (!done) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          if (thanksUrl) window.location.href = thanksUrl;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [done, thanksUrl]);

  const setAns = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));

  const validate = () => {
    const err: { privacy?: string } = {};
    if (!isAnon) {
      if (!contactName.trim() || !contactPhone.trim() || !contactEmail.trim()) {
        showToast('Заполните ФИО, телефон и email', 'error');
        return false;
      }
      if (!consent) {
        err.privacy = 'Нужно согласие с политиками';
        setErrors(err);
        return false;
      }
    }
    for (const q of survey.questions || []) {
      if (q.required && !(answers[q.id!] || '').trim()) {
        showToast(`Ответьте: ${q.title}`, 'error');
        return false;
      }
    }
    setErrors({});
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await publicSurveyApi.submit(slug, {
        deviceId: getSurveyDeviceId(),
        contactName: isAnon ? '' : contactName.trim(),
        contactPhone: isAnon ? '' : contactPhone.trim(),
        contactEmail: isAnon ? '' : contactEmail.trim(),
        answers,
      });
      setDone(true);
    } catch (e: any) {
      showToast(e?.response?.data?.error || e?.message || 'Ошибка отправки', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="glass rounded-xl p-10 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
        <p className="font-mono text-sm text-gray-300 leading-relaxed mb-4">{thanksText}</p>
        <p className="font-mono text-[10px] text-gray-600">
          через {secondsLeft} сек. → {thanksUrl}
        </p>
        <button
          onClick={() => { if (thanksUrl) window.location.href = thanksUrl; }}
          className="mt-4 px-4 py-2 rounded-lg font-mono text-xs font-bold"
          style={{ background: 'var(--color-primary)', color: '#000' }}
        >
          ПЕРЕЙТИ СЕЙЧАС
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {survey.imageUrl && (
        <img src={survey.imageUrl} alt="" className="w-full max-h-48 object-cover rounded-xl border border-white/10" />
      )}
      <div className="glass rounded-xl p-4 space-y-1">
        <h1 className="font-mono text-xl font-bold text-white">{survey.name}</h1>
        {survey.description && (
          <p className="font-mono text-xs text-gray-400 leading-relaxed">{survey.description}</p>
        )}
        <p className="font-mono text-[9px] text-gray-600">
          {isAnon ? 'Анонимный опрос' : 'Опрос с указанием контактов'} · 1 ответ с устройства
        </p>
      </div>

      {!isAnon && (
        <div className="glass rounded-xl p-4 space-y-2">
          <label className="font-mono text-xs text-gray-500 block">КОНТАКТЫ</label>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="ФИО *"
            className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
          />
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Телефон *"
            className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
          />
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            type="email"
            placeholder="Email *"
            className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
          />
          <SurveyConsent checked={consent} onChange={setConsent} errors={errors} />
        </div>
      )}

      {(survey.questions || []).map((q, qi) => {
        const qid = q.id || `q${qi}`;
        return (
          <div key={qid} className="glass rounded-xl p-4 space-y-2">
            <p className="font-mono text-sm text-gray-200">
              {qi + 1}. {q.title}
              {q.required && <span className="text-red-400 ml-1">*</span>}
            </p>
            {q.type === 'choice' ? (
              <div className="space-y-1">
                {(q.options || []).map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-white/5">
                    <input
                      type="radio"
                      name={qid}
                      checked={answers[qid] === opt}
                      onChange={() => setAns(qid, opt)}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="font-mono text-xs text-gray-300">{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[qid] || ''}
                onChange={(e) => setAns(qid, e.target.value)}
                rows={3}
                className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none resize-none"
                placeholder="Ваш ответ"
              />
            )}
          </div>
        );
      })}

      <button
        onClick={submit}
        disabled={submitting || (!isAnon && !consent)}
        className="w-full py-3 rounded-xl font-mono text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        style={{ background: 'var(--color-primary)', color: '#000' }}
      >
        <Send className="w-4 h-4" />
        {submitting ? 'ОТПРАВКА…' : 'ОТПРАВИТЬ'}
      </button>
    </div>
  );
}
