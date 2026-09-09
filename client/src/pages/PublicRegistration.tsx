import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Users, Play, XCircle, AlertTriangle, Navigation } from 'lucide-react';
import { publicRegApi } from '../services/api';
import FieldRenderer from '../components/registrations/FieldRenderer';
import MapField from '../components/registrations/MapField';
import { CyberBackground } from '../components/ui/CyberBackground';
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

function TimerBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-xl flex items-center justify-center font-mono text-2xl font-bold"
        style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--color-primary)', textShadow: '0 0 12px var(--color-glow)' }}>
        {String(value).padStart(2, '0')}
      </div>
      <span className="font-mono text-[10px] text-gray-500 mt-1 uppercase">{label}</span>
    </div>
  );
}

export default function PublicRegistration() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [reg, setReg] = useState<any>(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ status: string; position: number; cancelToken: string; checkinToken: string } | null>(null);
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
      if (field.required === 1 && !['heading', 'paragraph'].includes(field.type)) {
        const val = answers[field.id];
        if (!val || (typeof val === 'string' && !val.trim())) {
          errors[field.id] = `Поле "${field.label}" обязательно`;
        }
      }
    }

    if (!contactName.trim()) errors['_name'] = 'Введите имя';
    if (!contactEmail.trim()) errors['_email'] = 'Введите email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errors['_email'] = 'Некорректный email';

    if (!privacyConsent) errors['_privacy'] = 'Необходимо согласие на обработку персональных данных';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await publicRegApi.submit(slug, { answers, contactName, contactEmail, contactPhone });
      if (res.success && res.data) {
        setResult({ status: res.data.status, position: res.data.position, cancelToken: res.data.cancelToken, checkinToken: res.data.checkinToken });
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
      <div className="min-h-screen py-8 px-4 relative" style={{ background: 'var(--color-bg)' }}>
        <CyberBackground />
        <div className="relative z-10 max-w-xl mx-auto space-y-6">
          <SkeletonBlock height="h-48" className="w-full rounded-2xl" />
          <div className="glass rounded-2xl p-6 space-y-3">
            <SkeletonBlock height="h-7" className="w-2/3" />
            <SkeletonBlock height="h-3" className="w-1/2" />
            <SkeletonBlock height="h-3" className="w-3/4" />
          </div>
          <div className="glass rounded-2xl p-6">
            <SkeletonForm />
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (state === 'error') {
    const isDraft = error === 'DRAFT';
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          {isDraft ? (
            <>
              <Clock className="w-16 h-16 mx-auto mb-4" style={{ color: '#6b7280' }} />
              <h2 className="font-mono text-lg font-bold text-gray-200 mb-2">ЕЩЁ НЕ ОПУБЛИКОВАНО</h2>
              <p className="font-mono text-sm text-gray-400">Администратор ещё не опубликовал эту регистрацию. Попробуйте позже.</p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
              <h2 className="font-mono text-lg font-bold text-gray-200 mb-2">ОШИБКА</h2>
              <p className="font-mono text-sm text-gray-400">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Timer (before start) ──
  if (state === 'timer' && timeLeft && timerType === 'before') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 text-center max-w-md w-full space-y-6">
          <Clock className="w-16 h-16 mx-auto" style={{ color: 'var(--color-primary)' }} />
          <h2 className="font-mono text-xl font-bold neon-text" style={{ color: 'var(--color-primary)' }}>РЕГИСТРАЦИЯ СКОРО ОТКРОЕТСЯ</h2>
          {reg && <p className="font-mono text-sm text-gray-400">{reg.title}</p>}
          <div className="flex justify-center gap-3">
            <TimerBlock value={timeLeft.days} label="дней" />
            <TimerBlock value={timeLeft.hours} label="часов" />
            <TimerBlock value={timeLeft.minutes} label="минут" />
            <TimerBlock value={timeLeft.seconds} label="секунд" />
          </div>
          {reg?.registrationStart && (
            <p className="font-mono text-xs text-gray-500">Старт: {new Date(reg.registrationStart).toLocaleString('ru-RU')}</p>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Ended ──
  if (state === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h2 className="font-mono text-lg font-bold text-gray-200 mb-2">РЕГИСТРАЦИЯ ЗАКРЫТА</h2>
          {reg && <p className="font-mono text-sm text-gray-400 mb-2">{reg.title}</p>}
          {reg?.closedMessage && (
            <p className="font-mono text-sm text-gray-300 mt-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {reg.closedMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Success ──
  if (state === 'success' && result) {
    const isRegistered = result.status === 'registered';
    const cancelUrl = `${window.location.origin}/reg/cancel/${result.cancelToken}`;

    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          className="rounded-2xl p-8 text-center max-w-md w-full space-y-5"
          style={{ background: 'linear-gradient(135deg, rgba(15,15,25,0.95), rgba(10,10,20,0.98))', border: '1px solid rgba(0,255,136,0.15)', boxShadow: '0 0 40px rgba(0,255,136,0.08), 0 16px 48px rgba(0,0,0,0.4)' }}>
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
                <h2 className="font-mono text-xl font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 20px rgba(0,255,136,0.4)' }}>ВЫ ЗАРЕГИСТРИРОВАНЫ</h2>
                <div className="w-16 h-[1px] mx-auto mt-2 mb-3" style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)', boxShadow: '0 0 8px var(--color-primary)' }} />
                <p className="font-mono text-sm text-gray-400">Ваш номер: <span className="font-bold text-lg" style={{ color: 'var(--color-primary)', textShadow: '0 0 10px var(--color-glow)' }}>#{result.position || '—'}</span></p>
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
              <h2 className="font-mono text-xl font-bold" style={{ color: '#eab308', textShadow: '0 0 20px rgba(234,179,8,0.3)' }}>ВЫ В ОЧЕРЕДИ</h2>
              <p className="font-mono text-sm text-gray-400">Позиция: <span className="font-bold text-gray-200">#{result.position}</span></p>
            </>
          )}
          <div className="pt-4 border-t" style={{ borderColor: 'rgba(0,255,136,0.08)' }}>
            <p className="font-mono text-[10px] text-gray-500 mb-2">Ссылка для отмены регистрации:</p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <code className="font-mono text-[10px] text-gray-400 flex-1 truncate">{cancelUrl}</code>
              <button onClick={() => {
                const ta = document.createElement('textarea'); ta.value = cancelUrl; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); alert('Скопировано');
              }} className="p-1 rounded hover:bg-white/10 flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
          {/* Checkin QR code */}
          {result.checkinToken && (
            <div className="pt-3 border-t" style={{ borderColor: 'rgba(0,255,136,0.08)' }}>
              <p className="font-mono text-[10px] text-gray-500 mb-3 text-center">Покажите этот QR-код контролёру при входе:</p>
              <div className="inline-block p-3 bg-white rounded-xl mx-auto block" style={{ width: 'fit-content' }}>
                <QRCodeSVG value={`${window.location.origin}/reg/checkin/${result.checkinToken}`} size={160} />
              </div>
            </div>
          )}
          {/* Email notification */}
          <div className="pt-3 border-t text-center" style={{ borderColor: 'rgba(0,255,136,0.08)' }}>
            <p className="font-mono text-[10px] text-gray-500">
              Подробная информация о регистрации направлена на вашу почту:
            </p>
            <p className="font-mono text-xs font-bold mt-1" style={{ color: 'var(--color-primary)' }}>
              {contactEmail}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Form ──
  if (!reg) return null;

  const isFull = reg.maxParticipants > 0 && (reg.confirmedCount || 0) >= reg.maxParticipants;

  return (
    <div className="min-h-screen py-8 px-4 relative" style={{ background: 'var(--color-bg)' }}>
      <CyberBackground />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto space-y-6">

        {/* Media gallery */}
        {allMedia.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden">
            {/* Main display */}
            <div className="relative">
              {allMedia[activeMediaIdx]?.type === 'video' ? (
                <video src={allMedia[activeMediaIdx].url} controls className="w-full" style={{ maxHeight: 400, objectFit: 'cover' }} />
              ) : (
                <img src={allMedia[activeMediaIdx]?.url} alt="" className="w-full h-64 object-cover" />
              )}
              {allMedia.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {allMedia.map((_, i) => (
                    <button key={i} onClick={() => setActiveMediaIdx(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === activeMediaIdx ? 'scale-125' : 'opacity-50'}`}
                      style={{ background: i === activeMediaIdx ? 'var(--color-primary)' : '#fff' }} />
                  ))}
                </div>
              )}
            </div>
            {/* Thumbnails */}
            {allMedia.length > 1 && (
              <div className="flex gap-1 p-2 overflow-x-auto">
                {allMedia.map((m, i) => (
                  <button key={i} onClick={() => setActiveMediaIdx(i)}
                    className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === activeMediaIdx ? 'border-green-400' : 'border-transparent opacity-60 hover:opacity-100'}`}>
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
        )}

        {/* Timer — right after cover */}
        {reg.showTimer !== 0 && timerType === 'during' && timeLeft && (
          <div className="glass rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={{ border: '1px solid rgba(0,255,136,0.1)' }}>
            <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-primary)' }}>РЕГИСТРАЦИЯ ЗАКРОЕТСЯ ЧЕРЕЗ:</span>
            <div className="flex gap-2">
              <TimerBlock value={timeLeft.days} label="д" />
              <TimerBlock value={timeLeft.hours} label="ч" />
              <TimerBlock value={timeLeft.minutes} label="м" />
              <TimerBlock value={timeLeft.seconds} label="с" />
            </div>
          </div>
        )}
        {reg.showTimer !== 0 && timerType === 'before' && timeLeft && (
          <div className="glass rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
            <span className="font-mono text-xs font-bold" style={{ color: '#00d4ff' }}>РЕГИСТРАЦИЯ ОТКРОЕТСЯ ЧЕРЕЗ:</span>
            <div className="flex gap-2">
              <TimerBlock value={timeLeft.days} label="д" />
              <TimerBlock value={timeLeft.hours} label="ч" />
              <TimerBlock value={timeLeft.minutes} label="м" />
              <TimerBlock value={timeLeft.seconds} label="с" />
            </div>
          </div>
        )}

        {/* Header card */}
        <div className="glass rounded-2xl p-6 space-y-3">
          <h1 className="text-2xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>{reg.title}</h1>
          <div className="flex items-center gap-4 flex-wrap text-xs font-mono text-gray-400">
            {reg.eventDate && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{reg.eventDate}</span>}
            {reg.eventTime && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{reg.eventTime}</span>}
            {reg.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{reg.location}</span>}
          </div>
          {reg.description && (
            <div className="prose prose-invert prose-sm max-w-none font-mono text-gray-300 text-sm" dangerouslySetInnerHTML={{ __html: reg.description }} />
          )}
        </div>

        {/* Map + Route buttons */}
        {reg.mapCoords && (() => {
          let coords: { lat: number; lng: number } | null = null;
          try { const c = JSON.parse(reg.mapCoords); coords = { lat: c.lat, lng: c.lng }; } catch {}
          if (!coords) return null;
          const yandexUrl = `https://yandex.ru/maps/?rtext=~${coords.lat},${coords.lng}&rtt=auto`;
          const dgisUrl = `https://2gis.ru/directions/tab/car/to/${coords.lng},${coords.lat}`;
          const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
          return (
            <div className="glass rounded-2xl overflow-hidden">
              <MapField value={reg.mapCoords} label={reg.location || 'Место проведения'} />
              <div className="p-4 flex flex-wrap gap-2">
                <a href={yandexUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #fc3f1d, #ff6b3d)', color: '#fff', boxShadow: '0 2px 8px rgba(252,63,29,0.3)' }}>
                  <Navigation className="w-3.5 h-3.5" /> ЯНДЕКС КАРТЫ
                </a>
                <a href={dgisUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #2db55d, #43d477)', color: '#fff', boxShadow: '0 2px 8px rgba(45,181,93,0.3)' }}>
                  <Navigation className="w-3.5 h-3.5" /> 2ГИС
                </a>
                <a href={googleUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all hover:brightness-110"
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

        {/* Participant counter — prominent */}
        {reg.showLimit !== 0 && reg.maxParticipants > 0 && (
          <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.12)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-primary)' }}>
                <Users className="w-3.5 h-3.5 inline mr-1.5" />УЧАСТНИКИ
              </span>
              <span className="font-mono text-lg font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 10px var(--color-glow)' }}>
                {reg.confirmedCount || 0}<span className="text-gray-500 text-sm"> / {reg.maxParticipants}</span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(((reg.confirmedCount || 0) / reg.maxParticipants) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))', boxShadow: '0 0 10px var(--color-glow)' }}
              />
            </div>
            {(reg.waitlistCount || 0) > 0 && (
              <p className="font-mono text-[10px] mt-1.5" style={{ color: '#eab308' }}>{reg.waitlistCount} в очереди ожидания</p>
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[10px] transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(0,255,136,0.12)', color: '#5a5a70' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            ПОДЕЛИТЬСЯ
          </button>

        {/* Status banners */}
        {isFull && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#eab308' }} />
            <span className="font-mono text-xs" style={{ color: '#eab308' }}>Места закончились — вы будете в очереди ожидания</span>
          </div>
        )}

        {/* Form */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>ФОРМА РЕГИСТРАЦИИ</h2>

          {fields.map(field => (
            <FieldRenderer key={field.id} field={field}
              value={answers[field.id] || ''}
              onChange={val => setAnswers(prev => ({ ...prev, [field.id]: val }))}
              error={fieldErrors[field.id]} />
          ))}

          <div className="border-t border-white/5 pt-4 space-y-3">
            <h3 className="font-mono text-xs font-bold text-gray-400">КОНТАКТНЫЕ ДАННЫЕ</h3>
            <div>
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="// ИМЯ *"
                className={`w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border text-gray-200 focus:outline-none focus:border-[var(--color-primary)] ${fieldErrors['_name'] ? 'border-red-500' : 'border-gray-700'}`} />
              {fieldErrors['_name'] && <p className="text-xs font-mono text-red-400 mt-1">{fieldErrors['_name']}</p>}
            </div>
            <div>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="// EMAIL *"
                className={`w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border text-gray-200 focus:outline-none focus:border-[var(--color-primary)] ${fieldErrors['_email'] ? 'border-red-500' : 'border-gray-700'}`} />
              {fieldErrors['_email'] && <p className="text-xs font-mono text-red-400 mt-1">{fieldErrors['_email']}</p>}
            </div>
            <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="// ТЕЛЕФОН"
              className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
          </div>

          {/* Privacy consent */}
          <label className="flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all hover:bg-white/[0.02]"
            style={{ border: fieldErrors['_privacy'] ? '1px solid rgba(255,59,48,0.4)' : privacyConsent ? '1px solid rgba(0,255,136,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
            <div onClick={() => setPrivacyConsent(!privacyConsent)}
              className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer"
              style={{ borderColor: privacyConsent ? 'var(--color-primary)' : '#4a4a60', background: privacyConsent ? 'var(--color-primary)' : 'transparent' }}>
              {privacyConsent && <span className="text-black text-xs font-bold">✓</span>}
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
            className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#000' }}>
            {submitting ? 'ОТПРАВКА...' : 'ЗАРЕГИСТРИРОВАТЬСЯ'}
          </button>
          {fieldErrors['_submit'] && (
            <div className="rounded-lg px-4 py-2.5 mt-2" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
              <p className="font-mono text-xs text-red-400">{fieldErrors['_submit']}</p>
            </div>
          )}
        </div>

        <p className="text-center font-mono text-[10px] text-gray-600">Powered by NEXUS CRM</p>
      </motion.div>
    </div>
  );
}
