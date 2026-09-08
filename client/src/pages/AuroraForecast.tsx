import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, MapPin, Clock, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SkeletonGauge, SkeletonBlock } from '../components/ui/Skeleton';

interface KpData { time_tag: string; Kp: number; a_running: number; station_count: number; }

const KP_LEVELS = [
  { min: 0, max: 2, label: 'СПОКОЙНО', color: '#4a4a60', desc: 'Нет сияния', chance: '0%' },
  { min: 2, max: 3, label: 'СЛАБАЯ', color: '#3b82f6', desc: 'Малый шанс', chance: '~10%' },
  { min: 3, max: 4, label: 'УМЕРЕННАЯ', color: '#00ff88', desc: 'Возможно сияние', chance: '~40%' },
  { min: 4, max: 5, label: 'СИЛЬНАЯ', color: '#eab308', desc: 'Хороший шанс', chance: '~70%' },
  { min: 5, max: 6, label: 'БУРЯ G1', color: '#ff8c00', desc: 'Высокая вероятность', chance: '~85%' },
  { min: 6, max: 7, label: 'БУРЯ G2', color: '#ff3b30', desc: 'Очень высокая', chance: '~95%' },
  { min: 7, max: 9, label: 'БУРЯ G3+', color: '#ff00ff', desc: 'Экстремальная', chance: '~100%' },
];

function getKpLevel(kp: number) { return KP_LEVELS.find(l => kp >= l.min && kp < l.max) || KP_LEVELS[KP_LEVELS.length - 1]; }
function fmtTime(iso: string) { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }

const CyberTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const lvl = getKpLevel(v);
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(10,10,15,0.95)', border: `1px solid ${lvl.color}40`, backdropFilter: 'blur(12px)' }}>
      <p className="font-mono text-[10px] text-gray-400 mb-1">{label}</p>
      <p className="font-mono text-sm font-bold" style={{ color: lvl.color }}>Kp {v.toFixed(1)}</p>
      <p className="font-mono text-[10px] text-gray-500">{lvl.label} — {lvl.chance}</p>
    </div>
  );
};

export default function AuroraForecast() {
  const [data, setData] = useState<KpData[]>([]);
  const [forecast, setForecast] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    setScanning(true);
    setError('');
    const startTime = Date.now();
    try {
      const [kpRes, fcRes] = await Promise.all([
        fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
        fetch('https://services.swpc.noaa.gov/text/3-day-forecast.txt'),
      ]);
      if (kpRes.ok) { const json = await kpRes.json(); setData(json.slice(1)); setLastUpdate(new Date().toLocaleString('ru-RU')); }
      if (fcRes.ok) setForecast(await fcRes.text());
    } catch { setError('Не удалось загрузить данные NOAA'); }
    finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1000 - elapsed);
      setTimeout(() => { setIsLoading(false); setScanning(false); }, remaining);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const current = data.length > 0 ? data[data.length - 1] : null;
  const currentKp = current?.Kp ?? 0;
  const level = getKpLevel(currentKp);

  // Chart data — last 24h
  const chartData = data.slice(-8).map(d => ({
    time: new Date(d.time_tag).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    kp: d.Kp,
    fill: getKpLevel(d.Kp).color,
  }));

  // Parse forecast
  const fcLines = forecast.split('\n');
  const fcTable = fcLines.filter(l => l.match(/^\d{2}-\d{2}UT/)).map(line => {
    const p = line.trim().split(/\s+/);
    return { time: p[0], d1: parseFloat(p[1]) || 0, d2: parseFloat(p[2]) || 0, d3: parseFloat(p[3]) || 0 };
  });
  const nextMax = fcTable.reduce((m, r) => Math.max(m, r.d1, r.d2, r.d3), 0);
  const nextLevel = getKpLevel(nextMax);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Aurora animated background */}
      <div className="aurora-bg" />

      <div className="relative z-10 space-y-6">
        {/* Scan line overlay */}
        <AnimatePresence>
          {scanning && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
              <motion.div
                initial={{ top: '-2px' }}
                animate={{ top: '100%' }}
                transition={{ duration: 1, ease: 'linear' }}
                className="absolute left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)', boxShadow: '0 0 20px var(--color-primary), 0 0 40px var(--color-glow)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-mono flex items-center gap-3" style={{ color: 'var(--color-primary)', textShadow: '0 0 30px rgba(0,255,136,0.4)' }}>
              <Sparkles className="w-7 h-7 md:w-8 md:h-8" /> AURORA FORECAST
            </h1>
            <p className="text-gray-400 mt-1 font-mono text-sm">// НОРИЛЬСК 69.35°N • Kp-ИНДЕКС • NOAA SWPC</p>
          </div>
          <button onClick={fetchData} disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm glass hover:bg-white/10 transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> ОБНОВИТЬ
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
            <AlertTriangle className="w-5 h-5 text-red-400" /><span className="font-mono text-xs text-red-400">{error}</span>
          </div>
        )}

        {/* Skeleton loading (first load) */}
        {isLoading && data.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
              <SkeletonGauge />
            </div>
            <div className="lg:col-span-2 glass rounded-2xl p-6 space-y-4">
              <SkeletonBlock height="h-5" className="w-40" />
              <SkeletonBlock height="h-48" className="w-full" />
            </div>
          </div>
        )}

        {/* Real content */}
        {(!isLoading || data.length > 0) && (<>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Current gauge */}
          <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
            <motion.div animate={{ boxShadow: `0 0 ${30 + currentKp * 10}px ${level.color}50, inset 0 0 20px ${level.color}10` }}
              className="w-36 h-36 rounded-full flex items-center justify-center"
              style={{ background: `radial-gradient(circle, ${level.color}20, transparent)`, border: `3px solid ${level.color}60` }}>
              <div className="text-center">
                <div className="font-mono text-5xl font-bold" style={{ color: level.color, textShadow: `0 0 30px ${level.color}80` }}>{currentKp.toFixed(1)}</div>
                <div className="font-mono text-[10px] text-gray-400 mt-1">Kp ИНДЕКС</div>
              </div>
            </motion.div>
            <div className="text-center space-y-1">
              <span className="font-mono text-sm font-bold px-3 py-1 rounded-lg inline-block" style={{ background: `${level.color}20`, color: level.color }}>{level.label}</span>
              <p className="font-mono text-xs text-gray-400">{level.desc}</p>
              <div className="flex items-center gap-1 justify-center mt-2">
                <MapPin className="w-3 h-3 text-gray-500" />
                <span className="font-mono text-xs text-gray-300">Норильск: <span className="font-bold" style={{ color: level.color }}>{level.chance}</span></span>
              </div>
              {current && (
                <div className="flex items-center gap-1 justify-center">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span className="font-mono text-[10px] text-gray-500">{fmtTime(current.time_tag)} UTC</span>
                </div>
              )}
            </div>
          </div>

          {/* 24h chart — wide */}
          <div className="lg:col-span-2 glass rounded-2xl p-6">
            <h2 className="font-mono text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
              Kp ЗА 24 ЧАСА
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="auroraGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ff88" stopOpacity={0.4} />
                    <stop offset="30%" stopColor="#00d4ff" stopOpacity={0.2} />
                    <stop offset="60%" stopColor="#bf00ff" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fill: '#5a5a70', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 9]} tick={{ fill: '#5a5a70', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CyberTooltip />} />
                <ReferenceLine y={3} stroke="rgba(0,255,136,0.3)" strokeDasharray="5 5" label={{ value: 'Норильск Kp 3', position: 'right', fill: '#00ff88', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
                <Area type="monotone" dataKey="kp" stroke="#00ff88" strokeWidth={2} fill="url(#auroraGrad)"
                  dot={(props: any) => {
                    const v = props.payload.kp;
                    const c = getKpLevel(v).color;
                    return <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill={c} stroke={c} strokeWidth={2} style={{ filter: `drop-shadow(0 0 4px ${c})` }} />;
                  }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3-day forecast */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-mono text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
            <Clock className="w-4 h-4" /> ПРОГНОЗ 3 ДНЯ
          </h2>
          {fcTable.length > 0 ? (
            <div className="overflow-x-auto -mx-2 px-2">
              <div className="grid grid-cols-4 gap-2" style={{ minWidth: 420 }}>
                {/* Header */}
                <div className="font-mono text-[10px] text-gray-500 px-2 py-1">ВРЕМЯ</div>
                <div className="font-mono text-[10px] text-gray-500 text-center px-2 py-1">СЕГОДНЯ</div>
                <div className="font-mono text-[10px] text-gray-500 text-center px-2 py-1">ЗАВТРА</div>
                <div className="font-mono text-[10px] text-gray-500 text-center px-2 py-1">ПОСЛЕЗАВТРА</div>
                {/* Rows */}
                {fcTable.map((row, i) => (
                  <div key={i} className="contents">
                    <div className="font-mono text-[10px] text-gray-400 px-2 py-2 border-t border-white/[0.03]">{row.time}</div>
                    {[row.d1, row.d2, row.d3].map((v, j) => {
                      const lvl = getKpLevel(v);
                      return (
                        <div key={j} className="text-center px-2 py-2 border-t border-white/[0.03]">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded inline-block min-w-[40px]" style={{ background: `${lvl.color}15`, color: lvl.color, textShadow: v >= 3 ? `0 0 6px ${lvl.color}40` : 'none' }}>{v.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="font-mono text-xs text-gray-500">Загрузка...</p>}
          <div className="mt-4 p-3 rounded-lg flex items-center gap-3" style={{ background: `${nextLevel.color}08`, border: `1px solid ${nextLevel.color}20` }}>
            <span className="font-mono text-xs text-gray-400">Макс. ближайшие 24ч:</span>
            <span className="font-mono text-lg font-bold" style={{ color: nextLevel.color, textShadow: `0 0 10px ${nextLevel.color}40` }}>{nextMax.toFixed(1)}</span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded" style={{ background: `${nextLevel.color}20`, color: nextLevel.color }}>{nextLevel.label}</span>
            <span className="font-mono text-[10px] text-gray-500 ml-auto">Норильск: {nextLevel.chance}</span>
          </div>
        </div>

        {/* Kp scale */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-mono text-sm font-bold mb-4" style={{ color: 'var(--color-primary)' }}>ШКАЛА Kp</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {KP_LEVELS.map((l, i) => (
              <div key={i} className="p-3 rounded-lg text-center transition-all hover:scale-105" style={{ background: `${l.color}10`, border: `1px solid ${l.color}25` }}>
                <div className="font-mono text-xl font-bold" style={{ color: l.color, textShadow: `0 0 8px ${l.color}40` }}>{l.min}-{l.max}</div>
                <div className="font-mono text-[10px] font-bold mt-1" style={{ color: l.color }}>{l.label}</div>
                <div className="font-mono text-[9px] text-gray-500 mt-0.5">Норильск: {l.chance}</div>
              </div>
            ))}
          </div>
        </div>
        </>
        )}

        {lastUpdate && <p className="text-center font-mono text-[10px] text-gray-600">Данные NOAA SWPC • Обновлено: {lastUpdate}</p>}
      </div>
    </div>
  );
}
