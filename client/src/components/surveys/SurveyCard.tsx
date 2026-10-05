import { motion } from 'framer-motion';
import { BarChart3, Globe, Lock, Image as ImageIcon } from 'lucide-react';
import type { Survey } from '../../services/surveyApi';
import { formatRuDate } from '../../utils/collageStore';

interface Props {
  survey: Survey;
  onOpen: () => void;
  onEdit: () => void;
  onStats: () => void;
}

export default function SurveyCard({ survey, onOpen, onEdit, onStats }: Props) {
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
          <p className="font-mono text-[10px] text-gray-400 line-clamp-2" style={{
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
        <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
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
          {survey.isPublic && survey.publicSlug && (
            <button
              onClick={onOpen}
              className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10"
              title="Открыть публичную форму"
            >
              {survey.isAnonymous ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
