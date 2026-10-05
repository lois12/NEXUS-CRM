import { Plus, ClipboardList } from 'lucide-react';
import SurveyCard from './SurveyCard';
import type { Survey } from '../../services/surveyApi';

interface Props {
  surveys: Survey[];
  onCreate: () => void;
  onEdit: (s: Survey) => void;
  onStats: (s: Survey) => void;
  onOpenPublic: (s: Survey) => void;
}

export default function SurveyList({ surveys, onCreate, onEdit, onStats, onOpenPublic }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <ClipboardList className="w-7 h-7" /> ОПРОСЫ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// СОЗДАВАЙТЕ ОПРОСЫ И СОБИРАЙТЕ ОТВЕТЫ</p>
        </div>
        <button
          onClick={onCreate}
          className="px-4 py-2.5 rounded-xl font-mono text-sm font-bold flex items-center gap-2"
          style={{ background: 'var(--color-primary)', color: '#000' }}
        >
          <Plus className="w-4 h-4" /> НОВЫЙ ОПРОС
        </button>
      </div>

      {surveys.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center">
          <ClipboardList className="w-10 h-10 mx-auto text-gray-600 mb-3" />
          <p className="font-mono text-sm text-gray-400">Пока нет опросов</p>
          <p className="font-mono text-[10px] text-gray-600 mt-1">нажмите «НОВЫЙ ОПРОС»</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {surveys.map((s) => (
            <SurveyCard
              key={s.id}
              survey={s}
              onOpen={() => onOpenPublic(s)}
              onEdit={() => onEdit(s)}
              onStats={() => onStats(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
