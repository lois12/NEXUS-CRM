export interface ChoiceStat {
  option: string;
  count: number;
  percent: number;
}

interface Props {
  title: string;
  type: 'choice' | 'open';
  total: number;
  distribution: ChoiceStat[];
  openAnswers: string[];
}

/** Clean percent bars (no charts) + open answers list */
export default function SurveyCharts({ title, type, total, distribution, openAnswers }: Props) {
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-[13px] font-bold text-gray-200 leading-snug">{title}</h3>
        <span className="font-mono text-[9px] text-gray-500 shrink-0 pt-0.5">
          {type === 'choice' ? `${total} чел.` : `${openAnswers.length} чел.`}
        </span>
      </div>

      {type === 'choice' ? (
        total === 0 ? (
          <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
        ) : (
          <div className="space-y-2.5">
            {distribution.map((d) => (
              <div key={d.option} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[11px] text-gray-300 truncate min-w-0">{d.option}</span>
                  <span className="font-mono text-[11px] tabular-nums shrink-0" style={{ color: 'var(--color-primary)' }}>
                    {d.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${d.percent}%`, background: 'var(--color-primary)', opacity: 0.85 }}
                  />
                </div>
                <div className="font-mono text-[9px] text-gray-600">{d.count} чел.</div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {openAnswers.length === 0 && (
            <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
          )}
          {openAnswers.map((a, i) => (
            <div
              key={i}
              className="px-2.5 py-2 rounded-lg font-mono text-[11px] text-gray-300 leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              {a}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
