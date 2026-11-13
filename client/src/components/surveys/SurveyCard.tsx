import { useState } from 'react';
import { motion } from 'framer-motion';
import SmartImage from '../ui/SmartImage';
import { BarChart3, Image as ImageIcon, Copy, Link2, Trash2, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
  const [showQr, setShowQr] = useState(false);
  const publicUrl = survey.publicSlug ? `${window.location.origin}/opros/${survey.publicSlug}` : '';

  return (
    <>
    <motion.div
      className="nx-tile overflow-hidden cursor-pointer"
      onClick={onOpen}
    >
      <div className="h-24 bg-black/40 relative">
        {survey.imageUrl ? (
          <SmartImage src={survey.imageUrl} alt="" className="w-full h-full object-cover" />
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
          <button onClick={onEdit} className="flex-1 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10 nx-press">
            РЕДАКТОР
          </button>
          <button onClick={onStats} className="flex-1 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10 nx-press">
            СТАТИСТИКА
          </button>
          {(status === 'published' || status === 'completed') && survey.publicSlug && (
            <>
              <button onClick={onCopyLink} className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10 nx-press" title="Ссылка">
                <Link2 className="w-3 h-3" />
              </button>
              <button onClick={() => setShowQr(true)} className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10 nx-press" title="QR-код">
                <QrCode className="w-3 h-3" />
              </button>
            </>
          )}
          <button onClick={onDuplicate} className="px-2 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10 nx-press" title="Дублировать">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="px-2 py-1.5 rounded-lg font-mono text-[10px] hover:bg-red-500/15 text-red-400 nx-press" title="Удалить">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>

    {/* QR модалка */}
    {showQr && (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        onClick={() => setShowQr(false)}
      >
        <div className="nx-bezel" onClick={(e) => e.stopPropagation()}>
          <div className="nx-core p-6 text-center">
            <div className="flex items-center justify-between mb-3">
              <span className="nx-eyebrow">QR-КОД</span>
              <button onClick={() => setShowQr(false)} className="p-1 rounded-lg hover:bg-white/10 nx-press" aria-label="Закрыть">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="inline-block p-3 bg-white rounded-xl">
              <QRCodeSVG value={publicUrl} size={180} />
            </div>
            <p className="font-mono text-[10px] text-gray-500 mt-3 break-all max-w-[260px] mx-auto">{publicUrl}</p>
            <button
              onClick={() => {
                const ta = document.createElement('textarea');
                ta.value = publicUrl; ta.style.cssText = 'position:fixed;left:-9999px';
                document.body.appendChild(ta); ta.select(); document.execCommand('copy');
                document.body.removeChild(ta);
              }}
              className="mt-3 px-4 py-2 rounded-lg font-mono text-[10px] glass hover:bg-white/10 nx-press"
            >
              СКОПИРОВАТЬ ССЫЛКУ
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
