import { GripVertical, Plus, Trash2, ChevronUp, ChevronDown, X, Eye, EyeOff } from 'lucide-react';
import type { SurveyQuestion } from '../../services/surveyApi';

interface Props {
  q: SurveyQuestion;
  index: number;
  total: number;
  onChange: (patch: Partial<SurveyQuestion>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDragStart?: () => void;
  onDrop?: () => void;
}

const FIELD = 'w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]';

/** textarea растёт по содержимому */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/** One question block in the survey builder */
export default function SurveyQuestionCard({
  q, index, total, onChange, onRemove, onMove, onDragStart, onDrop,
}: Props) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="rounded-xl overflow-hidden [box-shadow:var(--depth-contact),var(--depth-rim-top),var(--depth-rim-bottom)]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* header */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="text-gray-600 cursor-grab p-2 min-h-[40px] min-w-[40px] flex items-center justify-center" title="Перетащить" aria-label="Перетащить">
          <GripVertical className="w-4 h-4" />
        </span>
        <span className="font-mono text-[10px] text-gray-500">ВОПРОС {index + 1}</span>
        <div className="flex-1 min-w-3" />
        <div className="flex items-center gap-1">
          {/* тип — кнопки, без «плывущего» select */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
            <button
              type="button"
              onClick={() => onChange({ type: 'choice' })}
              className="px-2 py-1.5 text-[9px] font-mono nx-press"
              style={q.type === 'choice'
                ? { background: 'var(--color-primary)', color: '#000' }
                : { background: 'transparent', color: '#8b9bbb' }}
            >ЗАКРЫТЫЙ</button>
            <button
              type="button"
              onClick={() => onChange({ type: 'open' })}
              className="px-2 py-1.5 text-[9px] font-mono nx-press"
              style={q.type === 'open'
                ? { background: 'var(--color-primary)', color: '#000' }
                : { background: 'transparent', color: '#8b9bbb' }}
            >ОТКРЫТЫЙ</button>
          </div>
          <button
            onClick={() => onChange({ required: !q.required })}
            className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 text-gray-500 nx-press"
            title={q.required ? 'Обязательный' : 'Необязательный'}
            aria-label={q.required ? 'Обязательный' : 'Необязательный'}
          >
            {q.required ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onMove(-1)} disabled={index === 0} className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 text-gray-500 disabled:opacity-30 nx-press" title="Выше" aria-label="Выше">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 text-gray-500 disabled:opacity-30 nx-press" title="Ниже" aria-label="Ниже">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove} className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-red-500/20 nx-press" style={{ color: '#ff6b6b' }} title="Удалить вопрос" aria-label="Удалить вопрос">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>

      {/* тело */}
      <div className="px-3 pb-3 space-y-2 min-w-0">
        <textarea
          value={q.title}
          onChange={(e) => { onChange({ title: e.target.value }); autoGrow(e.target); }}
          placeholder="Текст вопроса…"
          rows={1}
          ref={autoGrow}
          className={`${FIELD} resize-none overflow-hidden`}
        />
        {q.type === 'choice' && (
          <div className="pl-1 space-y-1.5">
            {q.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  value={opt}
                  onChange={(e) => {
                    const options = [...q.options];
                    options[i] = e.target.value;
                    onChange({ options });
                  }}
                  placeholder={`Вариант ${i + 1}`}
                  className={`${FIELD} flex-1 min-w-0`}
                />
                <button
                  onClick={() => onChange({ options: q.options.filter((_, j) => j !== i) })}
                  className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-red-500/20 text-gray-500 nx-press flex-shrink-0"
                  title="Удалить вариант"
                  aria-label="Удалить вариант"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => onChange({ options: [...q.options, ''] })}
              className="btn-ghost nx-press flex items-center gap-1 px-3 py-2 text-[10px]"
            >
              <Plus className="w-3 h-3" /> ВАРИАНТ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
