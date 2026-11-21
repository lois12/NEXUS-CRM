import { Eye, EyeOff, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, X } from 'lucide-react';
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
      className="glass rounded-xl p-3 space-y-2 [box-shadow:var(--depth-contact),var(--depth-rim-top),var(--depth-rim-bottom)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-600 cursor-grab p-2 min-h-[40px] min-w-[40px] flex items-center justify-center" title="Перетащить">
          <GripVertical className="w-4 h-4" />
        </span>
        <span className="font-mono text-[10px] text-gray-500 shrink-0">{index + 1}.</span>
        <input
          value={q.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Текст вопроса"
          className="flex-1 min-w-[140px] px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
        />
        <select
          value={q.type}
          onChange={(e) => onChange({ type: e.target.value as SurveyQuestion['type'] })}
          className="px-2 py-2 rounded font-mono text-[10px] bg-black/30 border border-gray-700 text-gray-200 shrink-0 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
        >
          <option value="choice">Один из списка</option>
          <option value="open">Открытый</option>
        </select>
        <button
          onClick={() => onChange({ required: !q.required })}
          className="p-2 min-h-[40px] min-w-[40px] rounded hover:bg-white/10 text-gray-500 nx-press"
          title={q.required ? 'Обязательный' : 'Необязательный'}
        >
          {q.required ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => onMove(-1)} disabled={index === 0} className="p-2 min-h-[40px] min-w-[40px] rounded hover:bg-white/10 text-gray-500 disabled:opacity-30 nx-press" title="Выше">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-2 min-h-[40px] min-w-[40px] rounded hover:bg-white/10 text-gray-500 disabled:opacity-30 nx-press" title="Ниже">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button onClick={onRemove} className="p-2 min-h-[40px] min-w-[40px] rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 nx-press" title="Удалить вопрос">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {q.type === 'choice' && (
        <div className="pl-8 space-y-1">
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
                className="flex-1 px-2 py-1 rounded font-mono text-[10px] bg-black/30 border border-gray-700 text-gray-200 focus:outline-none [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
              />
              <button
                onClick={() => onChange({ options: q.options.filter((_, j) => j !== i) })}
                className="p-2 min-h-[40px] min-w-[40px] rounded hover:bg-red-500/20 text-gray-500 nx-press flex-shrink-0"
                title="Удалить вариант"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange({ options: [...q.options, ''] })}
            className="flex items-center gap-1 px-2 py-2 min-h-[40px] rounded font-mono text-[10px] hover:bg-white/10 text-gray-400 nx-press"
          >
            <Plus className="w-3 h-3" /> вариант
          </button>
        </div>
      )}
    </div>
  );
}
