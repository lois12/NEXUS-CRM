import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, X, Package, MapPin, LayoutGrid, List, FolderPlus } from 'lucide-react';
import { InventoryItem, InventoryType, InventoryStatus } from '../types';
import { inventoryApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';

const TYPE_CONFIG: Record<InventoryType, { label: string; color: string }> = {
  'ТМЦ': { label: 'ТМЦ', color: '#00d4ff' },
  'ОС': { label: 'ОС', color: '#bf00ff' },
};

const STATUS_CONFIG: Record<InventoryStatus, { label: string; color: string }> = {
  active: { label: 'Активно', color: '#00ff88' },
  written_off: { label: 'Списано', color: '#6b7280' },
  repair: { label: 'Ремонт', color: '#eab308' },
};

const LOCATION_COLORS = ['#00ff88', '#00d4ff', '#bf00ff', '#ff00ff', '#eab308', '#ff3b30', '#ff8c00', '#88ddff'];
const LOC_STORAGE_KEY = 'nexus-inventory-locations';

function loadLocations(): string[] {
  try {
    const saved = localStorage.getItem(LOC_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return [];
}

function saveLocations(locs: string[]) {
  try { localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify(locs)); } catch (e) { /* ignore */ }
}

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<InventoryType | ''>('');
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | ''>('');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [form, setForm] = useState({
    name: '', type: 'ТМЦ' as InventoryType, description: '', quantity: 1, unit: 'шт',
    location: '', responsiblePerson: '', serialNumber: '', status: 'active' as InventoryStatus,
  });

  // Locations management
  const [savedLocations, setSavedLocations] = useState<string[]>(loadLocations);
  const [showLocModal, setShowLocModal] = useState(false);
  const [newLocName, setNewLocName] = useState('');

  // Native DnD
  const dragItem = useRef<{ id: string; from: string } | null>(null);
  const [dragOverLoc, setDragOverLoc] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await inventoryApi.getAll();
      if (res.success && res.data) setItems(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => items.filter(i => {
    if (filterType && i.type !== filterType) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.location.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, filterType, filterStatus, search]);

  // Merge saved locations + locations from items
  const locations = useMemo(() => {
    const fromItems = new Set(filtered.map(i => i.location || 'Без местоположения'));
    const merged = [...new Set([...savedLocations, ...fromItems])];
    // Remove empty strings
    return merged.filter(l => l);
  }, [filtered, savedLocations]);

  const getLocationColor = (loc: string) => LOCATION_COLORS[locations.indexOf(loc) % LOCATION_COLORS.length];

  const getItemsByLocation = (loc: string) =>
    filtered.filter(i => (i.location || 'Без местоположения') === loc);

  // Location management
  const addLocation = () => {
    const name = newLocName.trim();
    if (!name || savedLocations.includes(name)) return;
    const updated = [...savedLocations, name];
    setSavedLocations(updated);
    saveLocations(updated);
    setNewLocName('');
    setShowLocModal(false);
    showToast(`Место "${name}" создано`, 'success');
  };

  const removeLocation = (loc: string) => {
    showConfirm('УДАЛИТЬ МЕСТО?', `Место "${loc}" будет удалено. Предметы останутся.`, () => {
      const updated = savedLocations.filter(l => l !== loc);
      setSavedLocations(updated);
      saveLocations(updated);
      showToast('Место удалено', 'success');
    }, 'danger');
  };

  // DnD handlers
  const handleDragStart = (e: React.DragEvent, itemId: string, fromLoc: string) => {
    dragItem.current = { id: itemId, from: fromLoc };
    e.dataTransfer.effectAllowed = 'move';
    (e.target as HTMLElement).style.opacity = '0.3';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    dragItem.current = null;
    setDragOverLoc(null);
  };

  const handleDragOver = (e: React.DragEvent, loc: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverLoc(loc);
  };

  const handleDrop = async (e: React.DragEvent, destLoc: string) => {
    e.preventDefault();
    setDragOverLoc(null);
    if (!dragItem.current) return;

    const { id, from } = dragItem.current;
    if (from === destLoc) { dragItem.current = null; return; }

    const realLocation = destLoc === 'Без местоположения' ? '' : destLoc;
    setItems(prev => prev.map(i => i.id === id ? { ...i, location: realLocation } : i));
    dragItem.current = null;

    try {
      await inventoryApi.update(id, { location: realLocation });
      showToast(`→ ${destLoc}`, 'success');
    } catch (e) {
      showToast('Ошибка', 'error');
      fetchData();
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', type: 'ТМЦ', description: '', quantity: 1, unit: 'шт', location: '', responsiblePerson: '', serialNumber: '', status: 'active' });
    setShowModal(true);
  };

  const openEdit = (i: InventoryItem) => {
    setEditing(i);
    setForm({ name: i.name, type: i.type, description: i.description, quantity: i.quantity, unit: i.unit, location: i.location, responsiblePerson: i.responsiblePerson, serialNumber: i.serialNumber, status: i.status });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing) { await inventoryApi.update(editing.id, form); showToast('Обновлено', 'success'); }
      else { await inventoryApi.create(form); showToast('Создано', 'success'); }
      setShowModal(false);
      fetchData();
    } catch (e) { showToast('Ошибка', 'error'); }
  };

  const handleDelete = (i: InventoryItem) => {
    showConfirm('УДАЛИТЬ?', `"${i.name}" будет удалён.`, async () => {
      try { await inventoryApi.delete(i.id); showToast('Удалено', 'success'); fetchData(); }
      catch (e) { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><Package className="w-12 h-12 animate-pulse" style={{ color: 'var(--color-primary)' }} /></div>;

  return (
    <div className="h-dvh-minus-header flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <Package className="w-7 h-7 md:w-8 md:h-8" /> ОБОРУДОВАНИЕ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// {items.length} ПОЗИЦИЙ • {locations.length} ЛОКАЦИЙ</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
              className="pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] w-44" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
            className="px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
            <option value="">ВСЕ ТИПЫ</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
            <option value="">ВСЕ СТАТУСЫ</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button onClick={() => setView('table')} className={`p-2 transition-all ${view === 'table' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView('kanban')} className={`p-2 transition-all ${view === 'kanban' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          {view === 'kanban' && (
            <button onClick={() => setShowLocModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs font-bold glass hover:bg-white/10">
              <FolderPlus className="w-4 h-4" /> МЕСТО
            </button>
          )}
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" /> ДОБАВИТЬ
          </button>
        </div>
      </div>

      {/* TABLE VIEW */}
      {view === 'table' && (
        <div className="flex-1 overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="px-3 py-2 font-mono text-xs text-gray-500">НАЗВАНИЕ</th>
                  <th className="px-3 py-2 font-mono text-xs text-gray-500">ТИП</th>
                  <th className="px-3 py-2 font-mono text-xs text-gray-500 text-center">КОЛ-ВО</th>
                  <th className="px-3 py-2 font-mono text-xs text-gray-500">МЕСТО</th>
                  <th className="px-3 py-2 font-mono text-xs text-gray-500">ОТВЕТСТВ.</th>
                  <th className="px-3 py-2 font-mono text-xs text-gray-500">СТАТУС</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id} className="border-b border-gray-800/50 hover:bg-white/5 group transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-sm text-gray-200">{i.name}</div>
                      {i.serialNumber && <div className="font-mono text-[10px] text-gray-500">SN: {i.serialNumber}</div>}
                      {i.description && <div className="font-mono text-[10px] text-gray-500 truncate max-w-[200px]">{i.description}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${TYPE_CONFIG[i.type].color}20`, color: TYPE_CONFIG[i.type].color }}>{TYPE_CONFIG[i.type].label}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm text-gray-200 text-center">{i.quantity} {i.unit}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-300">
                      {i.location ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-500" />{i.location}</span> : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{i.responsiblePerson || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${STATUS_CONFIG[i.status].color}20`, color: STATUS_CONFIG[i.status].color }}>{STATUS_CONFIG[i.status].label}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(i)} className="p-1 rounded hover:bg-white/10"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                        <button onClick={() => handleDelete(i)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
                <p className="font-mono text-gray-500">// СКЛАД ПУСТ</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KANBAN VIEW */}
      {view === 'kanban' && (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 min-h-0 h-full pb-2" style={{ minWidth: (locations.length + 1) * 280 }}>
            {locations.map(loc => {
              const locItems = getItemsByLocation(loc);
              const color = getLocationColor(loc);
              const isOver = dragOverLoc === loc;
              return (
                <div key={loc}
                  className="flex flex-col min-h-0 w-[200px] sm:w-[240px] md:w-[270px] flex-shrink-0 rounded-xl transition-all duration-300"
                  style={{
                    background: isOver
                      ? `linear-gradient(180deg, ${color}12 0%, ${color}06 100%)`
                      : 'linear-gradient(180deg, rgba(20,20,35,0.9) 0%, rgba(15,15,25,0.95) 100%)',
                    border: `1px solid ${isOver ? `${color}60` : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: isOver ? `0 0 30px ${color}20, inset 0 0 30px ${color}08` : '0 4px 24px rgba(0,0,0,0.3)',
                  }}
                  onDragOver={(e) => handleDragOver(e, loc)}
                  onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOverLoc(null); }}
                  onDrop={(e) => handleDrop(e, loc)}>
                  {/* Column header */}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${isOver ? `${color}30` : 'rgba(255,255,255,0.04)'}` }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}80` }} />
                      <span className="font-mono text-xs font-bold truncate" style={{ color }}>{loc}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{locItems.length}</span>
                      {savedLocations.includes(loc) && (
                        <button onClick={() => removeLocation(loc)} className="p-0.5 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3 h-3 text-red-400/50" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Items */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
                    {locItems.map(item => (
                      <div key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id, loc)}
                        onDragEnd={handleDragEnd}
                        className="p-3 rounded-lg cursor-grab active:cursor-grabbing group/item hover:brightness-110 transition-all"
                        style={{
                          background: 'linear-gradient(145deg, rgba(30,30,50,0.7), rgba(20,20,35,0.9))',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderLeft: `3px solid ${TYPE_CONFIG[item.type].color}`,
                        }}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm text-gray-200 truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${TYPE_CONFIG[item.type].color}15`, color: TYPE_CONFIG[item.type].color }}>
                                {TYPE_CONFIG[item.type].label}
                              </span>
                              <span className="text-[10px] font-mono text-gray-500">{item.quantity} {item.unit}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${STATUS_CONFIG[item.status].color}15`, color: STATUS_CONFIG[item.status].color }}>
                                {STATUS_CONFIG[item.status].label}
                              </span>
                            </div>
                            {item.responsiblePerson && <p className="text-[10px] font-mono text-gray-600 mt-1">{item.responsiblePerson}</p>}
                          </div>
                          <div className="flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-white/10"><Edit3 className="w-3 h-3 text-gray-400" /></button>
                            <button onClick={() => handleDelete(item)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3 h-3 text-red-400" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Drop zone indicator */}
                    {isOver && (
                      <div className="rounded-lg p-3 flex items-center justify-center min-h-[50px] animate-pulse"
                        style={{ background: `${color}10`, border: `1px dashed ${color}40` }}>
                        <span className="font-mono text-[10px]" style={{ color: `${color}80` }}>Переместить сюда</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Add location column */}
            <div className="w-[270px] flex-shrink-0 flex items-start justify-center pt-8">
              <button onClick={() => setShowLocModal(true)}
                className="w-full p-4 rounded-xl border border-dashed border-gray-700 hover:border-gray-500 transition-colors flex flex-col items-center gap-2 text-gray-500 hover:text-gray-300">
                <FolderPlus className="w-8 h-8" />
                <span className="font-mono text-xs">ДОБАВИТЬ МЕСТО</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-frost rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>
                  {editing ? 'РЕДАКТИРОВАТЬ' : 'НОВАЯ ЗАПИСЬ'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="// НАЗВАНИЕ *"
                  className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as InventoryType })}
                    className="px-3 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                    <option value="ТМЦ">ТМЦ</option>
                    <option value="ОС">ОС</option>
                  </select>
                  <input type="number" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} placeholder="КОЛ-ВО"
                    className="px-3 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                  <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="ЕД.ИЗМ"
                    className="px-3 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                </div>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="// ОПИСАНИЕ" rows={2}
                  className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none resize-none" />
                {/* Location select with existing locations */}
                <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                  <option value="">БЕЗ МЕСТОПОЛОЖЕНИЯ</option>
                  {locations.filter(l => l !== 'Без местоположения').map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.responsiblePerson} onChange={e => setForm({ ...form, responsiblePerson: e.target.value })} placeholder="// ОТВЕТСТВЕННЫЙ"
                    className="px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                  <input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} placeholder="// СЕР. НОМЕР"
                    className="px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                </div>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as InventoryStatus })}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl glass font-mono text-sm text-gray-400">ОТМЕНА</button>
                <button onClick={handleSave} className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>{editing ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Modal */}
      <AnimatePresence>
        {showLocModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowLocModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-frost rounded-2xl p-6 w-full max-w-sm" style={{ border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>НОВОЕ МЕСТО</h2>
                <button onClick={() => setShowLocModal(false)} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <input value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder="// НАЗВАНИЕ МЕСТА"
                className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]"
                onKeyDown={e => e.key === 'Enter' && addLocation()}
                autoFocus />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowLocModal(false)} className="flex-1 px-4 py-2.5 rounded-xl glass font-mono text-sm text-gray-400">ОТМЕНА</button>
                <button onClick={addLocation} className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>СОЗДАТЬ</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm}
        title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
}
