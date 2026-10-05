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
      className="glass rounded-xl p-3 space-y-2"
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 text-gray-600 cursor-grab" title="Перетащить">
          <GripVertical className="w-4 h-4" />
        </span>
        <span className="mt-1 font-mono text-[10px] text-gray-500 shrink-0">{index + 1}.</span>
        <input
          value={q.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Текст вопроса"
          className="flex-1 px-2 py-1.5 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
        />
        <select
          value={q.type}
          onChange={(e) => onChange({ type: e.target.value as SurveyQuestion['type'] })}
          className="px-2 py-1.5 rounded font-mono text-[10px] bg-black/30 border border-gray-700 text-gray-200"
        >
          <option value="choice">Один из списка</option>
          <option value="open">Открытый</option>
        </select>
        <button
          onClick={() => onChange({ required: !q.required })}
          className="p-1.5 rounded hover:bg-white/10 text-gray-500"
          title={q.required ? 'Обязательный' : 'Необязательный'}
        >
          {q.required ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => onMove(-1)} disabled={index === 0} className="p-1.5 rounded hover:bg-white/10 text-gray-500 disabled:opacity-30">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-1.5 rounded hover:bg-white/10 text-gray-500 disabled:opacity-30">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400">
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
                className="flex-1 px-2 py-1 rounded font-mono text-[10px] bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
              />
              <button
                onClick={() => onChange({ options: q.options.filter((_, j) => j !== i) })}
                className="p-1 rounded hover:bg-red-500/20 text-gray-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange({ options: [...q.options, ''] })}
            className="flex items-center gap-1 px-2 py-1 rounded font-mono text-[10px] hover:bg-white/10 text-gray-400"
          >
            <Plus className="w-3 h-3" /> вариант
          </button>
        </div>
      )}
    </div>
  );
}
