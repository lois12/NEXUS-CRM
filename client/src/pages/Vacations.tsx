import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, CalendarDays, Check, XIcon, Clock } from 'lucide-react';
import { Vacation, VacationType, VacationStatus } from '../types';
import { vacationsApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { NexusInput, NexusTextarea, NexusSelect } from '../components/common/NexusInput';
import NexusFormModal from '../components/common/NexusFormModal';

const TYPE_CONFIG: Record<VacationType, { label: string; color: string }> = {
  annual: { label: 'Отпуск', color: '#00ff88' },
  sick: { label: 'Больничный', color: '#ff3b30' },
  unpaid: { label: 'За свой счёт', color: '#eab308' },
  maternity: { label: 'Декрет', color: '#bf00ff' },
};

const STATUS_CONFIG: Record<VacationStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Ожидает', color: '#eab308', icon: Clock },
  approved: { label: 'Одобрено', color: '#00ff88', icon: Check },
  rejected: { label: 'Отклонено', color: '#ff3b30', icon: XIcon },
};

const MS_PER_DAY = 86_400_000;

export default function Vacations() {
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vacation | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<VacationStatus | ''>('');
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [form, setForm] = useState({ startDate: '', endDate: '', type: 'annual' as VacationType, notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const res = await vacationsApi.getAll();
      if (res.success && res.data) setVacations(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = vacations.filter(v => {
    if (filterStatus && v.status !== filterStatus) return false;
    if (search && !(v.userName || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ startDate: '', endDate: '', type: 'annual', notes: '' });
    setShowModal(true);
  };

  const openEdit = (v: Vacation) => {
    setEditing(v);
    setForm({ startDate: v.startDate, endDate: v.endDate, type: v.type, notes: v.notes });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.startDate || !form.endDate) { showToast('Укажите даты', 'error'); return; }
    try {
      if (editing) {
        await vacationsApi.update(editing.id, form);
        showToast('Обновлено', 'success');
      } else {
        await vacationsApi.create(form);
        showToast('Заявка создана', 'success');
      }
      setShowModal(false);
      fetchData();
    } catch (e) { showToast('Ошибка', 'error'); }
  };

  const handleStatus = async (id: string, status: VacationStatus) => {
    try {
      await vacationsApi.update(id, { status });
      showToast(status === 'approved' ? 'Одобрено' : 'Отклонено', 'success');
      fetchData();
    } catch (e) { showToast('Ошибка', 'error'); }
  };

  const handleDelete = (v: Vacation) => {
    showConfirm('УДАЛИТЬ?', 'Заявка будет удалена.', async () => {
      try { await vacationsApi.delete(v.id); showToast('Удалено', 'success'); fetchData(); }
      catch (e) { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  const getDays = (start: string, end: string) => {
    const d = (new Date(end).getTime() - new Date(start).getTime()) / MS_PER_DAY;
    return Math.max(1, Math.round(d) + 1);
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><CalendarDays className="w-12 h-12 animate-pulse" style={{ color: 'var(--color-primary)' }} /></div>;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <CalendarDays className="w-7 h-7 md:w-8 md:h-8" /> ОТПУСКА
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// {vacations.length} ЗАЯВОК</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
              className="pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] w-48" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
            <option value="">ВСЕ СТАТУСЫ</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" /> ЗАЯВКА
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.map(v => {
          const sc = STATUS_CONFIG[v.status];
          const tc = TYPE_CONFIG[v.type];
          const ScIcon = sc.icon;
          return (
            <motion.div key={v.id} layout className="glass-card rounded-xl p-4 group flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-bold text-gray-200">{v.userName || 'Неизвестный'}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${tc.color}20`, color: tc.color }}>{tc.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: `${sc.color}20`, color: sc.color }}>
                    <ScIcon className="w-3 h-3" />{sc.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs font-mono text-gray-400">
                  <span>📅 {v.startDate} → {v.endDate}</span>
                  <span>({getDays(v.startDate, v.endDate)} дн.)</span>
                  {v.approverName && <span>✓ {v.approverName}</span>}
                </div>
                {v.notes && <p className="text-xs font-mono text-gray-500 mt-1">{v.notes}</p>}
              </div>
              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {v.status === 'pending' && (
                  <>
                    <button onClick={() => handleStatus(v.id, 'approved')} className="p-1.5 rounded hover:bg-green-500/20" title="Одобрить"><Check className="w-4 h-4 text-green-400" /></button>
                    <button onClick={() => handleStatus(v.id, 'rejected')} className="p-1.5 rounded hover:bg-red-500/20" title="Отклонить"><XIcon className="w-4 h-4 text-red-400" /></button>
                  </>
                )}
                <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-white/10"><Edit3 className="w-4 h-4 text-gray-400" /></button>
                <button onClick={() => handleDelete(v)} className="p-1.5 rounded hover:bg-red-500/20"><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
            <p className="font-mono text-gray-500">// ЗАЯВОК НЕТ</p>
          </div>
        )}
      </div>

      <NexusFormModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'РЕДАКТИРОВАТЬ' : 'НОВАЯ ЗАЯВКА'} onSave={handleSave}
        saveLabel={editing ? 'СОХРАНИТЬ' : 'ОТПРАВИТЬ'} maxWidth="max-w-md">
        <div className="space-y-3">
          <NexusSelect value={form.type} onChange={e => setForm({ ...form, type: e.target.value as VacationType })}>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </NexusSelect>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-xs text-gray-500 mb-1 block">НАЧАЛО</label>
              <NexusInput type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="font-mono text-xs text-gray-500 mb-1 block">КОНЕЦ</label>
              <NexusInput type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <NexusTextarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="// ЗАМЕТКИ" rows={2} />
        </div>
      </NexusFormModal>

      <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm}
        title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
}
