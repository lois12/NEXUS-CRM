import { useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import SmartImage from '../ui/SmartImage';
import type { Survey } from '../../services/surveyApi';

interface Props {
  name: string;
  description: string;
  imageUrl: string;
  isAnonymous: boolean;
  thanksText: string;
  thanksRedirectUrl: string;
  onChange: (patch: Partial<Survey>) => void;
  onUploadCover: (file: File) => void;
}

const FIELD = 'w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]';
const LABEL = 'text-[10px] font-mono text-gray-500 tracking-wider';

/** textarea растёт по содержимому */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/** Survey meta: name, description, cover, anonymity, thanks */
export default function SurveyMetaFields({
  name, description, imageUrl, isAnonymous, thanksText, thanksRedirectUrl, onChange, onUploadCover,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL}>НАЗВАНИЕ *</label>
        <textarea
          value={name}
          onChange={(e) => { onChange({ name: e.target.value }); autoGrow(e.target); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          rows={1}
          ref={autoGrow}
          className={`${FIELD} resize-none overflow-hidden`}
          placeholder="Например: Оценка мероприятия"
        />
      </div>
      <div>
        <label className={LABEL}>ОПИСАНИЕ</label>
        <textarea
          value={description}
          onChange={(e) => { onChange({ description: e.target.value }); autoGrow(e.target); }}
          rows={2}
          ref={autoGrow}
          className={`${FIELD} resize-none overflow-hidden`}
        />
      </div>
      <div>
        <label className={LABEL}>ОБЛОЖКА</label>
        <div className="flex items-center gap-2 min-h-[48px]">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setPreview(URL.createObjectURL(f));
              onUploadCover(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-ghost nx-press px-3 py-2 text-[10px]"
          >
            <ImageIcon className="w-3.5 h-3.5 inline mr-1" /> {(imageUrl || preview) ? 'ЗАМЕНИТЬ' : 'ЗАГРУЗИТЬ'}
          </button>
          {(preview || imageUrl) && (
            <SmartImage loading="lazy" src={preview || imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
          )}
        </div>
      </div>
      {/* Анонимность — тогл */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="min-w-0">
          <div className="text-sm text-gray-200">{isAnonymous ? 'Анонимный опрос' : 'С указанием контактов'}</div>
          <div className="text-[10px] font-mono text-gray-500">
            {isAnonymous ? 'ответы без ФИО и контактов' : 'ФИО / телефон / email'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isAnonymous}
          aria-label="Анонимный опрос"
          onClick={() => onChange({ isAnonymous: !isAnonymous })}
          className="relative w-[52px] h-[30px] rounded-full transition-colors duration-200 flex-shrink-0 nx-press"
          style={{
            background: isAnonymous ? 'var(--color-primary)' : 'rgba(255,255,255,0.12)',
            boxShadow: isAnonymous ? '0 0 16px var(--color-glow, rgba(0,255,136,0.35))' : 'inset 0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          <span
            className="absolute top-[3px] left-[3px] w-6 h-6 rounded-full bg-white transition-transform duration-200"
            style={{
              transform: isAnonymous ? 'translateX(22px)' : 'translateX(0)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            }}
          />
        </button>
      </div>
      <div>
        <label className={LABEL}>ТЕКСТ ПОСЛЕ ОТПРАВКИ (5 сек → редирект)</label>
        <textarea
          value={thanksText}
          onChange={(e) => { onChange({ thanksText: e.target.value }); autoGrow(e.target); }}
          rows={2}
          ref={autoGrow}
          placeholder="Спасибо что уделили время и проши опрос…"
          className={`${FIELD} resize-none overflow-hidden`}
        />
      </div>
      <div>
        <label className={LABEL}>КУДА РЕДИРЕКТ (через 5 сек)</label>
        <input
          value={thanksRedirectUrl}
          onChange={(e) => onChange({ thanksRedirectUrl: e.target.value })}
          placeholder="https://visit-norilsk.ru"
          className={FIELD}
        />
      </div>
    </div>
  );
}
