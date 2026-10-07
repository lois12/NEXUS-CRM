import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, LayoutGrid, Keyboard, Sparkles, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'nexus_onboarding_v2';

/** Inline SVG illustrations — offline, theme-aware, no external assets */
function ArtDashboard() {
  return (
    <svg viewBox="0 0 320 160" className="w-full h-auto rounded-xl" style={{ background: 'linear-gradient(145deg,#0d1520,#0a1018)' }}>
      <rect x="16" y="18" width="88" height="124" rx="8" fill="rgba(0,255,136,0.08)" stroke="rgba(0,255,136,0.25)" />
      <rect x="28" y="34" width="64" height="8" rx="4" fill="#00ff88" opacity="0.7" />
      <rect x="28" y="52" width="52" height="6" rx="3" fill="#4a5a68" />
      <rect x="28" y="66" width="58" height="6" rx="3" fill="#4a5a68" />
      <rect x="28" y="80" width="48" height="6" rx="3" fill="#4a5a68" />
      <rect x="118" y="18" width="186" height="56" rx="8" fill="rgba(0,212,255,0.1)" stroke="rgba(0,212,255,0.3)" />
      <circle cx="148" cy="46" r="14" fill="#00d4ff" opacity="0.85" />
      <rect x="174" y="36" width="90" height="8" rx="4" fill="#d0d0dc" opacity="0.8" />
      <rect x="174" y="52" width="60" height="6" rx="3" fill="#6a7a88" />
      <rect x="118" y="86" width="88" height="56" rx="8" fill="rgba(191,0,255,0.12)" stroke="rgba(191,0,255,0.3)" />
      <rect x="216" y="86" width="88" height="56" rx="8" fill="rgba(0,255,136,0.1)" stroke="rgba(0,255,136,0.28)" />
      <path d="M130 128 L150 110 L168 118 L194 98" stroke="#00ff88" strokeWidth="2" fill="none" />
      <rect x="232" y="108" width="56" height="8" rx="4" fill="#00ff88" opacity="0.6" />
      <rect x="232" y="122" width="40" height="6" rx="3" fill="#4a5a68" />
    </svg>
  );
}

function ArtModules() {
  const tiles = [
    { x: 24, y: 24, c: '#00ff88', l: 'КОНТЕНТ' },
    { x: 120, y: 24, c: '#00d4ff', l: 'ОПРОСЫ' },
    { x: 216, y: 24, c: '#bf00ff', l: 'ЗАДАЧИ' },
    { x: 24, y: 92, c: '#ff6600', l: 'СОБЫТИЯ' },
    { x: 120, y: 92, c: '#00ff88', l: 'СПИСКИ' },
    { x: 216, y: 92, c: '#00d4ff', l: 'ЧАТ' },
  ];
  return (
    <svg viewBox="0 0 320 160" className="w-full h-auto rounded-xl" style={{ background: 'linear-gradient(145deg,#0d1520,#0a1018)' }}>
      {tiles.map((t) => (
        <g key={t.l}>
          <rect x={t.x} y={t.y} width="80" height="52" rx="10" fill={`${t.c}18`} stroke={`${t.c}55`} />
          <circle cx={t.x + 40} cy={t.y + 22} r="8" fill={t.c} opacity="0.85" />
          <text x={t.x + 40} y={t.y + 42} textAnchor="middle" fill={t.c} fontSize="8" fontFamily="monospace" letterSpacing="1">{t.l}</text>
        </g>
      ))}
    </svg>
  );
}

function ArtShortcuts() {
  return (
    <svg viewBox="0 0 320 160" className="w-full h-auto rounded-xl" style={{ background: 'linear-gradient(145deg,#0d1520,#0a1018)' }}>
      <rect x="48" y="30" width="224" height="100" rx="12" fill="rgba(15,20,30,0.95)" stroke="rgba(0,255,136,0.3)" />
      <rect x="64" y="46" width="192" height="28" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
      <circle cx="82" cy="60" r="7" fill="none" stroke="#00ff88" strokeWidth="2" />
      <line x1="87" y1="65" x2="93" y2="71" stroke="#00ff88" strokeWidth="2" />
      <rect x="102" y="56" width="100" height="8" rx="4" fill="#6a7a88" />
      <rect x="64" y="86" width="88" height="26" rx="8" fill="rgba(0,255,136,0.15)" stroke="rgba(0,255,136,0.4)" />
      <text x="108" y="103" textAnchor="middle" fill="#00ff88" fontSize="10" fontFamily="monospace">Ctrl+K</text>
      <rect x="164" y="86" width="92" height="26" rx="8" fill="rgba(0,212,255,0.12)" stroke="rgba(0,212,255,0.35)" />
      <text x="210" y="103" textAnchor="middle" fill="#00d4ff" fontSize="9" fontFamily="monospace">Создать…</text>
    </svg>
  );
}

const STEPS = [
  {
    icon: Rocket,
    title: 'Добро пожаловать в NEXUS',
    text: 'Единое пространство команды: контент-план, задачи, события, опросы и инструменты. Слева — навигация, шапка — поиск, темы и уведомления.',
    art: <ArtDashboard />,
    tips: ['Профиль и тема — в шапке справа', 'Уведомления — колокольчик'],
  },
  {
    icon: LayoutGrid,
    title: 'Модули под работу',
    text: 'Контент-план (сетка / недели / FullCalendar), канбан задач, мероприятия с QR-регистрациями, опросы со статистикой, списки и база знаний.',
    art: <ArtModules />,
    tips: ['Опросы: статусы черновик → публикация', 'Экспорт PDF/CSV почти везде'],
  },
  {
    icon: Keyboard,
    title: 'Быстрый доступ',
    text: 'Ctrl+K — поиск по системе и действия: «Создать пост», «Новый опрос». Экспорт недели — кнопки PDF/CSV в контент-плане.',
    art: <ArtShortcuts />,
    tips: ['Ctrl+K — поиск и команды', 'PDF-отчёты — чистые, для печати'],
  },
];

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
  try {
    window.dispatchEvent(new Event('nexus-onboarding-reset'));
  } catch { /* noop */ }
}

export default function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const openTour = () => {
    setStep(0);
    setOpen(true);
  };

  useEffect(() => {
    const start = () => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setOpen(true), 900);
        return () => clearTimeout(t);
      }
    };
    const cleanup = start();
    const onReset = () => openTour();
    window.addEventListener('nexus-onboarding-reset', onReset);
    return () => {
      cleanup?.();
      window.removeEventListener('nexus-onboarding-reset', onReset);
    };
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, '2');
    setOpen(false);
  };

  const next = () => {
    if (step >= STEPS.length - 1) close();
    else setStep((s) => s + 1);
  };

  const S = STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.92, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="glass-frost rounded-2xl p-5 md:p-6 w-full max-w-lg relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={close}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">{S.art}</div>

            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,255,136,0.12)', border: '1px solid var(--color-border)' }}
              >
                <S.icon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className="h-1 rounded-full transition-all"
                  style={{
                    width: i === step ? 22 : 8,
                    background: i <= step ? 'var(--color-primary)' : 'rgba(255,255,255,0.12)',
                  }}
                />
              ))}
              <span className="ml-auto text-[10px] font-mono text-gray-500">
                {step + 1}/{STEPS.length}
              </span>
            </div>

            <h2 className="text-lg font-bold font-mono text-gray-100 mb-2 flex items-center gap-2">
              {S.title}
              {step === 0 && <Sparkles className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />}
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-3">{S.text}</p>
            <ul className="mb-5 space-y-1">
              {S.tips.map((t) => (
                <li key={t} className="text-[11px] font-mono text-gray-500 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-primary)' }} />
                  {t}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <button
                onClick={close}
                className="px-4 py-2.5 rounded-xl text-xs font-mono text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
              >
                ПРОПУСТИТЬ
              </button>
              <button
                onClick={next}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition-all"
                style={{
                  background: 'var(--color-primary)',
                  color: '#000',
                  boxShadow: '0 0 18px var(--color-glow)',
                }}
              >
                {step >= STEPS.length - 1 ? 'НАЧАТЬ' : 'ДАЛЕЕ →'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Button for Profile: show onboarding again */
export function OnboardingResetButton() {
  return (
    <button
      onClick={() => {
        resetOnboarding();
        showToastSafe('Открываю подсказки…');
      }}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold glass hover:bg-white/10 transition-colors"
    >
      <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
      ПОКАЗАТЬ ПОДСКАЗКИ СНОВА
    </button>
  );
}

function showToastSafe(_msg: string) {
  // fire event handled by Onboarding; toast is optional
}
