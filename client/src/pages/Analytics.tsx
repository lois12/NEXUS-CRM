import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import {
  BarChart3, TrendingUp, Calendar, FileText, Users, FolderOpen,
  Zap, Send,
} from 'lucide-react';
import { DashboardStats } from '../types';
import { dashboardApi } from '../services/api';
import { formatLastSeenKR } from '../utils/timezone';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

const platformColors: Record<string, string> = {
  telegram: '#0088cc', vk: '#4a76a8', site: '#00ff88', max: '#ff6600',
};

const platformLabels: Record<string, string> = {
  telegram: 'Telegram', vk: 'ВКонтакте', site: 'Сайт', max: 'MAX',
};

const statusLabels: Record<string, string> = {
  'черновик': 'Черновики', 'запланирован': 'Запланированы', 'на_доработку': 'На доработке',
  'согласован': 'Согласованы', 'утверждён': 'Утверждены', 'опубликован': 'Опубликованы',
};

const statusColors: Record<string, string> = {
  'черновик': '#6b7280', 'запланирован': '#00d4ff', 'на_доработку': '#eab308',
  'согласован': '#00ff88', 'утверждён': '#bf00ff', 'опубликован': '#22c55e',
};

const activityIcons: Record<string, typeof Send> = {
  user_login: Users, user_created: Users, post_published: Send,
  material_uploaded: FolderOpen, post_created: FileText,
};

// Custom Recharts tooltip with cyberpunk style
function CyberTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(10,10,15,0.95)', border: '1px solid rgba(0,255,136,0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      <p className="font-mono text-[10px] text-gray-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono text-xs font-bold" style={{ color: p.color || '#00ff88' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [postsByDay, setPostsByDay] = useState<{ date: string; count: number }[]>([]);
  const [byPlatform, setByPlatform] = useState<{ platform: string; count: number }[]>([]);
  const [byStatus, setByStatus] = useState<{ status: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activityRef] = useAutoAnimate({ duration: 200 });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, dayRes, platRes, statusRes] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getPostsByDay(),
          dashboardApi.getByPlatform(),
          dashboardApi.getByStatus(),
        ]);
        if (statsRes.success && statsRes.data) setStats(statsRes.data);
        if (dayRes.success && dayRes.data) setPostsByDay(dayRes.data);
        if (platRes.success && platRes.data) setByPlatform(platRes.data);
        if (statusRes.success && statusRes.data) setByStatus(statusRes.data);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    };
    fetchAll();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          </motion.div>
          <p className="neon-text text-xl font-mono" style={{ color: 'var(--color-primary)' }}>ЗАГРУЗКА...</p>
        </div>
      </div>
    );
  }

  // Prepare data for Recharts
  const dayChartData = postsByDay.map(d => ({
    date: d.date.slice(5),
    посты: d.count,
  }));

  const platformChartData = byPlatform.map(p => ({
    name: platformLabels[p.platform] || p.platform,
    value: p.count,
    color: platformColors[p.platform] || '#888',
  }));

  const statusChartData = byStatus.map(s => ({
    name: statusLabels[s.status] || s.status,
    value: s.count,
    color: statusColors[s.status] || '#6b7280',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <BarChart3 className="w-7 h-7 md:w-8 md:h-8" /> АНАЛИТИКА
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// РЕАЛЬНЫЕ ДАННЫЕ</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'ВСЕГО ПОСТОВ', value: stats?.totalPosts || 0, icon: FileText },
          { label: 'ОПУБЛИКОВАНО', value: stats?.publishedPosts || 0, icon: TrendingUp },
          { label: 'МАТЕРИАЛОВ', value: stats?.totalMaterials || 0, icon: FolderOpen },
          { label: 'ПОЛЬЗОВАТЕЛЕЙ', value: stats?.totalUsers || 0, icon: Users },
        ].map((m, i) => (
          <motion.div key={m.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="card-glow glass-card rounded-2xl p-6 stagger-item">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center glass-accent">
                <m.icon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
              </div>
            </div>
            <p className="text-3xl font-bold font-mono text-gray-200">{m.value}</p>
            <p className="text-xs font-mono text-gray-500 mt-1">{m.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Area Chart — Posts by Day */}
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <h2 className="text-lg font-bold font-mono text-gray-200 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            ПУБЛИКАЦИИ ЗА 7 ДНЕЙ
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dayChartData}>
              <defs>
                <linearGradient id="gradientPosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff88" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#5a5a70', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5a5a70', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CyberTooltip />} />
              <Area type="monotone" dataKey="посты" stroke="#00ff88" strokeWidth={2} fill="url(#gradientPosts)" dot={{ fill: '#00ff88', r: 4, strokeWidth: 0 }} activeDot={{ fill: '#00ff88', r: 6, stroke: '#00ff88', strokeWidth: 2, strokeOpacity: 0.3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart — Platform Stats */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-bold font-mono text-gray-200 mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            ПО ПЛОЩАДКАМ
          </h2>
          {platformChartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={platformChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {platformChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CyberTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {platformChartData.map(p => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}60` }} />
                      <span className="font-mono text-xs text-gray-300">{p.name}</span>
                    </div>
                    <span className="font-mono text-xs font-bold" style={{ color: p.color }}>{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs font-mono text-gray-500">Нет данных</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent Activity */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-bold font-mono text-gray-200 mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            ПОСЛЕДНИЕ ДЕЙСТВИЯ
          </h2>
          <div ref={activityRef} className="space-y-3">
            {(!stats?.recentActivities || stats.recentActivities.length === 0) && (
              <p className="text-xs font-mono text-gray-500">Нет активности</p>
            )}
            {(stats?.recentActivities || []).slice(0, 8).map((a, i) => {
              const Icon = activityIcons[a.type] || Zap;
              return (
                <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }} className="flex items-center gap-4 p-3 rounded-xl bg-white/5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center glass-accent">
                    <Icon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{a.description}</p>
                    <p className="text-xs text-gray-500">{(a as any).userName || 'Система'}</p>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">{formatLastSeenKR(a.createdAt)}</span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bar Chart — Content by Status */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-bold font-mono text-gray-200 mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            ПО СТАТУСАМ
          </h2>
          {statusChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#5a5a70', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#8888a0', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<CyberTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                  {statusChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs font-mono text-gray-500">Нет данных</p>
          )}
        </div>
      </div>
    </div>
  );
}
