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
        <input
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={FIELD}
          placeholder="Например: Оценка мероприятия"
        />
      </div>
      <div>
        <label className={LABEL}>ОПИСАНИЕ</label>
        <textarea
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className={`${FIELD} resize-none`}
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
      <button
        type="button"
        onClick={() => onChange({ isAnonymous: !isAnonymous })}
        className="w-full py-2.5 rounded-xl text-sm transition-all nx-press"
        style={isAnonymous
          ? { background: 'var(--color-primary)', color: '#000' }
          : { background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {isAnonymous ? '✓ АНОНИМНЫЙ ОПРОС' : 'ИДЕНТИФИЦИРОВАННЫЙ (ФИО / телефон / email)'}
      </button>
      <div>
        <label className={LABEL}>ТЕКСТ ПОСЛЕ ОТПРАВКИ (5 сек → редирект)</label>
        <textarea
          value={thanksText}
          onChange={(e) => onChange({ thanksText: e.target.value })}
          rows={2}
          placeholder="Спасибо что уделили время и проши опрос…"
          className={`${FIELD} resize-none`}
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
