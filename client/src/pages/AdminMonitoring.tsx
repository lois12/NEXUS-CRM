import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Server, Cpu, HardDrive, Database, Clock, Activity,
  RefreshCw, MemoryStick, Globe, Zap, Wrench, AlertTriangle,
} from 'lucide-react';
import { dashboardApi } from '../services/api';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#6b7280' }}>{label}</div>
        <div className="text-sm font-mono font-bold" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span style={{ color: '#6b7280' }}>{label}</span>
        <span style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
        />
      </div>
    </div>
  );
}

export default function AdminMonitoring() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [maintenance, setMaintenance] = useState(false);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const [healthRes, maintRes] = await Promise.all([
        dashboardApi.getHealth(),
        dashboardApi.getMaintenance(),
      ]);
      if (healthRes.success) setHealth(healthRes.data);
      else setError('Ошибка загрузки');
      if (maintRes.success && maintRes.data) setMaintenance(maintRes.data.active);
    } catch {
      setError('Нет доступа или сервер недоступен');
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenance = async () => {
    try {
      const res = await dashboardApi.toggleMaintenance();
      if (res.success && res.data) setMaintenance(res.data.active);
    } catch {}
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-full max-w-64 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <div className="h-4 w-full max-w-96 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Server className="w-16 h-16 mx-auto mb-4 text-gray-500" />
        <p className="font-mono text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!health) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <Activity className="w-7 h-7 md:w-8 md:h-8" />
            УПРАВЛЕНИЕ NEXUS
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-xs sm:text-sm">// МОНИТОРИНГ СЕРВЕРА И СИСТЕМЫ</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={fetchHealth}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--color-primary)' }} />
          </button>
          <button
            onClick={toggleMaintenance}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-bold transition-all"
            style={maintenance
              ? { backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }
              : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            <Wrench className="w-4 h-4" />
            {maintenance ? 'ОТКЛЮЧИТЬ ТО' : 'ТЕХОБСЛУЖИВАНИЕ'}
          </button>
        </div>
      </div>

      {/* Maintenance banner */}
      {maintenance && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#eab308' }} />
          <div>
            <p className="font-mono text-sm font-bold" style={{ color: '#eab308' }}>РЕЖИМ ТЕХОБСЛУЖИВАНИЯ АКТИВЕН</p>
            <p className="font-mono text-xs" style={{ color: '#6b7280' }}>Все пользователи кроме super_admin видят экран обслуживания</p>
          </div>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Clock} label="Uptime" value={health.uptime.formatted} color="#00ff88" />
        <StatCard icon={Cpu} label="CPU" value={`${health.cpu.cores} cores`} color="#00d4ff" />
        <StatCard icon={MemoryStick} label="Heap" value={formatBytes(health.memory.heapUsed)} color="#bf00ff" />
        <StatCard icon={Database} label="БД" value={formatBytes(health.database.size)} color="#eab308" />
        <StatCard icon={HardDrive} label="Uploads" value={`${health.uploads.count} файлов`} color="#ff6b6b" />
        <StatCard icon={Globe} label="ОС" value={`${health.platform.os} ${health.platform.arch}`} color="#6b7280" />
        <StatCard icon={Server} label="Node.js" value={health.platform.nodeVersion} color="#3b82f6" />
        <StatCard icon={Zap} label="Hostname" value={health.platform.hostname} color="#a78bfa" />
      </div>

      {/* Memory & CPU */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4 space-y-3">
          <h3 className="font-mono text-xs font-bold tracking-wider" style={{ color: '#6b7280' }}>ПАМЯТЬ</h3>
          <ProgressBar value={health.memory.heapUsed} max={health.memory.heapTotal} color="#00ff88" label="Heap" />
          <ProgressBar value={health.memory.systemUsed} max={health.memory.systemTotal} color="#00d4ff" label="Система" />
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono" style={{ color: '#6b7280' }}>
            <div>Heap: {formatBytes(health.memory.heapUsed)} / {formatBytes(health.memory.heapTotal)}</div>
            <div>Система: {formatBytes(health.memory.systemUsed)} / {formatBytes(health.memory.systemTotal)}</div>
          </div>
        </div>

        <div className="glass rounded-xl p-4 space-y-3">
          <h3 className="font-mono text-xs font-bold tracking-wider" style={{ color: '#6b7280' }}>CPU</h3>
          <div className="text-xs font-mono mb-2 truncate" style={{ color: '#4a4a60' }}>{health.cpu.model}</div>
          {health.cpu.loadAvg.map((load: number, i: number) => (
            <ProgressBar key={i} value={load} max={health.cpu.cores} color={i === 0 ? '#00ff88' : i === 1 ? '#eab308' : '#ff6b6b'} label={`Load ${i === 0 ? '1m' : i === 1 ? '5m' : '15m'}`} />
          ))}
        </div>
      </div>

      {/* Database tables */}
      <div className="glass rounded-xl p-4">
        <h3 className="font-mono text-xs font-bold tracking-wider mb-3" style={{ color: '#6b7280' }}>ТАБЛИЦЫ БАЗЫ ДАННЫХ</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {Object.entries(health.database.tables).map(([table, count]) => (
            <div key={table} className="rounded-lg p-2 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-lg font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{count as number}</div>
              <div className="text-[9px] font-mono truncate" style={{ color: '#6b7280' }}>{table}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
