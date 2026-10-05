import { useMemo, useState } from 'react';
import { AnimatedNumber } from './useCountUp';

export interface ChoiceStat {
  option: string;
  count: number;
  percent: number;
}

type View = 'pie3d' | 'bars';

const COLORS = [
  '#00c853', '#00d4ff', '#7c5cff', '#ff8a3d', '#e84393',
  '#ffd54f', '#20c997', '#6c9eff', '#ff6b6b', '#b197fc',
];

/** Extruded pie with hover tooltip */
function Pie3D({ data, total }: { data: ChoiceStat[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 360;
  const H = 240;
  const cx = W / 2;
  const cy = 118;
  const r = 92;
  const depth = 16;

  const slices = useMemo(() => {
    let acc = -Math.PI / 2;
    return data.map((d, i) => {
      const ang = (d.count / total) * Math.PI * 2;
      const a0 = acc;
      const a1 = acc + Math.max(ang, 0.001);
      acc = a1;
      return { ...d, a0, a1, color: COLORS[i % COLORS.length] };
    });
  }, [data, total]);

  const arcPath = (a0: number, a1: number, rr = r) => {
    const x0 = cx + rr * Math.cos(a0);
    const y0 = cy + rr * Math.sin(a0) * 0.62;
    const x1 = cx + rr * Math.cos(a1);
    const y1 = cy + rr * Math.sin(a1) * 0.62;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${rr} ${rr * 0.62} 0 ${large} 1 ${x1} ${y1} Z`;
  };

  const hov = hover !== null ? slices[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 250 }}>
        <defs>
          <filter id="pieSh" x="-25%" y="-25%" width="150%" height="170%">
            <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#000" floodOpacity="0.4" />
          </filter>
          <radialGradient id="pieTop" cx="35%" cy="30%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        {/* depth layers */}
        {[0.35, 0.65, 1].map((k, li) => (
          <g key={li} transform={`translate(0 ${(depth + (hover !== null ? 6 : 0)) * k})`}>
            {slices.map((s, i) => (
              <path
                key={i}
                d={arcPath(s.a0, s.a1)}
                fill={s.color}
                opacity={0.35 + k * 0.35}
              />
            ))}
          </g>
        ))}
        {/* top */}
        <g filter="url(#pieSh)">
          {slices.map((s, i) => (
            <path
              key={i}
              d={arcPath(s.a0, s.a1)}
              fill={s.color}
              stroke="#0c0e14"
              strokeWidth="2"
              opacity={hover === null || hover === i ? 1 : 0.5}
              style={{ transition: 'opacity .2s ease', cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          {slices.map((s, i) => (
            <path key={`g${i}`} d={arcPath(s.a0, s.a1)} fill="url(#pieTop)" pointerEvents="none" />
          ))}
        </g>
        {/* center total */}
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="monospace">
          {total}
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" fill="#8b8b9a" fontSize="10" fontFamily="monospace">
          чел.
        </text>
      </svg>
      {/* tooltip */}
      {hov && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-lg font-mono text-[10px] z-10"
          style={{
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            background: 'rgba(8,10,16,0.95)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            maxWidth: 240,
          }}
        >
          <div className="text-white font-semibold leading-snug mb-0.5">{hov.option}</div>
          <div style={{ color: hov.color }}>
            {hov.count} чел. · {hov.percent.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}

function Bars({ data }: { data: ChoiceStat[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.percent));
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const hov = hover === i;
        return (
          <div
            key={d.option}
            className="transition-transform duration-200"
            style={{ transform: hov ? 'translateX(6px)' : 'none' }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <span
                className="font-mono text-[11px] leading-snug"
                style={{ color: hov ? COLORS[i % COLORS.length] : '#c8c8d0', flex: 1, minWidth: 0, wordBreak: 'break-word' }}
              >
                {d.option}
              </span>
              <span className="font-mono text-[11px] tabular-nums shrink-0" style={{ color: COLORS[i % COLORS.length] }}>
                <AnimatedNumber value={d.percent} decimals={1} suffix="% · " />
                <AnimatedNumber value={d.count} /> чел.
              </span>
            </div>
            <div
              className="rounded-full overflow-hidden transition-all duration-200"
              style={{
                height: hov ? 12 : 10,
                background: 'rgba(255,255,255,0.06)',
                boxShadow: hov ? `0 0 12px ${COLORS[i % COLORS.length]}55` : 'none',
              }}
            >
              <div
                className="h-full rounded-full transition-[width,filter] duration-500"
                style={{
                  width: `${(d.percent / max) * 100}%`,
                  background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}aa, ${COLORS[i % COLORS.length]})`,
                  filter: hov ? 'brightness(1.2)' : 'none',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  title: string;
  data: ChoiceStat[];
  view: View;
  onViewChange?: (v: View) => void;
  showViewControl?: boolean;
}

/** Chart block — global view or local switch */
export default function SurveyChartView({ title, data, view, onViewChange, showViewControl }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="glass rounded-2xl p-4 space-y-3 transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-sm font-semibold text-gray-200 leading-snug min-w-0" style={{ wordBreak: 'break-word' }}>
          {title}
        </h3>
        {showViewControl && onViewChange && (
          <select
            value={view}
            onChange={(e) => onViewChange(e.target.value as View)}
            className="shrink-0 px-2 py-1.5 rounded-lg font-mono text-[10px] bg-black/40 border border-white/10 text-gray-200 focus:outline-none hover:border-white/25 transition-colors"
            style={{ minWidth: 120 }}
          >
            <option value="pie3d">Круговая 3D</option>
            <option value="bars">Гистограмма</option>
          </select>
        )}
      </div>

      {total === 0 ? (
        <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
      ) : view === 'pie3d' ? (
        <div className="space-y-3">
          <Pie3D data={data} total={total} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {data.map((d, i) => (
              <div
                key={d.option}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="flex items-start gap-2 font-mono text-[10px] rounded px-1 py-0.5 transition-colors"
                style={{
                  background: hover === i ? 'rgba(255,255,255,0.06)' : 'transparent',
                  cursor: 'default',
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="text-gray-300 flex-1 min-w-0" style={{ wordBreak: 'break-word' }}>
                  {d.option}
                </span>
                <span className="tabular-nums shrink-0" style={{ color: COLORS[i % COLORS.length] }}>
                  {d.percent.toFixed(1)}% ({d.count} чел.)
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Bars data={data} />
      )}
    </div>
  );
}

export type ChartView = View;
