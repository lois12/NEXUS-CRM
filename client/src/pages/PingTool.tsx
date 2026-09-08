import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Play, Square, Trash2, Globe, Clock } from 'lucide-react';
import { formatTimeKR } from '../utils/timezone';

interface PingResult {
  time: string;
  host: string;
  status: 'ok' | 'timeout' | 'error';
  ms?: number;
}

const STATS_LABELS = {
  sent: 'Отправлено',
  received: 'Получено',
  lost: 'Потеряно',
  minMs: 'Мин. пинг',
  maxMs: 'Макс. пинг',
  avgMs: 'Ср. пинг',
};

export default function PingTool() {
  const [host, setHost] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<PingResult[]>([]);
  const [stats, setStats] = useState({ sent: 0, received: 0, lost: 0, minMs: 0, maxMs: 0, avgMs: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [results]);

  const doPing = async (target: string) => {
    const now = new Date();
    const timeStr = formatTimeKR(now);
    try {
      const start = performance.now();
      await fetch(`http://${target}`, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
      const ms = Math.round(performance.now() - start);
      return { time: timeStr, host: target, status: 'ok' as const, ms };
    } catch {
      return { time: timeStr, host: target, status: 'error' as const };
    }
  };

  const startPing = async () => {
    if (!host.trim()) return;
    const target = host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    setHost(target);
    setResults([]);
    setStats({ sent: 0, received: 0, lost: 0, minMs: 0, maxMs: 0, avgMs: 0 });
    setIsRunning(true);
    startTimeRef.current = Date.now();

    const pings: number[] = [];

    const runPing = async () => {
      const result = await doPing(target);
      setResults(prev => [...prev, result]);

      setStats(prev => {
        const sent = prev.sent + 1;
        const received = result.status === 'ok' ? prev.received + 1 : prev.received;
        const lost = sent - received;
        const ms = result.ms || 0;
        if (result.status === 'ok') pings.push(ms);
        const minMs = pings.length > 0 ? Math.min(...pings) : 0;
        const maxMs = pings.length > 0 ? Math.max(...pings) : 0;
        const avgMs = pings.length > 0 ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : 0;
        return { sent, received, lost, minMs, maxMs, avgMs };
      });

      // Stop after 10 seconds
      if (Date.now() - startTimeRef.current >= 10000) {
        stopPing();
      }
    };

    // First ping immediately
    await runPing();
    // Then every 1 second
    intervalRef.current = setInterval(runPing, 1000);
  };

  const stopPing = () => {
    setIsRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const clearLog = () => {
    setResults([]);
    setStats({ sent: 0, received: 0, lost: 0, minMs: 0, maxMs: 0, avgMs: 0 });
  };

  const lossPercent = stats.sent > 0 ? Math.round((stats.lost / stats.sent) * 100) : 0;
  const quality = lossPercent === 0 && stats.avgMs < 50 ? 'Отлично' : lossPercent < 10 && stats.avgMs < 100 ? 'Хорошо' : lossPercent < 30 ? 'Плохо' : 'Критично';
  const qualityColor = lossPercent === 0 && stats.avgMs < 50 ? '#00ff88' : lossPercent < 10 && stats.avgMs < 100 ? '#eab308' : lossPercent < 30 ? '#ff6600' : '#ff3b30';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center glass-accent">
          <Wifi className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>IP PING</h1>
          <p className="text-gray-400 font-mono text-sm">// Проверка качества связи</p>
        </div>
      </div>

      {/* Input */}
      <div className="glass rounded-2xl p-6">
        <label className="block text-xs font-mono mb-2" style={{ color: 'var(--color-primary)' }}>// АДРЕС ИЛИ IP</label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={host}
              onChange={e => setHost(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isRunning && startPing()}
              placeholder="google.com или 8.8.8.8"
              disabled={isRunning}
              className="w-full pl-10 pr-4 py-3 rounded-xl font-mono text-sm nx-input disabled:opacity-50"
            />
          </div>
          {!isRunning ? (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startPing} disabled={!host.trim()}
              className="px-6 py-3 rounded-xl font-mono text-sm font-bold flex items-center gap-2 disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000' }}>
              <Play className="w-4 h-4" /> ПИНГ
            </motion.button>
          ) : (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={stopPing}
              className="px-6 py-3 rounded-xl font-mono text-sm font-bold flex items-center gap-2"
              style={{ background: 'rgba(255,59,48,0.15)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.3)' }}>
              <Square className="w-4 h-4" /> СТОП
            </motion.button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats.sent > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>РЕЗУЛЬТАТЫ</h2>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold" style={{ background: `${qualityColor}15`, color: qualityColor, border: `1px solid ${qualityColor}30` }}>{quality}</span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(STATS_LABELS).map(([key, label]) => (
              <div key={key} className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-lg font-bold font-mono" style={{ color: key.includes('lost') ? (stats.lost > 0 ? '#ff3b30' : '#00ff88') : 'var(--color-primary)' }}>
                  {key === 'minMs' || key === 'maxMs' || key === 'avgMs' ? `${stats[key as keyof typeof stats]}мс` : stats[key as keyof typeof stats]}
                </div>
                <div className="text-[9px] font-mono mt-1" style={{ color: '#5a5a70' }}>{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${100 - lossPercent}%`, background: `linear-gradient(90deg, ${qualityColor}, ${qualityColor}80)` }} />
            </div>
            <span className="text-xs font-mono" style={{ color: qualityColor }}>{100 - lossPercent}%</span>
          </div>
        </motion.div>
      )}

      {/* Log */}
      <div className="glass rounded-2xl p-6 flex flex-col" style={{ minHeight: 300 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
            <Clock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> ЛОГ
          </h2>
          <button onClick={clearLog} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Очистить">
            <Trash2 className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto font-mono text-xs space-y-0.5" style={{ maxHeight: 300 }}>
          {results.length === 0 && (
            <div className="text-center py-8" style={{ color: '#4a4a60' }}>
              <Wifi className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p>Введите адрес и нажмите ПИНГ</p>
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span style={{ color: '#4a4a60' }}>{r.time}</span>
              <span style={{ color: r.status === 'ok' ? '#00ff88' : '#ff3b30' }}>
                {r.status === 'ok' ? `${r.ms}мс` : 'timeout'}
              </span>
              <span style={{ color: '#6a6a80' }}>{r.host}</span>
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 py-1">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-primary)' }} />
              <span style={{ color: 'var(--color-primary)' }}>Пингуется...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
