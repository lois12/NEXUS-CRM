import { useState } from 'react';
import { Plus, ClipboardList, Search, FolderOpen } from 'lucide-react';
import SurveyCard from './SurveyCard';
import EmptyState from '../ui/EmptyState';
import type { Survey, SurveyStatus } from '../../services/surveyApi';

interface Props {
  surveys: Survey[];
  onCreate: () => void;
  onEdit: (s: Survey) => void;
  onStats: (s: Survey) => void;
  onOpenPublic: (s: Survey) => void;
  onSetStatus: (s: Survey, status: SurveyStatus, opensAt?: string) => void;
  onDuplicate: (s: Survey) => void;
  onDelete: (s: Survey) => void;
  onCopyLink: (s: Survey) => void;
}

type Tab = 'all' | SurveyStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'draft', label: 'Черновики' },
  { key: 'scheduled', label: 'Запланированные' },
  { key: 'published', label: 'Опубликованные' },
  { key: 'completed', label: 'Завершённые' },
];

function statusOf(s: Survey): SurveyStatus {
  return s.status || (s.isPublic ? 'published' : 'draft');
}

export default function SurveyList({
  surveys, onCreate, onEdit, onStats, onOpenPublic, onSetStatus, onDuplicate, onDelete, onCopyLink,
}: Props) {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');

  const counts: Record<Tab, number> = {
    all: surveys.length,
    draft: 0, scheduled: 0, published: 0, completed: 0,
  };
  for (const s of surveys) counts[statusOf(s)]++;

  const q = search.trim().toLowerCase();
  const visible = surveys.filter((s) => {
    if (tab !== 'all' && statusOf(s) !== tab) return false;
    if (q && !`${s.name} ${s.description || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="space-y-3 md:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3">
        <div>
          <h1 className="text-lg md:text-3xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>ОПРОСЫ</h1>
          <p className="text-gray-400 mt-0.5 md:mt-1 font-mono text-[10px] md:text-sm">// СОЗДАВАЙТЕ ОПРОСЫ И СОБИРАЙТЕ ОТВЕТЫ</p>
        </div>
        <button onClick={onCreate} className="btn-primary nx-press flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl font-mono text-[10px] md:text-xs flex-shrink-0">
          <Plus className="w-4 h-4" /> НОВЫЙ ОПРОС
        </button>
      </div>

      {/* folders + поиск */}
      <div className="flex flex-wrap items-center gap-1.5 pb-0.5 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-lg text-[10px] md:text-xs font-mono transition-all nx-press flex-shrink-0 ${
              tab === t.key ? 'glass-accent' : 'bg-white/5 text-gray-400 hover:text-gray-200'
            }`}
            style={tab === t.key ? { color: 'var(--color-primary)' } : {}}
          >
            <FolderOpen className="w-3.5 h-3.5" /> {t.label} ({counts[t.key]})
          </button>
        ))}
        <div className="relative w-full basis-full mt-1.5 md:mt-0 md:w-auto md:basis-0 md:flex-1 md:min-w-[140px] flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск опроса…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={search || tab !== 'all' ? 'Ничего не найдено' : 'Опросов пока нет'}
          description="Создайте первый опрос — вопросы, анонимность, QR и статистика."
          actionLabel={!search && tab === 'all' ? 'СОЗДАТЬ ОПРОС' : undefined}
          onAction={!search && tab === 'all' ? onCreate : undefined}
          icon={<ClipboardList className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-4">
          {visible.map((s) => (
            <SurveyCard
              key={s.id}
              survey={s}
              onOpen={() => onOpenPublic(s)}
              onEdit={() => onEdit(s)}
              onStats={() => onStats(s)}
              onSetStatus={(status, opensAt) => onSetStatus(s, status, opensAt)}
              onDuplicate={() => onDuplicate(s)}
              onDelete={() => onDelete(s)}
              onCopyLink={() => onCopyLink(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
