import { X, Eye } from 'lucide-react';
import type { Survey, SurveyQuestion } from '../../services/surveyApi';

interface Props {
  open: boolean;
  onClose: () => void;
  survey: Survey & { questions: SurveyQuestion[] };
}

/** Live form preview in a modal (read-only) */
export default function SurveyPreviewModal({ open, onClose, survey }: Props) {
  if (!open) return null;
  const isAnon = !!survey.isAnonymous;
  const questions = survey.questions || [];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[88vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(160deg, rgba(16,20,28,0.99), rgba(10,12,18,0.99))',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          animation: 'previewPop .25s cubic-bezier(.2,.9,.25,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes previewPop {
            from { opacity: 0; transform: translateY(16px) scale(0.96); }
            to { opacity: 1; transform: none; }
          }
        `}</style>

        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Eye className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <span className="font-mono text-xs font-bold tracking-wider" style={{ color: 'var(--color-primary)' }}>
            ПРЕВЬЮ ФОРМЫ
          </span>
          <span className="font-mono text-[9px] text-gray-600 flex-1">так видит пользователь</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {survey.imageUrl && (
            <img src={survey.imageUrl} alt="" className="w-full max-h-40 object-cover rounded-xl border border-white/10" />
          )}
          <div className="glass rounded-xl p-4 space-y-1">
            <h1 className="font-mono text-lg font-bold text-white" style={{ wordBreak: 'break-word' }}>
              {survey.name || 'Без названия'}
            </h1>
            {survey.description && (
              <p className="font-mono text-xs text-gray-400 leading-relaxed">{survey.description}</p>
            )}
            <p className="font-mono text-[9px] text-gray-600">
              {isAnon ? 'Анонимный опрос' : 'Опрос с указанием контактов'} · 1 ответ с устройства
            </p>
          </div>

          {!isAnon && (
            <div className="glass rounded-xl p-3 space-y-2">
              <label className="font-mono text-[10px] text-gray-500 block">КОНТАКТЫ</label>
              {['ФИО *', 'Телефон *', 'Email *'].map((ph) => (
                <div key={ph} className="px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-600">
                  {ph}
                </div>
              ))}
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded border border-gray-600 mt-0.5 shrink-0" />
                <p className="font-mono text-[9px] text-gray-500 leading-relaxed">
                  Согласен с Политикой конфиденциальности и Политикой обработки персональных данных (152-ФЗ)
                </p>
              </div>
            </div>
          )}

          {questions.map((q, i) => (
            <div key={q.id || i} className="glass rounded-xl p-3 space-y-2">
              <p className="font-mono text-sm text-gray-200" style={{ wordBreak: 'break-word' }}>
                {i + 1}. {q.title || 'Без текста'}{q.required && <span className="text-red-400">*</span>}
              </p>
              {q.type === 'choice' ? (
                <div className="space-y-1">
                  {(q.options || []).filter(Boolean).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2 px-2 py-1.5 rounded">
                      <div className="w-3.5 h-3.5 rounded-full border border-gray-600 shrink-0" />
                      <span className="font-mono text-xs text-gray-300">{opt}</span>
                    </div>
                  ))}
                  {(q.options || []).filter(Boolean).length === 0 && (
                    <p className="font-mono text-[10px] text-gray-600">нет вариантов</p>
                  )}
                </div>
              ) : (
                <div className="px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-600 min-h-[56px]">
                  Ответ…
                </div>
              )}
            </div>
          ))}

          <div className="w-full py-2.5 rounded-xl font-mono text-xs font-bold text-center opacity-70"
            style={{ background: 'var(--color-primary)', color: '#000' }}>
            ОТПРАВИТЬ
          </div>

          {survey.thanksText && (
            <div className="px-3 py-2 rounded-lg font-mono text-[9px] text-gray-600 text-center">
              после отправки: «{survey.thanksText}»
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
