import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, CheckCircle, Clock, XCircle, Download, Search, UserCheck } from 'lucide-react';
import { registrationsApi } from '../services/api';
import { showToast } from '../components/ui/NexusModal';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  confirmed: { label: 'Подтверждено', color: '#00ff88', icon: CheckCircle },
  waitlist: { label: 'Очередь', color: '#eab308', icon: Clock },
  cancelled: { label: 'Отменено', color: '#6b7280', icon: XCircle },
};

export default function ParticipantsList() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<any[]>([]);
  const [regTitle, setRegTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'waitlist' | 'cancelled' | 'attended' | 'not_attended'>('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [partsRes, regRes] = await Promise.all([
        registrationsApi.getParticipants(id),
        registrationsApi.getOne(id),
      ]);
      if (partsRes.success && partsRes.data) setParticipants(partsRes.data);
      if (regRes.success && regRes.data) setRegTitle(regRes.data.title);
    } catch { showToast('Ошибка загрузки', 'error'); }
    finally { setIsLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleAttended = async (subId: string) => {
    try {
      const res = await registrationsApi.toggleAttended(id!, subId);
      if (res.success) {
        setParticipants(prev => prev.map(p => p.id === subId ? { ...p, attended: res.data.attended, attendedAt: res.data.attendedAt } : p));
        showToast(res.data.attended ? 'Отмечен как пришедший' : 'Отметка снята', 'success');
      }
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleExport = async () => {
    try {
      const blob = await registrationsApi.exportCSV(id!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participants-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('CSV загружен', 'success');
    } catch { showToast('Ошибка экспорта', 'error'); }
  };

  const filtered = participants.filter(p => {
    if (filter === 'confirmed' && p.status !== 'confirmed') return false;
    if (filter === 'waitlist' && p.status !== 'waitlist') return false;
    if (filter === 'cancelled' && p.status !== 'cancelled') return false;
    if (filter === 'attended' && !p.attended) return false;
    if (filter === 'not_attended' && p.attended) return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.contactName || '').toLowerCase().includes(q) || (p.contactEmail || '').toLowerCase().includes(q) || (p.contactPhone || '').toLowerCase().includes(q);
    }
    return true;
  });

  const attendedCount = participants.filter(p => p.attended).length;
  const confirmedCount = participants.filter(p => p.status === 'confirmed').length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Users className="w-12 h-12 animate-pulse" style={{ color: 'var(--color-primary)' }} /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/registrations')} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
              <Users className="w-7 h-7 md:w-8 md:h-8" /> УЧАСТНИКИ
            </h1>
            <p className="text-gray-400 mt-1 font-mono text-sm">// {regTitle} — {attendedCount}/{confirmedCount} пришли</p>
          </div>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-colors">
          <Download className="w-3.5 h-3.5" /> ЭКСПОРТ CSV
        </button>
      </div>

      {/* Attendance bar */}
      <div className="glass rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-primary)' }}>
            <UserCheck className="w-3.5 h-3.5 inline mr-1.5" /> ПРИСУТСТВУЮТ
          </span>
          <span className="font-mono text-lg font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 10px var(--color-glow)' }}>
            {attendedCount}<span className="text-gray-500 text-sm"> / {confirmedCount}</span>
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div initial={{ width: 0 }}
            animate={{ width: `${confirmedCount > 0 ? Math.min((attendedCount / confirmedCount) * 100, 100) : 0}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))', boxShadow: '0 0 10px var(--color-glow)' }} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
            className="w-full pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
        </div>
        {([
          { key: 'all', label: 'ВСЕ' },
          { key: 'confirmed', label: 'ПОДТВЕРЖДЕНО' },
          { key: 'waitlist', label: 'ОЧЕРЕДЬ' },
          { key: 'attended', label: 'ПРИШЛИ' },
          { key: 'not_attended', label: 'НЕ ПРИШЛИ' },
          { key: 'cancelled', label: 'ОТМЕНЕНО' },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold transition-all"
            style={filter === f.key
              ? { background: 'var(--color-primary)', color: '#000' }
              : { color: '#6a6a80', background: 'rgba(255,255,255,0.03)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl glass">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500">№</th>
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ИМЯ</th>
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500">EMAIL</th>
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ТЕЛЕФОН</th>
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500">СТАТУС</th>
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ПРИШЁЛ</th>
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ВРЕМЯ</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.confirmed;
              const StatusIcon = statusCfg.icon;
              return (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-xs text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-200">{p.contactName || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-300">{p.contactEmail || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-300">{p.contactPhone || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${statusCfg.color}20`, color: statusCfg.color }}>
                      <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {p.attended ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(0,255,136,0.15)', color: '#00ff88' }}>
                        <CheckCircle className="w-3 h-3" /> Да
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-500">
                    {p.attendedAt ? new Date(p.attendedAt).toLocaleString('ru-RU') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {p.status !== 'cancelled' && (
                      <button onClick={() => handleToggleAttended(p.id)}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        title={p.attended ? 'Снять отметку' : 'Отметить как пришедшего'}>
                        <UserCheck className="w-3.5 h-3.5" style={{ color: p.attended ? '#00ff88' : '#6a6a80' }} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="font-mono text-xs text-gray-500">// НЕТ УЧАСТНИКОВ</p>
          </div>
        )}
      </div>
    </div>
  );
}
