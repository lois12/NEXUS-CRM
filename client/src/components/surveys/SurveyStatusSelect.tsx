import type { SurveyStatus } from '../../services/surveyApi';

export const STATUS_META: Record<SurveyStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'ЧЕРНОВИК', color: '#9ca3af', bg: 'rgba(255,255,255,0.08)' },
  scheduled: { label: 'ЗАПЛАНИРОВАН', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  published: { label: 'ОПУБЛИКОВАН', color: '#00c853', bg: 'rgba(0,200,83,0.15)' },
  completed: { label: 'ЗАВЕРШЁН', color: '#6c9eff', bg: 'rgba(108,158,255,0.15)' },
};

export const STATUS_ORDER: SurveyStatus[] = ['draft', 'scheduled', 'published', 'completed'];

interface Props {
  value: SurveyStatus;
  onChange: (s: SurveyStatus, opensAt?: string) => void;
  opensAt?: string | null;
  compact?: boolean;
  disabled?: boolean;
  hideOpensAt?: boolean;
}

/** Status dropdown (published / scheduled / completed / draft) */
export default function SurveyStatusSelect({ value, onChange, opensAt, compact, disabled, hideOpensAt }: Props) {
  const meta = STATUS_META[value] || STATUS_META.draft;

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as SurveyStatus)}
        className="w-full px-2 py-2 rounded-lg font-mono text-[11px] bg-white/5 border transition-colors focus:outline-none hover:border-white/25 cursor-pointer"
        style={{
          color: meta.color,
          borderColor: meta.color + '55',
        }}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s} style={{ background: '#141824', color: STATUS_META[s].color }}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>
      {value === 'scheduled' && !hideOpensAt && (
        <input
          type="datetime-local"
          value={opensAt ? toLocalInput(opensAt) : ''}
          onChange={(e) => onChange('scheduled', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          className="w-full px-2 py-1.5 rounded-lg font-mono text-[10px] bg-white/5 border border-white/10 text-gray-200 focus:outline-none"
          placeholder="когда открыть"
        />
      )}
    </div>
  );
}

export function toLocalInput(iso: string) {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
