import { useMemo, useState } from 'react';
import { AnimatedNumber } from './useCountUp';

export interface ChoiceStat {
  option: string;
  count: number;
  percent: number;
}

type View = 'pie3d' | 'bars';

const PALETTE = [
  { a: '#00e676', b: '#008a3e' },
  { a: '#00e5ff', b: '#0077a8' },
  { a: '#b388ff', b: '#5c2fd6' },
  { a: '#ffab40', b: '#c45c00' },
  { a: '#ff6bb5', b: '#b0106a' },
  { a: '#ffe066', b: '#c99700' },
  { a: '#5cf0c8', b: '#0d9b72' },
  { a: '#8ab4ff', b: '#2d5fc4' },
  { a: '#ff8a80', b: '#c23a2e' },
  { a: '#c5c5d1', b: '#6b6b80' },
];

function pair(i: number) {
  return PALETTE[i % PALETTE.length];
}

/** 3D pie — fixed full-circle & zero slices, gradient fills */
function Pie3D({ data, total }: { data: ChoiceStat[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 360;
  const H = 250;
  const cx = W / 2;
  const cy = 120;
  const r = 94;
  const depth = 16;

  const slices = useMemo(() => {
    const live = data.filter((d) => d.count > 0);
    const sum = live.reduce((s, d) => s + d.count, 0) || 1;
    let acc = -Math.PI / 2;
    return live.map((d, i) => {
      const frac = d.count / sum;
      // full 360° slice (only one real answer) — special path
      const full = frac >= 0.999;
      const ang = full ? Math.PI * 2 - 0.001 : frac * Math.PI * 2;
      const a0 = acc;
      const a1 = acc + ang;
      if (!full) acc = a1;
      else acc = a1;
      return { ...d, a0, a1: full ? a0 + Math.PI * 2 : a1, full, color: pair(i) };
    });
  }, [data]);

  const arcPath = (a0: number, a1: number, rr = r, full = false) => {
    const rx = rr;
    const ry = rr * 0.62;
    if (full || a1 - a0 >= Math.PI * 2 - 0.01) {
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} Z`;
    }
    const x0 = cx + rx * Math.cos(a0);
    const y0 = cy + ry * Math.sin(a0);
    const x1 = cx + rx * Math.cos(a1);
    const y1 = cy + ry * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${rx} ${ry} 0 ${large} 1 ${x1} ${y1} Z`;
  };

  const lift = hover !== null ? 6 : 0;
  const hov = hover !== null ? slices[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 255 }}>
        <defs>
          <filter id="pieSh" x="-25%" y="-25%" width="150%" height="170%">
            <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#000" floodOpacity="0.4" />
          </filter>
          <radialGradient id="pieGloss" cx="32%" cy="28%" r="75%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
          </radialGradient>
          {slices.map((s, i) => (
            <linearGradient key={i} id={`pg${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={s.color.a} />
              <stop offset="100%" stopColor={s.color.b} />
            </linearGradient>
          ))}
        </defs>

        {/* extrusion */}
        {[0.3, 0.6, 1].map((k, li) => (
          <g key={li} transform={`translate(0 ${(depth + lift) * k})`}>
            {slices.map((s, i) => (
              <path
                key={i}
                d={arcPath(s.a0, s.a1, r, s.full)}
                fill={s.color.b}
                opacity={0.45 + k * 0.3}
              />
            ))}
          </g>
        ))}

        {/* top faces */}
        <g filter="url(#pieSh)">
          {slices.map((s, i) => (
            <path
              key={i}
              d={arcPath(s.a0, s.a1, r, s.full)}
              fill={`url(#pg${i})`}
              stroke="#0c0e14"
              strokeWidth="2"
              opacity={hover === null || hover === i ? 1 : 0.48}
              style={{ transition: 'opacity .2s ease', cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          {slices.map((s, i) => (
            <path key={`g${i}`} d={arcPath(s.a0, s.a1, r, s.full)} fill="url(#pieGloss)" pointerEvents="none" />
          ))}
        </g>

        <text x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontSize="24" fontWeight="700" fontFamily="monospace">
          {total}
        </text>
        <text x={cx} y={cy + 24} textAnchor="middle" fill="#8b8b9a" fontSize="10" fontFamily="monospace">
          чел.
        </text>
      </svg>

      {hov && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-xl font-mono text-[10px] z-10"
          style={{
            left: '50%', top: 0, transform: 'translateX(-50%)',
            background: 'rgba(10,12,18,0.96)',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.5)',
            maxWidth: 250,
            animation: 'tipIn .15s ease',
          }}
        >
          <div className="text-white font-semibold leading-snug mb-0.5" style={{ wordBreak: 'break-word' }}>
            {hov.option}
          </div>
          <div style={{ color: hov.color.a }}>
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
        const c = pair(i);
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
                style={{ color: hov ? c.a : '#c8c8d0', flex: 1, minWidth: 0, wordBreak: 'break-word' }}
              >
                {d.option}
              </span>
              <span className="font-mono text-[11px] tabular-nums shrink-0" style={{ color: c.a }}>
                <AnimatedNumber value={d.percent} decimals={1} suffix="% · " />
                <AnimatedNumber value={d.count} /> чел.
              </span>
            </div>
            <div
              className="rounded-full overflow-hidden transition-all duration-200"
              style={{
                height: hov ? 12 : 10,
                background: 'rgba(255,255,255,0.06)',
                boxShadow: hov ? `0 0 14px ${c.a}55` : 'none',
              }}
            >
              <div
                className="h-full rounded-full transition-[width,filter] duration-500"
                style={{
                  width: `${Math.min(100, (d.percent / max) * 100)}%`,
                  background: `linear-gradient(90deg, ${c.b}, ${c.a})`,
                  filter: hov ? 'brightness(1.15)' : 'none',
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

export default function SurveyChartView({ title, data, view, onViewChange, showViewControl }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="glass rounded-2xl p-4 space-y-3 transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
      <style>{`@keyframes tipIn { from { opacity: 0; transform: translateX(-50%) translateY(-4px); } to { opacity: 1; transform: translateX(-50%); } }`}</style>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-sm font-semibold text-gray-200 leading-snug min-w-0" style={{ wordBreak: 'break-word' }}>
          {title}
        </h3>
        {showViewControl && onViewChange && (
          <div className="relative shrink-0">
            <select
              value={view}
              onChange={(e) => onViewChange(e.target.value as View)}
              className="px-2 py-1.5 rounded-lg font-mono text-[10px] bg-black/40 border border-white/10 text-gray-200 focus:outline-none hover:border-white/25 transition-all hover:scale-105 cursor-pointer"
              style={{ minWidth: 120 }}
            >
              <option value="bars">Гистограмма</option>
              <option value="pie3d">Круговая 3D</option>
            </select>
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="font-mono text-[10px] text-gray-600">нет ответов</p>
      ) : view === 'pie3d' ? (
        <div className="space-y-3">
          <Pie3D data={data} total={total} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {data.filter((d) => d.count > 0).map((d, i) => {
              const c = pair(i);
              return (
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
                    style={{ background: `linear-gradient(135deg, ${c.a}, ${c.b})` }}
                  />
                  <span className="text-gray-300 flex-1 min-w-0" style={{ wordBreak: 'break-word' }}>
                    {d.option}
                  </span>
                  <span className="tabular-nums shrink-0" style={{ color: c.a }}>
                    {d.percent.toFixed(1)}% ({d.count} чел.)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Bars data={data} />
      )}
    </div>
  );
}

export type ChartView = View;
