interface Props {
  byDay: { date: string; count: number }[];
  title?: string;
}

/** Simple vote-per-day bars (last 30 days) */
export default function SurveyDailyChart({ byDay, title = 'ДИНАМИКА ГОЛОСОВ (30 ДНЕЙ)' }: Props) {
  if (!byDay?.length) return null;
  const max = Math.max(1, ...byDay.map((d) => d.count));
  return (
    <div className="glass rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">{title}</h3>
        <span className="font-mono text-[9px] text-gray-600">макс. {max} чел.</span>
      </div>
      <div className="flex items-end gap-[2px] h-20">
        {byDay.map((d) => (
          <div
            key={d.date}
            className="flex-1 rounded-t-[2px] transition-all"
            title={`${d.date}: ${d.count} чел.`}
            style={{
              height: `${Math.max(2, (d.count / max) * 100)}%`,
              background: d.count ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
              opacity: d.count ? 0.85 : 1,
              minWidth: 2,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[8px] text-gray-600">
        <span>{byDay[0]?.date?.slice(5)}</span>
        <span>{byDay[byDay.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}
