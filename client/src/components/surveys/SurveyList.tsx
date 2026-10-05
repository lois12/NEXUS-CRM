import { useState } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import SurveyCard from './SurveyCard';
import type { Survey, SurveyStatus } from '../../services/surveyApi';
import { STATUS_META } from './SurveyStatusSelect';

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

  const counts: Record<Tab, number> = {
    all: surveys.length,
    draft: 0, scheduled: 0, published: 0, completed: 0,
  };
  for (const s of surveys) counts[statusOf(s)]++;

  const visible = tab === 'all' ? surveys : surveys.filter((s) => statusOf(s) === tab);

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

      {/* tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((t) => {
          const active = tab === t.key;
          const meta = t.key !== 'all' ? STATUS_META[t.key] : null;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-2 rounded-xl font-mono text-[11px] transition-all duration-200 hover:scale-105 flex items-center gap-1.5"
              style={active
                ? {
                    background: meta ? meta.bg : 'var(--color-primary)',
                    color: meta ? meta.color : '#000',
                    border: `1px solid ${meta ? meta.color + '55' : 'transparent'}`,
                    boxShadow: '0 0 16px rgba(0,255,136,0.15)',
                  }
                : { background: 'rgba(255,255,255,0.04)', color: '#888', border: '1px solid transparent' }}
            >
              {t.label}
              <span className="opacity-70">({counts[t.key]})</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center">
          <ClipboardList className="w-10 h-10 mx-auto text-gray-600 mb-3" />
          <p className="font-mono text-sm text-gray-400">
            {tab === 'all' ? 'Пока нет опросов' : `Нет опросов: ${TABS.find(t => t.key === tab)?.label.toLowerCase()}`}
          </p>
          {tab === 'all' && (
            <p className="font-mono text-[10px] text-gray-600 mt-1">нажмите «НОВЫЙ ОПРОС»</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
