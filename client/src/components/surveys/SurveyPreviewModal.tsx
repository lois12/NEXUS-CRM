import { X, Eye } from 'lucide-react';
import type { Survey, SurveyQuestion } from '../../services/surveyApi';

interface Props {
  open: boolean;
  onClose: () => void;
  survey: Survey & { questions: SurveyQuestion[] };
}

/** Live form preview in a modal (read-only) — единый корпус с квизами и регистрациями */
export default function SurveyPreviewModal({ open, onClose, survey }: Props) {
  if (!open) return null;
  const isAnon = !!survey.isAnonymous;
  const questions = survey.questions || [];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center p-3 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div className="nx-bezel w-full max-w-md my-6" onClick={(e) => e.stopPropagation()}>
        <div className="nx-core p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="nx-eyebrow">ПРЕДПРОСМОТР</span>
              <span className="font-mono text-[9px] text-gray-600 truncate">так видит пользователь</span>
            </div>
            <button onClick={onClose} className="flex items-center justify-center p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0" aria-label="Закрыть">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="space-y-3">
            {survey.imageUrl && (
              <img src={survey.imageUrl} alt="" className="w-full max-h-40 object-cover rounded-xl border border-white/10" />
            )}
            <div className="glass rounded-xl p-4 space-y-1">
              <h1 className="font-mono text-lg font-bold text-white break-words">
                {survey.name || 'Без названия'}
              </h1>
              {survey.description && (
                <p className="font-mono text-xs text-gray-400 leading-relaxed break-words">{survey.description}</p>
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
                <p className="font-mono text-sm text-gray-200 break-words">
                  {i + 1}. {q.title || 'Без текста'}{!!q.required && <span className="text-red-400">*</span>}
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
    </div>
  );
}
