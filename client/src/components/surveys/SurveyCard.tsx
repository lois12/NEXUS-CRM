import { motion } from 'framer-motion';
import { BarChart3, Image as ImageIcon, Copy, Link2, Trash2 } from 'lucide-react';
import SurveyStatusSelect, { STATUS_META } from './SurveyStatusSelect';
import type { Survey, SurveyStatus } from '../../services/surveyApi';
import { formatRuDate } from '../../utils/collageStore';

interface Props {
  survey: Survey;
  onOpen: () => void;
  onEdit: () => void;
  onStats: () => void;
  onSetStatus: (status: SurveyStatus, opensAt?: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}

export default function SurveyCard({
  survey, onOpen, onEdit, onStats, onSetStatus, onDuplicate, onDelete, onCopyLink,
}: Props) {
  const status = survey.status || (survey.isPublic ? 'published' : 'draft');
  const meta = STATUS_META[status];

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="glass rounded-xl overflow-hidden cursor-pointer"
      onClick={onOpen}
    >
      <div className="h-24 bg-black/40 relative">
        {survey.imageUrl ? (
          <img src={survey.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700">
            <ImageIcon className="w-7 h-7" />
          </div>
        )}
        <span
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded font-mono text-[8px]"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}44` }}
        >
          {meta.label}
        </span>
      </div>
      <div className="p-3 space-y-2">
        <h3 className="font-mono text-sm font-bold text-white truncate">{survey.name}</h3>
        {survey.description && (
          <p className="font-mono text-[10px] text-gray-400" style={{
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{survey.description}</p>
        )}
        <div className="flex items-center justify-between font-mono text-[9px] text-gray-600">
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> {survey.responseCount ?? 0} чел.
          </span>
          <span>{survey.isAnonymous ? 'аноним' : 'идент.'}</span>
          <span>{survey.updatedAt ? formatRuDate(Date.parse(survey.updatedAt) || Date.now()) : ''}</span>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <SurveyStatusSelect
            value={status}
            opensAt={survey.opensAt}
            compact
            onChange={onSetStatus}
          />
        </div>

        <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="flex-1 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10">
            РЕДАКТОР
          </button>
          <button onClick={onStats} className="flex-1 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10">
            СТАТИСТИКА
          </button>
          {(status === 'published' || status === 'completed') && survey.publicSlug && (
            <button onClick={onCopyLink} className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10" title="Ссылка">
              <Link2 className="w-3 h-3" />
            </button>
          )}
          <button onClick={onDuplicate} className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10" title="Дублировать">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="px-2 py-1.5 rounded-lg font-mono text-[10px] hover:bg-red-500/15 text-red-400" title="Удалить">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
