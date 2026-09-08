import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, Calendar, MapPin, DollarSign, ArrowLeft, Clock, Camera, Image, ChevronRight, User } from 'lucide-react';
import { eventsApi } from '../services/api';
import { showToast, ConfirmModal } from '../components/ui/NexusModal';
import { NexusInput, NexusTextarea, NexusSelect } from '../components/common/NexusInput';
import NexusFormModal from '../components/common/NexusFormModal';
import { useCrudPage } from '../hooks/useCrudPage';
import { formatDateTimeKR } from '../utils/timezone';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planned: { label: 'Запланировано', color: '#00d4ff' },
  in_progress: { label: 'В процессе', color: '#eab308' },
  completed: { label: 'Завершено', color: '#00ff88' },
  cancelled: { label: 'Отменено', color: '#6b7280' },
};

const DEFAULT_FORM = { title: '', description: '', date: '', location: '', status: 'planned', responsiblePerson: '', budget: 0, imageUrl: '' };

export default function Events() {
  const {
    items: events, isLoading, showModal, setShowModal,
    editing, setEditing, search, setSearch, form, setForm,
    fetchData, openCreate, openEdit, handleSave,
    confirmState, showConfirm, closeConfirm
  } = useCrudPage({
    api: eventsApi,
    defaultForm: DEFAULT_FORM,
    getFormFromItem: (e: any) => ({ title: e.title, description: e.description, date: e.date || '', location: e.location, status: e.status, responsiblePerson: e.responsiblePerson, budget: e.budget, imageUrl: e.imageUrl || '' }),
  });

  const [viewing, setViewing] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockForm, setBlockForm] = useState({ title: '', description: '', responsiblePerson: '', deadline: '' });
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchBlocks = async (eventId: string) => {
    try { const res = await eventsApi.getBlocks(eventId); if (res.success && res.data) setBlocks(res.data); } catch {}
  };

  const handleAddBlock = async () => {
    if (!viewing || !blockForm.title) return;
    try {
      await eventsApi.createBlock(viewing.id, blockForm);
      setBlockForm({ title: '', description: '', responsiblePerson: '', deadline: '' });
      setShowBlockForm(false);
      fetchBlocks(viewing.id);
      showToast('Блок добавлен', 'success');
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!viewing) return;
    try { await eventsApi.deleteBlock(viewing.id, blockId); fetchBlocks(viewing.id); showToast('Удалено', 'success'); }
    catch { showToast('Ошибка', 'error'); }
  };

  const filtered = events.filter((e: any) => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleImageUpload = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    try {
      const res = await eventsApi.uploadImage(editing.id, file);
      if (res.success && res.data) {
        setForm((prev: any) => ({ ...prev, imageUrl: res.data.imageUrl }));
        setEditing({ ...editing, imageUrl: res.data.imageUrl });
        showToast('Фото загружено', 'success');
      }
    } catch (e) { showToast('Ошибка загрузки', 'error'); }
    finally { setUploading(false); }
  };

  const onDeleteEvent = (e: any) => {
    showConfirm('УДАЛИТЬ?', `"${e.title}" будет удалено.`, async () => {
      try { await eventsApi.delete(e.id); showToast('Удалено', 'success'); setViewing(null); fetchData(); }
      catch (err) { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  useEffect(() => { if (viewing) fetchBlocks(viewing.id); else setBlocks([]); }, [viewing?.id]);

  if (isLoading) return <div className="flex items-center justify-center h-full"><Calendar className="w-12 h-12 animate-pulse" style={{ color: 'var(--color-primary)' }} /></div>;

  if (viewing) {
    const sc = STATUS_CONFIG[viewing.status] || STATUS_CONFIG.planned;
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setViewing(null)} className="mb-4 flex items-center gap-2 font-mono text-sm text-gray-400 hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4" /> НАЗАД
        </button>
        <div className="glass rounded-2xl overflow-hidden">
          {viewing.imageUrl && (
            <div className="h-48 md:h-64 overflow-hidden">
              <img loading="lazy" decoding="async" src={viewing.imageUrl} alt={viewing.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 md:p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded mb-2 inline-block"
                  style={{ backgroundColor: `${sc.color}20`, color: sc.color }}>{sc.label}</span>
              <h1 className="text-2xl font-bold font-mono text-gray-200">{viewing.title}</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setViewing(null); openEdit(viewing); }} className="p-2 rounded-lg hover:bg-white/10"><Edit3 className="w-4 h-4 text-gray-400" /></button>
              <button onClick={() => onDeleteEvent(viewing)} className="p-2 rounded-lg hover:bg-red-500/20"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
          </div>

          {viewing.description && (
            <p className="text-sm text-gray-300 leading-relaxed mb-6 whitespace-pre-wrap">{viewing.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {viewing.date && (
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1 text-gray-500 text-xs font-mono"><Calendar className="w-3.5 h-3.5" /> ДАТА</div>
                <p className="font-mono text-sm text-gray-200">{viewing.date}</p>
              </div>
            )}
            {viewing.location && (
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1 text-gray-500 text-xs font-mono"><MapPin className="w-3.5 h-3.5" /> МЕСТО</div>
                <p className="font-mono text-sm text-gray-200">{viewing.location}</p>
              </div>
            )}
            {viewing.responsiblePerson && (
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1 text-gray-500 text-xs font-mono">👤 ОТВЕТСТВЕННЫЙ</div>
                <p className="font-mono text-sm text-gray-200">{viewing.responsiblePerson}</p>
              </div>
            )}
            {viewing.budget > 0 && (
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1 text-gray-500 text-xs font-mono"><DollarSign className="w-3.5 h-3.5" /> БЮДЖЕТ</div>
                <p className="font-mono text-sm text-gray-200">{viewing.budget.toLocaleString('ru-RU')} ₽</p>
              </div>
            )}
          </div>

          {/* Blocks (sub-tasks) */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>// БЛОКИ ({blocks.length})</h3>
              <button onClick={() => setShowBlockForm(!showBlockForm)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors hover:bg-white/5" style={{ color: 'var(--color-primary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Plus className="w-3 h-3" /> Добавить
              </button>
            </div>

            <AnimatePresence>
              {showBlockForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="glass-card rounded-xl p-4 mb-3 space-y-3 overflow-hidden">
                  <input value={blockForm.title} onChange={e => setBlockForm({ ...blockForm, title: e.target.value })}
                    placeholder="Название блока" className="w-full px-3 py-2 rounded-lg bg-black/30 border border-gray-700 text-sm text-gray-200 font-mono" />
                  <textarea value={blockForm.description} onChange={e => setBlockForm({ ...blockForm, description: e.target.value })}
                    placeholder="Описание" rows={2} className="w-full px-3 py-2 rounded-lg bg-black/30 border border-gray-700 text-sm text-gray-200 font-mono resize-none" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={blockForm.responsiblePerson} onChange={e => setBlockForm({ ...blockForm, responsiblePerson: e.target.value })}
                      placeholder="Ответственный" className="px-3 py-2 rounded-lg bg-black/30 border border-gray-700 text-sm text-gray-200 font-mono" />
                    <input type="date" value={blockForm.deadline} onChange={e => setBlockForm({ ...blockForm, deadline: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-black/30 border border-gray-700 text-sm text-gray-200 font-mono" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowBlockForm(false)} className="flex-1 py-2 rounded-lg text-xs font-mono text-gray-400 hover:bg-white/5 border border-gray-700">Отмена</button>
                    <button onClick={handleAddBlock} className="flex-1 py-2 rounded-lg text-xs font-mono font-bold" style={{ background: 'var(--color-primary)', color: '#000' }}>Добавить</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {blocks.length > 0 ? (
              <div className="space-y-2">
                {blocks.map((block: any) => (
                  <div key={block.id} className="glass-card rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedBlock(expandedBlock === block.id ? null : block.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors">
                      <span className="text-sm font-medium text-gray-200 flex-1 truncate">{block.title}</span>
                      {block.responsiblePerson && <span className="text-[10px] font-mono text-gray-500 flex-shrink-0"><User className="w-3 h-3 inline mr-1" />{block.responsiblePerson}</span>}
                      {block.deadline && <span className="text-[10px] font-mono text-gray-500 flex-shrink-0"><Clock className="w-3 h-3 inline mr-1" />{block.deadline}</span>}
                      <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${expandedBlock === block.id ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {expandedBlock === block.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-white/5">
                          <div className="px-4 pb-3 pt-2">
                            {block.description && <p className="text-xs text-gray-400 mb-2 whitespace-pre-wrap">{block.description}</p>}
                            <button onClick={() => handleDeleteBlock(block.id)} className="text-[10px] font-mono text-red-400 hover:text-red-300 transition-colors">
                              <Trash2 className="w-3 h-3 inline mr-1" /> Удалить блок
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-gray-600 text-center py-4">// НЕТ БЛОКОВ</p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-white/5 font-mono text-[10px] text-gray-600 flex items-center gap-4">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Создано: {formatDateTimeKR(viewing.createdAt)}</span>
            <span>Обновлено: {formatDateTimeKR(viewing.updatedAt)}</span>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <Calendar className="w-7 h-7 md:w-8 md:h-8" /> МЕРОПРИЯТИЯ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// {events.length} ЗАПИСЕЙ</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
              className="pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] w-44" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
            <option value="">ВСЕ СТАТУСЫ</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" /> ДОБАВИТЬ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {filtered.map((e: any) => {
          const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.planned;
          return (
            <motion.div key={e.id} layout
              className="glass-card rounded-xl overflow-hidden group cursor-pointer hover:border-[var(--color-primary)]/20 transition-all"
              onClick={() => setViewing(e)}>
              {e.imageUrl && (
                <div className="h-32 overflow-hidden">
                  <img loading="lazy" decoding="async" src={e.imageUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-mono text-sm font-bold text-gray-200 truncate">{e.title}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded mt-1 inline-block"
                      style={{ backgroundColor: `${sc.color}20`, color: sc.color }}>{sc.label}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={ev => ev.stopPropagation()}>
                    <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-white/10"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={() => onDeleteEvent(e)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
                {e.description && <p className="font-mono text-xs text-gray-500 mb-2 line-clamp-2">{e.description}</p>}
                <div className="space-y-1 text-[10px] font-mono text-gray-400">
                  {e.date && <p className="flex items-center gap-1"><Calendar className="w-3 h-3" />{e.date}</p>}
                  {e.location && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</p>}
                  {e.budget > 0 && <p className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{e.budget.toLocaleString('ru-RU')} ₽</p>}
                </div>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
            <p className="font-mono text-gray-500">// МЕРОПРИЯТИЙ НЕТ</p>
          </div>
        )}
      </div>

      <NexusFormModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'РЕДАКТИРОВАТЬ' : 'НОВОЕ МЕРОПРИЯТИЕ'} onSave={handleSave}
        saveLabel={editing ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}>
        <div className="space-y-3">
          {editing && (
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                {form.imageUrl ? (
                  <img loading="lazy" decoding="async" src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Image className="w-6 h-6 text-gray-600" /></div>
                )}
              </div>
              <div>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-colors">
                  <Camera className="w-3.5 h-3.5" /> {uploading ? 'ЗАГРУЗКА...' : 'ФОТО'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
              </div>
            </div>
          )}
          <NexusInput value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="// НАЗВАНИЕ *" />
          <NexusTextarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="// ОПИСАНИЕ" rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-xs text-gray-500 mb-1 block">ДАТА</label>
              <NexusInput type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <NexusSelect value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </NexusSelect>
          </div>
          <NexusInput value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="// МЕСТО ПРОВЕДЕНИЯ" />
          <div className="grid grid-cols-2 gap-3">
            <NexusInput value={form.responsiblePerson} onChange={e => setForm({ ...form, responsiblePerson: e.target.value })} placeholder="// ОТВЕТСТВЕННЫЙ" />
            <NexusInput type="number" min={0} value={form.budget} onChange={e => setForm({ ...form, budget: Number(e.target.value) })} placeholder="БЮДЖЕТ (₽)" />
          </div>
        </div>
      </NexusFormModal>

      <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm}
        title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
}
