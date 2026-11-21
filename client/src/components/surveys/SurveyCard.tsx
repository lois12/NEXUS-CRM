import { useEffect, useRef, useState } from 'react';
import SmartImage from '../ui/SmartImage';
import { BarChart3, Image as ImageIcon, Copy, Link2, Trash2, QrCode, X, Download, Edit3, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { STATUS_META, STATUS_ORDER } from './SurveyStatusSelect';
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
  const [openStatus, setOpenStatus] = useState(false);
  const [statusPos, setStatusPos] = useState<{ x: number; y: number } | null>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const publicUrl = survey.publicSlug ? `${window.location.origin}/opros/${survey.publicSlug}` : '';

  // клик мимо — закрываем выпадашку статуса
  useEffect(() => {
    if (!openStatus) return;
    const close = () => setOpenStatus(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openStatus]);

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
    <div className={`nx-tile p-3 md:p-4 relative ${openStatus ? 'z-30' : ''}`}>
      <div className="flex items-start gap-2 md:gap-3">
        {survey.imageUrl ? (
          <SmartImage loading="lazy" src={survey.imageUrl} alt="" className="w-10 h-10 md:w-14 md:h-14 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-border)' }}>
            <ImageIcon className="w-5 h-5 text-gray-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-200 line-clamp-2 text-sm md:text-base min-w-0 break-words">{survey.name}</h3>
            {/* Статус — компактная выпадашка */}
            <button
              ref={statusBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (openStatus) { setOpenStatus(false); return; }
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setStatusPos({ x: Math.min(r.left, window.innerWidth - 170), y: r.bottom + 6 });
                setOpenStatus(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full nx-press flex-shrink-0"
              style={{
                background: `${meta.color}26`,
                color: meta.color,
                border: `1px solid ${meta.color}55`,
                minHeight: 28,
              }}
              title="Сменить статус"
              aria-label="Сменить статус"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
              <span className="font-mono text-[9px] whitespace-nowrap">{meta.label}</span>
            </button>
          </div>
          {survey.description && (
            <p className="text-[10px] font-mono text-gray-500 line-clamp-2 break-words">{survey.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[9px] font-mono text-gray-500 flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> {survey.responseCount ?? 0} чел.
            </span>
            <span className="text-[9px] font-mono text-gray-500">{survey.isAnonymous ? 'аноним' : 'идент.'}</span>
            <span className="text-[9px] font-mono text-gray-500">
              {survey.updatedAt ? formatRuDate(Date.parse(survey.updatedAt) || Date.now()) : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mt-2 md:mt-3 flex-wrap">
        <button onClick={onEdit} title="Редактировать" aria-label="Редактировать" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
          <Edit3 className="w-3.5 h-3.5 text-gray-400" />
        </button>
        <button onClick={onStats} title="Статистика" aria-label="Статистика" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
          <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
        </button>
        {(status === 'published' || status === 'completed') && survey.publicSlug && (
          <>
            <button onClick={onCopyLink} title="Скопировать ссылку" aria-label="Скопировать ссылку" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
              <Link2 className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button onClick={() => setShowQr(true)} title="QR-код" aria-label="QR-код" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
              <QrCode className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button onClick={onOpen} title="Открыть" aria-label="Открыть" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </>
        )}
        <button onClick={onDuplicate} title="Дублировать" aria-label="Дублировать" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0">
          <Copy className="w-3.5 h-3.5 text-gray-400" />
        </button>
        <button onClick={onDelete} title="Удалить" aria-label="Удалить" className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 nx-press flex-shrink-0" style={{ color: '#ff6b6b' }}>
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
    </div>

    {/* Статус — фиксированная выпадашка */}
    {openStatus && statusPos && (
      <div
        className="fixed rounded-xl overflow-hidden"
        style={{ left: statusPos.x, top: statusPos.y, zIndex: 300, minWidth: 150, background: 'rgba(20,20,35,0.98)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {STATUS_ORDER.map((st) => (
          <button
            key={st}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenStatus(false);
              if (status !== st) onSetStatus(st);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left nx-press hover:bg-white/5"
            style={{ color: STATUS_META[st].color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_META[st].color }} />
            <span className="font-mono text-[10px]">{STATUS_META[st].label}</span>
          </button>
        ))}
      </div>
    )}

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
