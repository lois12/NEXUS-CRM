import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, LayoutGrid, Keyboard, Sparkles } from 'lucide-react';

const STEPS = [
  {
    icon: Rocket,
    title: 'Добро пожаловать в NEXUS',
    text: 'Единое пространство команды: контент-план, задачи, события, опросы и инструменты. Слева — навигация по модулям.',
  },
  {
    icon: LayoutGrid,
    title: 'Рабочие модули',
    text: 'Контент-план с календарём и неделями, канбан задач, мероприятия с QR-регистрациями, опросы и база знаний.',
  },
  {
    icon: Keyboard,
    title: 'Быстрый доступ',
    text: 'Нажмите Ctrl+K — поиск по системе и быстрые действия («Создать пост», «Новый опрос»). Тему интерфейса переключите в шапке.',
  },
];

const STORAGE_KEY = 'nexus_onboarding_v1';

export default function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, '1');
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
            className="glass-frost rounded-2xl p-6 w-full max-w-md relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={close}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: 'rgba(0,255,136,0.1)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 0 28px var(--color-glow)',
              }}
            >
              <S.icon className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
            </div>

            <div className="flex items-center gap-2 mb-3">
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
            <p className="text-sm text-gray-400 leading-relaxed mb-6">{S.text}</p>

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

/** Reset onboarding (for Profile “показать подсказки снова”) */
export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
}
