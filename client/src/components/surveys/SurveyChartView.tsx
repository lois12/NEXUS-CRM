import { useMemo, useState } from 'react';
import { AnimatedNumber } from './useCountUp';

export interface ChoiceStat {
  option: string;
  count: number;
  percent: number;
}

type View = 'pie3d' | 'bars';

const COLORS = [
  '#00c853', '#00bcd4', '#7c5cff', '#ff8a3d', '#e91e63',
  '#ffd54f', '#26c6da', '#a5d6a7', '#ef5350', '#90a4ae',
];

/** Extruded 3D pie (SVG) with hover lift */
function Pie3D({ data }: { data: ChoiceStat[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const H = 230;
  const cx = W / 2;
  const cy = 112;
  const r = 86;
  const depth = 18;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;

  const slices = useMemo(() => {
    let acc = -Math.PI / 2;
    return data.map((d, i) => {
      const ang = (d.count / total) * Math.PI * 2;
      const a0 = acc;
      const a1 = acc + ang;
      acc = a1;
      return { ...d, a0, a1, color: COLORS[i % COLORS.length] };
    });
  }, [data, total]);

  const arcPath = (a0: number, a1: number, rr = r) => {
    const x0 = cx + rr * Math.cos(a0);
    const y0 = cy + rr * Math.sin(a0) * 0.72;
    const x1 = cx + rr * Math.cos(a1);
    const y1 = cy + rr * Math.sin(a1) * 0.72;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${rr} ${rr * 0.72} 0 ${large} 1 ${x1} ${y1} Z`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 250 }}>
      <defs>
        <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>
      {slices.map((s, i) => (
        <g key={`w${i}`} transform={`translate(0 ${depth + (hover === i ? 4 : 0)})`} opacity={0.55}
          style={{ transition: 'transform .25s ease' }}>
          <path d={arcPath(s.a0, s.a1)} fill={s.color} />
        </g>
      ))}
      {slices.map((s, i) => (
        <g key={`w2${i}`} transform={`translate(0 ${(depth + (hover === i ? 4 : 0)) * 0.55})`} opacity={0.75}
          style={{ transition: 'transform .25s ease' }}>
          <path d={arcPath(s.a0, s.a1)} fill={s.color} />
        </g>
      ))}
      <g filter="url(#pieShadow)">
        {slices.map((s, i) => (
          <path
            key={i}
            d={arcPath(s.a0, s.a1)}
            fill={s.color}
            stroke="rgba(10,12,18,0.85)"
            strokeWidth="1.5"
            opacity={hover === null || hover === i ? 1 : 0.55}
            style={{ transition: 'opacity .25s ease', cursor: 'pointer' }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <ellipse cx={cx} cy={cy - 2} rx={r * 0.98} ry={r * 0.7} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" pointerEvents="none" />
      </g>
    </svg>
  );
}

function Bars({ data }: { data: ChoiceStat[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.percent));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div
          key={d.option}
          className="space-y-1 cursor-default transition-transform"
          style={{ transform: hover === i ? 'translateX(4px)' : 'none' }}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[11px] text-gray-300 truncate min-w-0">{d.option}</span>
            <span className="font-mono text-[11px] tabular-nums shrink-0" style={{ color: COLORS[i % COLORS.length] }}>
              <AnimatedNumber value={d.percent} decimals={1} suffix="% · " />
              <AnimatedNumber value={d.count} /> чел.
            </span>
          </div>
          <div
            className="h-2.5 rounded-full overflow-hidden transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              height: hover === i ? 12 : 10,
            }}
          >
            <div
              className="h-full rounded-full transition-[width,filter] duration-500"
              style={{
                width: `${(d.percent / max) * 100}%`,
                background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}cc, ${COLORS[i % COLORS.length]})`,
                filter: hover === i ? 'brightness(1.15)' : 'none',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  title: string;
  data: ChoiceStat[];
}

/** Chart block with view switcher: 3D pie | linear bars */
export default function SurveyChartView({ title, data }: Props) {
  const [view, setView] = useState<View>('pie3d');
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="glass rounded-2xl p-4 space-y-3 transition-colors duration-300">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-sm font-semibold text-gray-200 leading-snug min-w-0">{title}</h3>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as View)}
          className="shrink-0 px-2 py-1.5 rounded-lg font-mono text-[10px] bg-black/40 border border-white/10 text-gray-200 focus:outline-none hover:border-white/25 transition-colors"
          style={{ minWidth: 120 }}
        >
          <option value="pie3d">Круговая 3D</option>
          <option value="bars">Гистограмма</option>
        </select>
      </div>

      {total === 0 ? (
        <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
      ) : view === 'pie3d' ? (
        <div className="space-y-3">
          <Pie3D data={data} />
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {data.map((d, i) => (
              <div key={d.option} className="flex items-center gap-1.5 font-mono text-[9px] text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate max-w-[120px]">{d.option}</span>
                <span className="tabular-nums" style={{ color: COLORS[i % COLORS.length] }}>
                  <AnimatedNumber value={d.percent} decimals={1} suffix="%" />
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
