import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#00ff88', '#00d4ff', '#eab308', '#bf00ff', '#ff6b6b', '#3b82f6', '#f97316', '#14b8a6'];

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

/** Charts / answer list for one question */
export default function SurveyCharts({ title, type, total, distribution, openAnswers }: Props) {
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-mono text-xs font-bold text-gray-200">{title}</h3>
        <span className="font-mono text-[9px] text-gray-500 shrink-0">
          {type === 'choice' ? `${total} выбрали` : `${openAnswers.length} ответов`}
        </span>
      </div>

      {type === 'choice' ? (
        total === 0 ? (
          <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="count"
                    nameKey="option"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {distribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={distribution} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="option"
                    width={90}
                    tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#00ff88" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {distribution.map((d, i) => (
                <div key={d.option}>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-gray-300 truncate">{d.option}</span>
                    <span style={{ color: COLORS[i % COLORS.length] }}>{d.percent}% · {d.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.percent}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {openAnswers.length === 0 && (
            <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
          )}
          {openAnswers.map((a, i) => (
            <div key={i} className="px-2 py-1.5 rounded text-xs text-gray-300" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {a}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
