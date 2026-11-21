import { useState } from 'react';
import { motion } from 'framer-motion';
import SmartImage from '../ui/SmartImage';
import { BarChart3, Image as ImageIcon, Copy, Link2, Trash2, QrCode, X, Download, Edit3, ExternalLink } from 'lucide-react';
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
  const [showQrFormats, setShowQrFormats] = useState(false);
  const publicUrl = survey.publicSlug ? `${window.location.origin}/opros/${survey.publicSlug}` : '';

  /** Скачать QR в выбранном формате */
  const downloadQr = (format: 'svg' | 'png' | 'jpg') => {
    const svg = document.getElementById('survey-qr-svg');
    if (!svg) return;
    const base = `qr-${survey.publicSlug || 'survey'}`;
    if (format === 'svg') {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${base}.svg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d')!;
        // белый фон обязателен для JPG
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 0, 0, 512, 512);
        const a = document.createElement('a');
        a.href = c.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
        a.download = `${base}.${format}`;
        a.click();
      };
      img.src = url;
    }
    setShowQrFormats(false);
  };

  return (
    <>
    <motion.div
      className="nx-tile overflow-hidden cursor-pointer group"
      onClick={onOpen}
    >
      <div className="h-16 md:h-24 bg-black/40 relative">
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
      <div className="p-2.5 md:p-3 space-y-1.5 md:space-y-2">
        <h3 className="font-mono text-xs md:text-sm font-bold text-white line-clamp-2">{survey.name}</h3>
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

        <div className="nx-divider" />
        <div className="flex flex-wrap gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pt-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} title="Редактировать" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
            <Edit3 className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={onStats} title="Статистика" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
          </button>
          {(status === 'published' || status === 'completed') && survey.publicSlug && (
            <>
              <button onClick={onCopyLink} title="Ссылка" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
                <Link2 className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button onClick={() => setShowQr(true)} title="QR-код" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
                <QrCode className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button onClick={onOpen} title="Открыть" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </>
          )}
          <button onClick={onDuplicate} title="Копировать" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
            <Copy className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={onDelete} title="Удалить" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-red-500/20 nx-press flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
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
              <div className="flex items-center gap-1 relative">
                <button
                  onClick={() => setShowQrFormats(v => !v)}
                  className="p-1 rounded-lg hover:bg-white/10 nx-press"
                  aria-label="Скачать QR"
                  title="Скачать"
                >
                  <Download className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                </button>
                {showQrFormats && (
                  <div
                    className="absolute top-full right-0 mt-1 flex gap-1 p-1 rounded-xl z-10"
                    style={{ background: 'rgba(20,20,35,0.98)', border: '1px solid rgba(255,255,255,0.12)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(['svg', 'png', 'jpg'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => downloadQr(f)}
                        className="px-2 py-1 rounded-lg font-mono text-[9px] font-bold uppercase hover:bg-white/10 nx-press"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowQr(false)} className="p-1 rounded-lg hover:bg-white/10 nx-press" aria-label="Закрыть">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="inline-block p-3 bg-white rounded-xl">
              <QRCodeSVG value={publicUrl} size={180} id="survey-qr-svg" />
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
