import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Users, Play, XCircle, AlertTriangle, Navigation, Share2, Sparkles, Info } from 'lucide-react';
import { publicRegApi } from '../services/api';
import FieldRenderer from '../components/registrations/FieldRenderer';
import MapField from '../components/registrations/MapField';
import { CyberBackground } from '../components/ui/CyberBackground';
import PrivacyFooter from '../components/common/PrivacyFooter';
import { SkeletonForm, SkeletonBlock } from '../components/ui/Skeleton';
import { QRCodeSVG } from 'qrcode.react';
import { RegistrationField } from '../types';

type PageState = 'loading' | 'timer' | 'form' | 'success' | 'ended' | 'error';

interface TimeLeft { days: number; hours: number; minutes: number; seconds: number; }

function calcTimeLeft(target: string): TimeLeft | null {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

/** Countdown digit — floating tile chip */
function TimerBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="nx-tile w-16 h-16 sm:w-[72px] sm:h-[72px] flex items-center justify-center">
        <span className="font-mono text-2xl sm:text-3xl font-bold leading-none" style={{ color: 'var(--color-primary)' }}>
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

/** Key-fact highlight card (info band) */
function FactTile({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="nx-tile p-4">
      <div className="nx-eyebrow mb-2"><Icon className="w-3 h-3" />{label}</div>
      <p className="font-mono text-sm text-gray-200 leading-snug">{value}</p>
    </div>
  );
}

export default function PublicRegistration() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [reg, setReg] = useState<any>(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contactLastName, setContactLastName] = useState('');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactPatronymic, setContactPatronymic] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ status: string; position: number; cancelToken: string; checkinToken: string; confirmCode?: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [timerType, setTimerType] = useState<'before' | 'during' | null>(null);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Normalize data after fetch
  const safeParseArr = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.length > 0 && val[0] === '[') {
      try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
  };
  const safeParseObj = (val: any): Record<string, any> => {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) return val;
    if (typeof val === 'string' && val.length > 0 && val[0] === '{') {
      try { const p = JSON.parse(val); return (typeof p === 'object' && p !== null && !Array.isArray(p)) ? p : {}; } catch { return {}; }
    }
    return {};
  };

  const normalizeReg = (data: any): any => {
    if (!data) return data;
    const fields = safeParseArr(data.fields).map((f: any) => ({
      ...f,
      options: safeParseArr(f.options),
      settings: safeParseObj(f.settings),
    }));
    const media = safeParseArr(data.media);
    return { ...data, fields, media };
  };

  useEffect(() => {
    if (!slug) return;
    const fetchReg = async () => {
      try {
        const res = await publicRegApi.getBySlug(slug);
        if (res.success && res.data) {
          const data = normalizeReg(res.data);
          setReg(data);
          if ((res as any).draft) {
            setError('DRAFT');
            setState('error');
            return;
          }
          determineState(data);
        } else {
          setError(res.error || 'Регистрация не найдена');
          setState('error');
        }
      } catch (e: any) {
        const errData = e?.response?.data;
        if (errData?.code === 'DRAFT') {
          setError('DRAFT');
        } else {
          setError(errData?.error || 'Регистрация не найдена');
        }
        setState('error');
      }
    };
    fetchReg();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [slug]);

  const determineState = (data: any) => {
    const now = new Date();
    const start = data.registrationStart ? new Date(data.registrationStart) : null;
    const end = data.registrationEnd ? new Date(data.registrationEnd) : null;

    // Draft/archived — never show
    if (data.status === 'draft' || data.status === 'archived') {
      setState('ended');
      return;
    }

    // Closed — show ended with custom message
    if (data.status === 'closed') {
      setState('ended');
      return;
    }

    // Before start (status is active but start time is in the future)
    if (start && now < start) {
      setTimerType('before');
      setTimeLeft(calcTimeLeft(data.registrationStart));
      setState('timer');
      intervalRef.current = setInterval(() => {
        const tl = calcTimeLeft(data.registrationStart);
        if (!tl) {
          clearInterval(intervalRef.current);
          setState('form');
          setTimerType(null);
        } else {
          setTimeLeft(tl);
        }
      }, 1000);
      return;
    }

    // After end
    if (end && now > end) {
      setState('ended');
      return;
    }

    // Active — show form with countdown to end
    if (end) {
      setTimerType('during');
      setTimeLeft(calcTimeLeft(data.registrationEnd));
      intervalRef.current = setInterval(() => {
        const tl = calcTimeLeft(data.registrationEnd);
        if (!tl) {
          clearInterval(intervalRef.current);
          setState('ended');
          setTimerType(null);
        } else {
          setTimeLeft(tl);
        }
      }, 1000);
    }

    setState('form');
  };

  const handleSubmit = async () => {
    if (!reg || !slug) return;
    const errors: Record<string, string> = {};
    const fields: RegistrationField[] = reg?.fields || [];

    for (const field of fields) {
      if (field.required === 1 && !['heading', 'paragraph', 'divider', 'page_break', 'link_block', 'button_block'].includes(field.type)) {
        const val = answers[field.id];
        if (!val || (typeof val === 'string' && !val.trim())) {
          errors[field.id] = `Поле "${field.label}" обязательно`;
        }
      }
    }

    if (!contactLastName.trim()) errors['_lastName'] = 'Введите фамилию';
    if (!contactFirstName.trim()) errors['_firstName'] = 'Введите имя';
    if (!contactEmail.trim()) errors['_email'] = 'Введите email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errors['_email'] = 'Некорректный email';

    if (!privacyConsent) errors['_privacy'] = 'Необходимо согласие на обработку персональных данных';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await publicRegApi.submit(slug, { answers, contactLastName, contactFirstName, contactPatronymic, contactEmail, contactPhone });
      if (res.success && res.data) {
        setResult({ status: res.data.status, position: res.data.position, cancelToken: res.data.cancelToken, checkinToken: res.data.checkinToken, confirmCode: res.data.confirmCode });
        // Update local count
        setReg((prev: any) => prev ? {
          ...prev,
          confirmedCount: res.data.status === 'registered' ? (prev.confirmedCount || 0) + 1 : prev.confirmedCount,
          waitlistCount: res.data.status === 'waitlist' ? (prev.waitlistCount || 0) + 1 : prev.waitlistCount,
        } : prev);
        setState('success');
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || 'Ошибка отправки';
      setFieldErrors(prev => ({ ...prev, _submit: errMsg }));
    } finally { setSubmitting(false); }
  };

  const fields: RegistrationField[] = reg?.fields || [];
  const mediaItems: any[] = reg?.media || [];
  const allMedia: { type: string; url: string }[] = [
    ...(reg?.imageUrl ? [{ type: 'image', url: reg.imageUrl }] : []),
    ...(reg?.videoUrl ? [{ type: 'video', url: reg.videoUrl }] : []),
    ...mediaItems.map((m: any) => ({ type: m.type || 'image', url: m.url || '' })),
  ];

  // ── Loading ──
  if (state === 'loading') {
    return (
      <div className="min-h-screen py-8 px-4 relative nx-stage">
        <CyberBackground />
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <div className="nx-bezel nx-rise">
            <div className="nx-core p-4">
              <SkeletonBlock height="h-48" className="w-full rounded-2xl" />
            </div>
          </div>
          <div className="nx-panel p-6 space-y-3 nx-rise nx-rise-2">
            <SkeletonBlock height="h-7" className="w-2/3" />
            <SkeletonBlock height="h-3" className="w-1/2" />
            <SkeletonBlock height="h-3" className="w-3/4" />
          </div>
          <div className="nx-bezel nx-rise nx-rise-3">
            <div className="nx-core p-6">
              <SkeletonForm />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (state === 'error') {
    const isDraft = error === 'DRAFT';
    return (
      <div className="min-h-screen flex items-center justify-center p-4 nx-stage">
        <div className="nx-bezel max-w-md w-full nx-rise">
          <div className="nx-core p-8 text-center space-y-4">
            <span className="nx-eyebrow">{isDraft ? 'ЧЕРНОВИК' : 'ОШИБКА'}</span>
            {isDraft ? (
              <>
                <Clock className="w-16 h-16 mx-auto" style={{ color: 'var(--color-text-tertiary)' }} />
                <h2 className="font-mono text-lg font-bold text-gray-200">ЕЩЁ НЕ ОПУБЛИКОВАНО</h2>
                <p className="text-sm text-gray-400 leading-relaxed">Администратор ещё не опубликовал эту регистрацию. Попробуйте позже.</p>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 mx-auto text-red-400" />
                <h2 className="font-mono text-lg font-bold text-gray-200">ОШИБКА</h2>
                <p className="text-sm text-gray-400 leading-relaxed">{error}</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Timer (before start) ──
  if (state === 'timer' && timeLeft && timerType === 'before') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 nx-stage">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="nx-bezel max-w-md w-full nx-rise">
          <div className="nx-core p-8 text-center space-y-6">
            <span className="nx-eyebrow">СКОРО</span>
            <Clock className="w-16 h-16 mx-auto" style={{ color: 'var(--color-primary)' }} />
            <h2 className="font-mono text-xl font-bold neon-text" style={{ color: 'var(--color-primary)' }}>РЕГИСТРАЦИЯ СКОРО ОТКРОЕТСЯ</h2>
            {reg && <p className="text-sm text-gray-400">{reg.title}</p>}
            <div className="flex justify-center gap-3">
              <TimerBlock value={timeLeft.days} label="дней" />
              <TimerBlock value={timeLeft.hours} label="часов" />
              <TimerBlock value={timeLeft.minutes} label="минут" />
              <TimerBlock value={timeLeft.seconds} label="секунд" />
            </div>
            {reg?.registrationStart && (
              <p className="font-mono text-xs text-gray-500">Старт: {new Date(reg.registrationStart).toLocaleString('ru-RU')}</p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Ended ──
  if (state === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 nx-stage">
        <div className="nx-bezel max-w-md w-full nx-rise">
          <div className="nx-core p-8 text-center space-y-4">
            <span className="nx-eyebrow">ЗАВЕРШЕНО</span>
            <XCircle className="w-16 h-16 mx-auto text-gray-500" />
            <h2 className="font-mono text-lg font-bold text-gray-200">РЕГИСТРАЦИЯ ЗАКРЫТА</h2>
            {reg && <p className="text-sm text-gray-400">{reg.title}</p>}
            {reg?.closedMessage && (
              <div className="nx-tile px-4 py-3 text-left">
                <p className="text-sm text-gray-300 leading-relaxed">{reg.closedMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (state === 'success' && result) {
    const isRegistered = result.status === 'registered';
    const cancelUrl = `${window.location.origin}/reg/cancel/${result.cancelToken}`;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 nx-stage">
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          className="nx-bezel max-w-md w-full nx-rise">
          <div className="nx-core p-6 sm:p-8 space-y-5">
          <div className="text-center space-y-4">
            <span className="nx-eyebrow">{isRegistered ? 'РЕГИСТРАЦИЯ ПОДТВЕРЖДЕНА' : 'ОЧЕРЕДЬ ОЖИДАНИЯ'}</span>
          {isRegistered ? (
            <>
              {/* NEXUS hexagon logo */}
              <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-20 h-20 mx-auto flex items-center justify-center"
                style={{ background: 'rgba(0,255,136,0.08)', border: '2px solid rgba(0,255,136,0.3)', borderRadius: '16px', boxShadow: '0 0 30px rgba(0,255,136,0.2), inset 0 0 20px rgba(0,255,136,0.05)' }}>
                <svg viewBox="0 0 120 120" width="48" height="48">
                  <polygon points="60,8 108,32 108,88 60,112 12,88 12,32" fill="none" stroke="#00ff88" strokeWidth="3" opacity="0.6"/>
                  <polygon points="60,20 96,38 96,82 60,100 24,82 24,38" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.3"/>
                  <path d="M48,50 L56,70 L72,45 L60,65 L52,55 Z" fill="#00ff88" opacity="0.8"/>
                  <circle cx="60" cy="58" r="3" fill="#00ff88"/>
                </svg>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>ВЫ ЗАРЕГИСТРИРОВАНЫ</h2>
                <div className="w-16 h-[1px] mx-auto mt-2 mb-3" style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)', boxShadow: '0 0 8px var(--color-primary)' }} />
                <p className="font-mono text-sm text-gray-400">Ваш номер: <span className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>#{result.position || '—'}</span></p>
              </motion.div>
            </>
          ) : (
            <>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-20 h-20 mx-auto flex items-center justify-center rounded-2xl"
                style={{ background: 'rgba(234,179,8,0.08)', border: '2px solid rgba(234,179,8,0.3)', boxShadow: '0 0 30px rgba(234,179,8,0.15)' }}>
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </motion.div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>ВЫ В ОЧЕРЕДИ</h2>
              <p className="font-mono text-sm text-gray-400">Позиция: <span className="font-bold text-gray-200">#{result.position}</span></p>
            </>
          )}
          </div>

          {/* Next-step chips */}
          <div className="space-y-3">
          <div className="nx-tile p-4">
            <div className="nx-eyebrow mb-2">ОТМЕНА</div>
            <p className="font-mono text-[10px] text-gray-500 mb-2">Ссылка для отмены регистрации:</p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <code className="font-mono text-[10px] text-gray-400 flex-1 truncate">{cancelUrl}</code>
              <button onClick={() => {
                const ta = document.createElement('textarea'); ta.value = cancelUrl; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); alert('Скопировано');
              }} className="w-10 h-10 rounded-lg hover:bg-white/10 flex-shrink-0 flex items-center justify-center nx-press">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
          {/* Checkin QR code */}
          {result.checkinToken && (
            <div className="nx-tile p-4 text-center">
              <div className="nx-eyebrow mb-2">QR-КОД</div>
              <p className="font-mono text-[10px] text-gray-500 mb-3 text-center">Покажите этот QR-код организатору при входе:</p>
              <div className="inline-block p-3 bg-white rounded-xl mx-auto block" style={{ width: 'fit-content' }}>
                <QRCodeSVG value={`${window.location.origin}/reg/checkin/${result.checkinToken}`} size={160} />
              </div>
            </div>
          )}
          {/* 4-digit confirm code */}
          {result.confirmCode && (
            <div className="nx-tile p-4 text-center">
              <div className="nx-eyebrow mb-2">КОД</div>
              <p className="font-mono text-[10px] text-gray-500 mb-2">Или назовите этот код организатору:</p>
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-mono text-3xl font-bold tracking-[0.3em]" style={{ color: 'var(--color-accent)' }}>{result.confirmCode}</span>
              </div>
            </div>
          )}
          {/* Email notification */}
          <div className="nx-tile p-4 text-center">
            <div className="nx-eyebrow mb-2">ПОЧТА</div>
            <p className="font-mono text-[10px] text-gray-500">
              Подробная информация о регистрации направлена на вашу почту:
            </p>
            <p className="font-mono text-xs font-bold mt-1" style={{ color: 'var(--color-primary)' }}>
              {contactEmail}
            </p>
          </div>
          </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Form ──
  if (!reg) return null;

  const isFull = reg.maxParticipants > 0 && (reg.confirmedCount || 0) >= reg.maxParticipants;
  const isWaitlistFull = isFull && reg.waitlistEnabled && reg.maxWaitlist > 0 && (reg.waitlistCount || 0) >= reg.maxWaitlist;
  const isClosed = isFull && (!reg.waitlistEnabled || isWaitlistFull);
  const heroEyebrow = isClosed ? 'РЕГИСТРАЦИЯ ЗАКРЫТА' : isFull ? 'ОЧЕРЕДЬ ОЖИДАНИЯ' : 'РЕГИСТРАЦИЯ ОТКРЫТА';

  // Visual-only grouping of long forms (all fields stay rendered + validated as before)
  const layoutFieldTypes = ['heading', 'paragraph', 'divider', 'page_break', 'link_block', 'button_block'];
  const fieldGroups: RegistrationField[][] = (() => {
    const groups: RegistrationField[][] = [];
    let current: RegistrationField[] = [];
    let answerableInGroup = 0;
    const hasNaturalBreaks = fields.some(f => f.type === 'page_break');
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (f.type === 'page_break') {
        if (current.length > 0) { groups.push(current); current = []; answerableInGroup = 0; }
        current.push(f);
        continue;
      }
      current.push(f);
      if (!layoutFieldTypes.includes(f.type)) {
        answerableInGroup += 1;
        if (!hasNaturalBreaks && answerableInGroup >= 5 && i < fields.length - 1) {
          groups.push(current);
          current = [];
          answerableInGroup = 0;
        }
      }
    }
    if (current.length > 0) groups.push(current);
    return groups;
  })();

  return (
    <div className="min-h-screen py-8 px-4 relative nx-stage">
      {(reg.theme || reg.color) && (
        <style dangerouslySetInnerHTML={{ __html: (() => {
          const themes = [
            { id: 'cyberpunk', primary: '#00ff88', bg: '#0a0a0f', text: '#e8e8ec' },
            { id: 'synthwave', primary: '#ff00ff', bg: '#1a0a2e', text: '#f0e0ff' },
            { id: 'minimal', primary: '#111827', bg: '#ffffff', text: '#374151' },
            { id: 'corporate', primary: '#2563eb', bg: '#f0f4f8', text: '#1e293b' },
            { id: 'nature', primary: '#4ade80', bg: '#0f1f0f', text: '#dcfce7' },
            { id: 'sunset', primary: '#f97316', bg: '#1a0a0a', text: '#fed7aa' },
            { id: 'ocean', primary: '#06b6d4', bg: '#0a1628', text: '#cffafe' },
            { id: 'elegant', primary: '#d4a574', bg: '#0f0f0f', text: '#f5e6d3' },
          ];
          const t = themes.find(th => th.id === reg.theme);
          if (t) {
            return `:root { --color-primary: ${t.primary} !important; --color-bg: ${t.bg} !important; --color-text-primary: ${t.text} !important; --color-glow: ${t.primary}66 !important; }`;
          }
          if (reg.color) {
            return `:root { --color-primary: ${reg.color} !important; --color-glow: ${reg.color}66 !important; --color-accent: ${reg.color} !important; }`;
          }
          return '';
        })() }} />
      )}
      <CyberBackground />
      <div className="relative z-10 mx-auto w-full max-w-2xl space-y-6">

        {/* ── Media gallery ── */}
        {allMedia.length > 0 && (
          <div className="nx-bezel nx-rise">
            <div className="nx-core overflow-hidden">
              {/* Main display */}
              <div className="relative">
                {allMedia[activeMediaIdx]?.type === 'video' ? (
                  <video src={allMedia[activeMediaIdx].url} controls className="w-full max-h-[420px] object-cover" />
                ) : (
                  <img src={allMedia[activeMediaIdx]?.url} alt="" className="w-full h-64 sm:h-80 object-cover" />
                )}
                {allMedia.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
                    {allMedia.map((_, i) => (
                      <button key={i} onClick={() => setActiveMediaIdx(i)} aria-label={`${i + 1}`}
                        className="w-10 h-10 flex items-center justify-center rounded-full">
                        <span className={`w-2 h-2 rounded-full transition-transform ${i === activeMediaIdx ? 'scale-125' : 'opacity-50'}`}
                          style={{ background: i === activeMediaIdx ? 'var(--color-primary)' : '#fff' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Thumbnails */}
              {allMedia.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {allMedia.map((m, i) => (
                    <button key={i} onClick={() => setActiveMediaIdx(i)}
                      className={`flex-shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 transition-all nx-press ${i === activeMediaIdx ? 'border-[var(--color-primary)]' : 'border-white/10 opacity-60 hover:opacity-100'}`}>
                      {m.type === 'video' ? (
                        <div className="w-full h-full bg-black/50 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white" />
                        </div>
                      ) : (
                        <img src={m.url} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Hero band ── */}
        <div className="nx-bezel nx-rise nx-rise-1">
          <div className="nx-core p-6 sm:p-8 space-y-5">
            <div>
              <span className="nx-eyebrow"><Sparkles className="w-3 h-3" />{heroEyebrow}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-[1.12] tracking-tight neon-text" style={{ color: 'var(--color-primary)' }}>{reg.title}</h1>

            {/* Date / venue meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-400">
              {reg.eventDate && <span className="inline-flex items-center gap-2"><Calendar className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />{reg.eventDate}</span>}
              {reg.eventTime && <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />{reg.eventTime}</span>}
              {reg.location && <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />{reg.location}</span>}
            </div>

            {/* Countdown chips */}
            {reg.showTimer !== 0 && timeLeft && (timerType === 'during' || timerType === 'before') && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5" style={{ color: timerType === 'during' ? 'var(--color-primary)' : 'var(--color-accent)' }} />
                  <span className="font-mono text-[11px] font-bold tracking-wider" style={{ color: timerType === 'during' ? 'var(--color-primary)' : 'var(--color-accent)' }}>
                    {timerType === 'during' ? 'РЕГИСТРАЦИЯ ЗАКРОЕТСЯ ЧЕРЕЗ:' : 'РЕГИСТРАЦИЯ ОТКРОЕТСЯ ЧЕРЕЗ:'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <TimerBlock value={timeLeft.days} label="д" />
                  <TimerBlock value={timeLeft.hours} label="ч" />
                  <TimerBlock value={timeLeft.minutes} label="м" />
                  <TimerBlock value={timeLeft.seconds} label="с" />
                </div>
              </div>
            )}

            {/* Counter + share */}
            <div className="flex flex-wrap items-stretch gap-3">
              {reg.showLimit !== 0 && reg.maxParticipants > 0 && (
                <div className="nx-tile flex-1 min-w-[240px] px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 font-mono text-xs font-bold" style={{ color: 'var(--color-primary)' }}>
                      <Users className="w-4 h-4" />УЧАСТНИКИ
                    </span>
                    <span className="font-mono text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                      {reg.confirmedCount || 0}<span className="text-gray-500 text-sm"> / {reg.maxParticipants}</span>
                    </span>
                  </div>
                  <div className="mt-3 w-full h-2 rounded-full overflow-hidden bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((reg.confirmedCount || 0) / reg.maxParticipants) * 100, 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }}
                    />
                  </div>
                  {(reg.waitlistCount || 0) > 0 && (
                    <p className="font-mono text-[10px] mt-2" style={{ color: 'var(--color-warning)' }}>{reg.waitlistCount} в очереди ожидания</p>
                  )}
                </div>
              )}
              <button onClick={() => {
                const url = window.location.href;
                const title = reg.title || 'Регистрация';
                if (navigator.share) {
                  navigator.share({ title, url }).catch(() => {});
                } else {
                  const ta = document.createElement('textarea');
                  ta.value = url;
                  ta.style.cssText = 'position:fixed;left:-9999px';
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand('copy');
                  document.body.removeChild(ta);
                  alert('Ссылка скопирована');
                }
              }}
                className="nx-tile nx-press px-4 py-3 inline-flex items-center gap-2 font-mono text-[10px] tracking-wider self-start text-gray-500">
                <Share2 className="w-3.5 h-3.5" />
                ПОДЕЛИТЬСЯ
              </button>
            </div>
          </div>
        </div>

        <hr className="nx-divider" />

        {/* ── Info band ── */}
        {(reg.description || reg.eventDate || reg.eventTime || reg.location || (reg.showLimit !== 0 && reg.maxParticipants > 0)) && (
          <div className="nx-rise nx-rise-2 space-y-4">
            {reg.description && (
              <div className="nx-panel p-6 sm:p-8">
                <h2 className="nx-eyebrow mb-4"><Info className="w-3 h-3" />О МЕРОПРИЯТИИ</h2>
                <div
                  className="text-base leading-relaxed text-gray-300 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_a]:underline [&_a]:text-[var(--color-primary)]"
                  dangerouslySetInnerHTML={{ __html: reg.description }}
                />
              </div>
            )}
            {(reg.eventDate || reg.eventTime || reg.location || (reg.showLimit !== 0 && reg.maxParticipants > 0)) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {reg.eventDate && <FactTile icon={Calendar} label="ДАТА" value={reg.eventDate} />}
                {reg.eventTime && <FactTile icon={Clock} label="ВРЕМЯ" value={reg.eventTime} />}
                {reg.location && <FactTile icon={MapPin} label="МЕСТО" value={reg.location} />}
                {reg.showLimit !== 0 && reg.maxParticipants > 0 && (
                  <FactTile icon={Users} label="УЧАСТНИКИ" value={`${reg.confirmedCount || 0} / ${reg.maxParticipants}`} />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Map + Route buttons ── */}
        {reg.mapCoords && (() => {
          let coords: { lat: number; lng: number } | null = null;
          try { const c = JSON.parse(reg.mapCoords); coords = { lat: c.lat, lng: c.lng }; } catch {}
          if (!coords) return null;
          const yandexUrl = `https://yandex.ru/maps/?rtext=~${coords.lat},${coords.lng}&rtt=auto`;
          const dgisUrl = `https://2gis.ru/directions/tab/car/to/${coords.lng},${coords.lat}`;
          const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
          return (
            <div className="nx-panel overflow-hidden nx-rise nx-rise-3">
              <MapField value={reg.mapCoords} label={reg.location || 'Место проведения'} />
              <div className="p-4 flex flex-wrap gap-2">
                <a href={yandexUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold nx-press"
                  style={{ background: 'linear-gradient(135deg, #fc3f1d, #ff6b3d)', color: '#fff', boxShadow: '0 2px 8px rgba(252,63,29,0.3)' }}>
                  <Navigation className="w-3.5 h-3.5" /> ЯНДЕКС КАРТЫ
                </a>
                <a href={dgisUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold nx-press"
                  style={{ background: 'linear-gradient(135deg, #2db55d, #43d477)', color: '#fff', boxShadow: '0 2px 8px rgba(45,181,93,0.3)' }}>
                  <Navigation className="w-3.5 h-3.5" /> 2ГИС
                </a>
                <a href={googleUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold nx-press"
                  style={{ background: 'linear-gradient(135deg, #4285f4, #34a853)', color: '#fff', boxShadow: '0 2px 8px rgba(66,133,244,0.3)' }}>
                  <Navigation className="w-3.5 h-3.5" /> GOOGLE MAPS
                </a>
                <span className="flex items-center font-mono text-[10px] text-gray-500 ml-2">
                  {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </span>
              </div>
            </div>
          );
        })()}

        {/* ── Status banners ── */}
        {isClosed && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 nx-rise" style={{ background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />
            <span className="font-mono text-xs" style={{ color: 'var(--color-danger)' }}>Все места заняты. Регистрация закрыта.</span>
          </div>
        )}
        {isFull && !isClosed && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 nx-rise" style={{ background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-warning)' }} />
            <span className="font-mono text-xs" style={{ color: 'var(--color-warning)' }}>Все места заняты — вы будете в очереди ожидания</span>
          </div>
        )}

        {/* ── Form ── */}
        {!isClosed && (
        <>
        <hr className="nx-divider" />
        <div className="nx-bezel nx-rise nx-rise-4">
          <div className="nx-core p-5 sm:p-7">
          <h2 className="nx-eyebrow mb-5">ФОРМА РЕГИСТРАЦИИ</h2>

          {fieldGroups.map((group, gi) => (
            <div key={`group-${gi}`} className="space-y-4">
              {fieldGroups.length > 1 && group[0]?.type !== 'page_break' && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="nx-eyebrow">ШАГ {gi + 1} / {fieldGroups.length}</span>
                  <div className="flex-1 h-[1px] bg-white/10" />
                </div>
              )}
              {group.map((field, fi) => {
                // Check conditional visibility (showIf)
                const s = typeof field.settings === 'object' && field.settings !== null ? field.settings : (typeof field.settings === 'string' ? (() => { try { return JSON.parse(field.settings); } catch { return {}; } })() : {});
                if (s.showIf && s.showIf.fieldId) {
                  const depValue = answers[s.showIf.fieldId] || '';
                  const op = s.showIf.operator || 'equals';
                  const target = s.showIf.value || '';
                  let visible = false;
                  if (op === 'equals') visible = depValue === target;
                  else if (op === 'not_equals') visible = depValue !== target;
                  else if (op === 'contains') visible = depValue.includes(target);
                  else if (op === 'not_empty') visible = depValue.length > 0;
                  else if (op === 'empty') visible = depValue.length === 0;
                  if (!visible) return null;
                }
                const riseDelay = `${Math.min((gi * 5 + fi) * 45, 480)}ms`;
                if (layoutFieldTypes.includes(field.type)) {
                  return (
                    <div key={field.id} className="nx-rise" style={{ animationDelay: riseDelay }}>
                      <FieldRenderer field={field}
                        value={answers[field.id] || ''}
                        onChange={val => setAnswers(prev => ({ ...prev, [field.id]: val }))}
                        error={fieldErrors[field.id]} />
                    </div>
                  );
                }
                return (
                  <div key={field.id} className="nx-tile p-5 nx-rise" style={{ animationDelay: riseDelay }}>
                    <div className="mb-3">
                      <span className="nx-eyebrow">{field.required === 1 ? 'ОБЯЗАТЕЛЬНО' : 'ПО ЖЕЛАНИЮ'}</span>
                    </div>
                    <FieldRenderer field={field}
                      value={answers[field.id] || ''}
                      onChange={val => setAnswers(prev => ({ ...prev, [field.id]: val }))}
                      error={fieldErrors[field.id]} />
                  </div>
                );
              })}
            </div>
          ))}

          {/* Contact block */}
          <div className="mt-6 nx-tile p-5">
            <h3 className="nx-eyebrow mb-4">КОНТАКТНЫЕ ДАННЫЕ</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <input value={contactLastName} onChange={e => setContactLastName(e.target.value)} placeholder="// ФАМИЛИЯ *"
                  className={`w-full px-4 py-3.5 rounded-xl font-mono text-sm bg-black/30 border text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)] ${fieldErrors['_lastName'] ? 'border-red-500' : 'border-gray-700'}`} />
                {fieldErrors['_lastName'] && <p className="text-xs font-mono text-red-400 mt-1">{fieldErrors['_lastName']}</p>}
              </div>
              <div>
                <input value={contactFirstName} onChange={e => setContactFirstName(e.target.value)} placeholder="// ИМЯ *"
                  className={`w-full px-4 py-3.5 rounded-xl font-mono text-sm bg-black/30 border text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)] ${fieldErrors['_firstName'] ? 'border-red-500' : 'border-gray-700'}`} />
                {fieldErrors['_firstName'] && <p className="text-xs font-mono text-red-400 mt-1">{fieldErrors['_firstName']}</p>}
              </div>
              <div>
                <input value={contactPatronymic} onChange={e => setContactPatronymic(e.target.value)} placeholder="// ОТЧЕСТВО"
                  className="w-full px-4 py-3.5 rounded-xl font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
              </div>
            </div>
            <div className="mt-4">
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="// EMAIL *"
                className={`w-full px-4 py-3.5 rounded-xl font-mono text-sm bg-black/30 border text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)] ${fieldErrors['_email'] ? 'border-red-500' : 'border-gray-700'}`} />
              {fieldErrors['_email'] && <p className="text-xs font-mono text-red-400 mt-1">{fieldErrors['_email']}</p>}
            </div>
            <div className="mt-4">
              <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="// ТЕЛЕФОН"
                className="w-full px-4 py-3.5 rounded-xl font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />
            </div>
          </div>

          {/* Sticky CTA bar — consent + submit */}
          <div className="sticky z-40 mt-6 rounded-2xl glass-frost px-4 pt-4 pb-4 space-y-3"
            style={{ bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Privacy consent */}
          <label className="flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:bg-white/[0.02] min-h-[44px]"
            style={{ border: fieldErrors['_privacy'] ? '1px solid rgba(255,59,48,0.4)' : privacyConsent ? '1px solid rgba(0,255,136,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
            <div onClick={() => setPrivacyConsent(!privacyConsent)}
              className="flex items-center justify-center flex-shrink-0 w-11 h-11 -mt-2 -ml-2 cursor-pointer">
              <div className="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all"
                style={{ borderColor: privacyConsent ? 'var(--color-primary)' : 'var(--color-text-tertiary)', background: privacyConsent ? 'var(--color-primary)' : 'transparent' }}>
                {privacyConsent && <span className="text-black text-xs font-bold">✓</span>}
              </div>
            </div>
            <span className="font-mono text-xs text-gray-400 leading-relaxed">
              Я ознакомлен с{' '}
              <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer"
                className="underline transition-colors" style={{ color: 'var(--color-primary)' }}>
                политикой конфиденциальности
              </a>
              {' '}и даю согласие на обработку персональных данных в соответствии с Федеральным законом №152-ФЗ «О персональных данных».
            </span>
          </label>
          {fieldErrors['_privacy'] && <p className="text-xs font-mono text-red-400 -mt-1">{fieldErrors['_privacy']}</p>}

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50 nx-press"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#000', boxShadow: '0 0 24px var(--color-glow)' }}>
            {submitting ? 'ОТПРАВКА...' : 'ЗАРЕГИСТРИРОВАТЬСЯ'}
          </button>
          {fieldErrors['_submit'] && (
            <div className="rounded-xl px-4 py-2.5" style={{ background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
              <p className="font-mono text-xs text-red-400">{fieldErrors['_submit']}</p>
            </div>
          )}
          </div>
          </div>
        </div>
        </>
        )}

        <p className="text-center font-mono text-[10px] text-gray-600">Powered by NEXUS CRM</p>
        <PrivacyFooter compact />
      </div>
    </div>
  );
}
