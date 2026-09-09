import { useState, useMemo } from 'react';
import { Download, X, CheckCircle, Clock, XCircle, Search, ArrowUpDown, ArrowUp, ArrowDown, Layers } from 'lucide-react';
import { RegistrationField, RegistrationSubmission } from '../../types';
import { registrationsApi } from '../../services/api';
import { showToast } from '../ui/NexusModal';

interface SubmissionsTableProps {
  registrationId: string;
  fields: RegistrationField[];
  submissions: RegistrationSubmission[];
  onRefresh: () => void;
  onClose: () => void;
}

const STATUS_CONFIG = {
  registered: { label: 'Зарегистрирован', color: '#00ff88', icon: CheckCircle },
  waitlist: { label: 'Ожидание', color: '#eab308', icon: Clock },
  confirmed: { label: 'Подтверждён', color: '#00d4ff', icon: CheckCircle },
  cancelled: { label: 'Отменено', color: '#6b7280', icon: XCircle },
};

type SortDir = 'asc' | 'desc' | null;

interface GroupConfig {
  key: string;
  label: string;
  getValue: (sub: RegistrationSubmission, answers: Record<string, string>) => string;
}

export default function SubmissionsTable({ registrationId, fields, submissions, onRefresh, onClose }: SubmissionsTableProps) {
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'waitlist' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [groupByCols, setGroupByCols] = useState<string[]>([]);

  // Available group columns
  const groupConfigs: GroupConfig[] = useMemo(() => [
    { key: 'status', label: 'СТАТУС', getValue: (sub) => sub.status },
    { key: 'phone', label: 'ТЕЛЕФОН', getValue: (sub) => sub.contactPhone || '—' },
    { key: 'email', label: 'EMAIL', getValue: (sub) => sub.contactEmail || '—' },
    ...fields.filter(f => !['heading', 'paragraph', 'divider', 'page_break', 'signature', 'file', 'multi_file'].includes(f.type)).map(f => ({
      key: `field_${f.id}`, label: f.label,
      getValue: (_: RegistrationSubmission, answers: Record<string, string>) => answers[f.id] || '—',
    })),
  ], [fields]);

  const toggleGroup = (key: string) => {
    setGroupByCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const toggleSort = (key: string) => {
    if (sortCol === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortCol(null); setSortDir(null); }
    } else {
      setSortCol(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    return submissions.filter(s => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.contactName.toLowerCase().includes(q) || s.contactEmail.toLowerCase().includes(q) || s.contactPhone.toLowerCase().includes(q);
      }
      return true;
    });
  }, [submissions, filter, search]);

  // Sorted + grouped data
  const { sorted, groups } = useMemo(() => {
    let data = [...filtered];

    // Sort
    if (sortCol && sortDir) {
      const cfg = groupConfigs.find(g => g.key === sortCol);
      if (cfg) {
        data.sort((a, b) => {
          const aVal = cfg.getValue(a, JSON.parse(a.answers || '{}'));
          const bVal = cfg.getValue(b, JSON.parse(b.answers || '{}'));
          const cmp = aVal.localeCompare(bVal, 'ru');
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }

    // Group — build group boundaries
    const groupMap = new Map<string, number[]>();
    if (groupByCols.length > 0) {
      data.forEach((sub, i) => {
        const answers = JSON.parse(sub.answers || '{}');
        const groupKey = groupByCols.map(col => {
          const cfg = groupConfigs.find(g => g.key === col);
          return cfg ? cfg.getValue(sub, answers) : '';
        }).join('|||');
        if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
        groupMap.get(groupKey)!.push(i);
      });
    }

    return { sorted: data, groups: groupMap };
  }, [filtered, sortCol, sortDir, groupByCols, groupConfigs]);

  // Find which group a row belongs to
  const getGroupColor = (index: number): string | null => {
    if (groupByCols.length === 0) return null;
    for (const [, indices] of groups) {
      if (indices.includes(index) && indices.length > 1) {
        const hash = indices[0] % 6;
        const colors = ['rgba(0,255,136,0.06)', 'rgba(0,212,255,0.06)', 'rgba(191,0,255,0.06)', 'rgba(234,179,8,0.06)', 'rgba(255,59,48,0.04)', 'rgba(255,140,0,0.06)'];
        return colors[hash];
      }
    }
    return null;
  };

  const getGroupBorder = (index: number): string => {
    if (groupByCols.length === 0) return 'transparent';
    for (const [, indices] of groups) {
      if (indices.includes(index) && indices.length > 1) {
        const hash = indices[0] % 6;
        const colors = ['rgba(0,255,136,0.2)', 'rgba(0,212,255,0.2)', 'rgba(191,0,255,0.2)', 'rgba(234,179,8,0.2)', 'rgba(255,59,48,0.15)', 'rgba(255,140,0,0.2)'];
        return colors[hash];
      }
    }
    return 'transparent';
  };

  const handleCancel = async (subId: string) => {
    try {
      await registrationsApi.cancelSubmission(subId);
      showToast('Заявка отменена', 'success');
      onRefresh();
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleExport = async () => {
    try {
      const blob = await registrationsApi.exportCSV(registrationId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registration-${registrationId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('CSV загружен', 'success');
    } catch { showToast('Ошибка экспорта', 'error'); }
  };

  const dataFields = fields.filter(f => !['heading', 'paragraph', 'divider', 'page_break'].includes(f.type));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>ЗАЯВКИ ({submissions.length})</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
            className="w-full pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
        </div>
        {(['all', 'confirmed', 'waitlist', 'cancelled'] as const).map(s => {
          const config = s === 'all' ? null : STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold transition-all"
              style={filter === s
                ? { background: config?.color || 'var(--color-primary)', color: '#000' }
                : { color: '#6a6a80', background: 'rgba(255,255,255,0.03)' }}>
              {s === 'all' ? 'ВСЕ' : config?.label}
            </button>
          );
        })}
      </div>

      {/* Group by selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] text-gray-500 flex items-center gap-1"><Layers className="w-3 h-3" />ГРУППИРОВКА:</span>
        {groupConfigs.slice(0, 6).map(cfg => {
          const active = groupByCols.includes(cfg.key);
          return (
            <button key={cfg.key} onClick={() => toggleGroup(cfg.key)}
              className="px-2 py-1 rounded text-[10px] font-mono transition-all"
              style={active
                ? { background: 'var(--color-primary)', color: '#000' }
                : { color: '#5a5a70', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {cfg.label}
            </button>
          );
        })}
        {groupByCols.length > 0 && (
          <button onClick={() => setGroupByCols([])} className="text-[10px] font-mono text-gray-500 hover:text-gray-300 px-2 py-1">СБРОС</button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl glass">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500">№</th>
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ИМЯ</th>
              <SortHeader label="EMAIL" colKey="email" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="ТЕЛЕФОН" colKey="phone" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              {dataFields.map(f => (
                <SortHeader key={f.id} label={f.label} colKey={`field_${f.id}`} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="max-w-[150px] truncate" />
              ))}
              <SortHeader label="СТАТУС" colKey="status" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 font-mono text-[10px] text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('date')}>
                ДАТА {sortCol === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((sub, i) => {
              const answers = JSON.parse(sub.answers || '{}');
              const statusCfg = STATUS_CONFIG[sub.status];
              const StatusIcon = statusCfg.icon;
              const groupBg = getGroupColor(i);
              const groupBorder = getGroupBorder(i);

              return (
                <tr key={sub.id} className="border-b border-white/5 transition-colors"
                  style={{ background: groupBg || undefined, borderLeft: groupBg ? `3px solid ${groupBorder}` : undefined }}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-200">{sub.contactName || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-300">{sub.contactEmail || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-300">{sub.contactPhone || '—'}</td>
                  {dataFields.map(f => (
                    <td key={f.id} className="px-3 py-2 font-mono text-xs text-gray-300 max-w-[150px] truncate">{answers[f.id] || '—'}</td>
                  ))}
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${statusCfg.color}20`, color: statusCfg.color }}>
                      <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{new Date(sub.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td className="px-3 py-2">
                    {sub.status !== 'cancelled' && (
                      <button onClick={() => handleCancel(sub.id)} className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400" title="Отменить">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-8">
            <p className="font-mono text-xs text-gray-500">// НЕТ ЗАЯВОК</p>
          </div>
        )}
      </div>

      {/* Group summary */}
      {groupByCols.length > 0 && groups.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(groups.entries()).map(([key, indices]) => {
            if (indices.length < 2) return null;
            const labels = key.split('|||');
            return (
              <div key={key} className="px-3 py-1.5 rounded-lg font-mono text-[10px]" style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.12)' }}>
                <span className="text-gray-400">{labels.join(' + ')}:</span> <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{indices.length} записей</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sortable column header
function SortHeader({ label, colKey, sortCol, sortDir, onSort, className }: {
  label: string; colKey: string; sortCol: string | null; sortDir: SortDir;
  onSort: (key: string) => void; className?: string;
}) {
  const active = sortCol === colKey;
  return (
    <th className={`px-3 py-2 font-mono text-[10px] cursor-pointer transition-colors select-none ${className || ''}`}
      style={{ color: active ? 'var(--color-primary)' : '#5a5a70' }}
      onClick={() => onSort(colKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );
}
