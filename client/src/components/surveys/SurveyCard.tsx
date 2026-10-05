import { motion } from 'framer-motion';
import { BarChart3, Globe, Image as ImageIcon, Copy, Link2, EyeOff, Trash2 } from 'lucide-react';
import type { Survey } from '../../services/surveyApi';
import { formatRuDate } from '../../utils/collageStore';

interface Props {
  survey: Survey;
  onOpen: () => void;
  onEdit: () => void;
  onStats: () => void;
  onTogglePublish: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}

export default function SurveyCard({
  survey, onOpen, onEdit, onStats, onTogglePublish, onDuplicate, onDelete, onCopyLink,
}: Props) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="glass rounded-xl overflow-hidden cursor-pointer"
      onClick={onOpen}
    >
      <div className="h-28 bg-black/40 relative">
        {survey.imageUrl ? (
          <img src={survey.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}
        <span
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded font-mono text-[8px]"
          style={survey.isPublic
            ? { background: 'rgba(0,255,136,0.2)', color: '#00ff88' }
            : { background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}
        >
          {survey.isPublic ? 'ОПУБЛ.' : 'ЧЕРНОВИК'}
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="font-mono text-sm font-bold text-white truncate">{survey.name}</h3>
        {survey.description && (
          <p className="font-mono text-[10px] text-gray-400" style={{
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{survey.description}</p>
        )}
        <div className="flex items-center justify-between font-mono text-[9px] text-gray-600 pt-1 border-t border-white/5">
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> {survey.responseCount ?? 0}
          </span>
          <span>{survey.isAnonymous ? 'анонимный' : 'идент.'}</span>
          <span>{survey.updatedAt ? formatRuDate(Date.parse(survey.updatedAt) || Date.now()) : ''}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="flex-1 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10"
          >
            РЕДАКТОР
          </button>
          <button
            onClick={onStats}
            className="flex-1 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10"
          >
            СТАТИСТИКА
          </button>
          <button
            onClick={onTogglePublish}
            className="flex-1 py-1.5 rounded-lg font-mono text-[10px]"
            style={survey.isPublic
              ? { background: 'rgba(234,179,8,0.15)', color: '#eab308' }
              : { background: 'var(--color-primary)', color: '#000' }}
            title={survey.isPublic ? 'Снять с публикации' : 'Опубликовать'}
          >
            {survey.isPublic ? <><EyeOff className="w-3 h-3 inline mr-1" />СНЯТЬ</> : <><Globe className="w-3 h-3 inline mr-1" />ОПУБЛ.</>}
          </button>
          {survey.isPublic && survey.publicSlug && (
            <button
              onClick={onCopyLink}
              className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10"
              title="Скопировать ссылку"
            >
              <Link2 className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onDuplicate}
            className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10"
            title="Дублировать"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1.5 rounded-lg font-mono text-[10px] hover:bg-red-500/15 text-red-400"
            title="Удалить"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
