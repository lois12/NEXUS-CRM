import { useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { Survey } from '../../services/surveyApi';

interface Props {
  name: string;
  description: string;
  imageUrl: string;
  isAnonymous: boolean;
  thanksText: string;
  thanksRedirectUrl: string;
  publicSlug: string;
  onChange: (patch: Partial<Survey>) => void;
  onUploadCover: (file: File) => void;
}

/** Survey meta: name, description, cover, anonymity, custom /opros path, thanks */
export default function SurveyMetaFields({
  name, description, imageUrl, isAnonymous, thanksText, thanksRedirectUrl, publicSlug, onChange, onUploadCover,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <label className="font-mono text-xs text-gray-500 block">ДАННЫЕ ОПРОСА</label>
      <div>
        <label className="font-mono text-[10px] text-gray-500 mb-1 block">НАЗВАНИЕ *</label>
        <input
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full px-2 py-2 rounded font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
          placeholder="Например: Оценка мероприятия"
        />
      </div>
      <div>
        <label className="font-mono text-[10px] text-gray-500 mb-1 block">ОПИСАНИЕ</label>
        <textarea
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none resize-none"
        />
      </div>
      <div>
        <label className="font-mono text-[10px] text-gray-500 mb-1 block">ОБЛОЖКА</label>
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
          className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-[11px] glass hover:bg-white/10"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          {(imageUrl || preview) ? 'Заменить обложку' : 'Загрузить обложку'}
        </button>
        {(preview || imageUrl) && (
          <img
            src={preview || imageUrl}
            alt=""
            className="mt-2 w-full max-h-32 object-cover rounded-lg border border-white/10"
          />
        )}
      </div>
      <div>
        <label className="font-mono text-[10px] text-gray-500 mb-1 block">АДРЕС СТРАНИЦЫ (/opros/…)</label>
        <div className="flex items-center gap-0">
          <span className="px-2 py-2 rounded-l-lg font-mono text-[11px] text-gray-400 border border-r-0 border-gray-700 bg-white/5">
            /opros/
          </span>
          <input
            value={publicSlug}
            onChange={(e) => onChange({ publicSlug: e.target.value.toLowerCase().replace(/[^a-z0-9а-яё_-]/g, '-') })}
            placeholder="ocenka-meropriyatiya"
            className="flex-1 px-2 py-2 rounded-r-lg font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
          />
        </div>
        <p className="font-mono text-[9px] text-gray-600 mt-1">
          латиница/цифры/дефис · пользователи откроют {typeof window !== 'undefined' ? window.location.origin : ''}/opros/{publicSlug || '…'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange({ isAnonymous: !isAnonymous })}
        className="w-full py-2 rounded-lg font-mono text-xs transition-all"
        style={isAnonymous
          ? { background: 'var(--color-primary)', color: '#000' }
          : { background: 'rgba(255,255,255,0.05)', color: '#888' }}
      >
        {isAnonymous ? '✓ АНОНИМНЫЙ ОПРОС' : 'ИДЕНТИФИЦИРОВАННЫЙ (ФИО / телефон / email)'}
      </button>
      <div>
        <label className="font-mono text-[10px] text-gray-500 mb-1 block">ТЕКСТ ПОСЛЕ ОТПРАВКИ (5 сек → редирект)</label>
        <textarea
          value={thanksText}
          onChange={(e) => onChange({ thanksText: e.target.value })}
          rows={2}
          placeholder="Спасибо что уделили время и проши опрос…"
          className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none resize-none"
        />
      </div>
      <div>
        <label className="font-mono text-[10px] text-gray-500 mb-1 block">КУДА РЕДИРЕКТ (через 5 сек)</label>
        <input
          value={thanksRedirectUrl}
          onChange={(e) => onChange({ thanksRedirectUrl: e.target.value })}
          placeholder="https://visit-norilsk.ru"
          className="w-full px-2 py-2 rounded font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none"
        />
      </div>
    </div>
  );
}
