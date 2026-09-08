import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, X, Building2, Mail, Phone, MapPin, Send, ArrowLeft } from 'lucide-react';
import { Partner } from '../types';
import { partnersApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { NexusInput, NexusTextarea, NexusSelect } from '../components/common/NexusInput';
import NexusFormModal from '../components/common/NexusFormModal';

const DEFAULT_CATEGORIES = ['Фотографы', 'Тур-операторы', 'Бизнес'];
const CAT_STORAGE_KEY = 'nexus-partner-categories';

function loadCategories(): string[] {
  try {
    const saved = localStorage.getItem(CAT_STORAGE_KEY);
    if (saved) return [...new Set([...DEFAULT_CATEGORIES, ...JSON.parse(saved)])];
  } catch (e) { /* ignore */ }
  return [...DEFAULT_CATEGORIES];
}

function saveCategories(cats: string[]) {
  try { localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(cats)); } catch (e) { /* ignore */ }
}

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<string[]>(loadCategories);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCat, setNewCat] = useState('');
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [form, setForm] = useState({ name: '', category: '', contactPerson: '', email: '', phone: '', address: '', inn: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const res = await partnersApi.getAll();
      if (res.success && res.data) setPartners(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Count partners per category
  const catCounts: Record<string, number> = {};
  partners.forEach(p => {
    const cat = (p as any).category || 'Без категории';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  // Filtered list when category selected
  const filtered = activeCategory
    ? partners.filter(p => ((p as any).category || 'Без категории') === activeCategory)
    : [];

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', category: activeCategory || '', contactPerson: '', email: '', phone: '', address: '', inn: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({ name: p.name, category: (p as any).category || '', contactPerson: p.contactPerson, email: p.email, phone: p.phone, address: p.address, inn: p.inn, notes: p.notes });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing) {
        await partnersApi.update(editing.id, form);
        showToast('Обновлено', 'success');
      } else {
        await partnersApi.create(form);
        showToast('Создано', 'success');
      }
      setShowModal(false);
      fetchData();
    } catch (e) { showToast('Ошибка', 'error'); }
  };

  const handleDelete = (p: Partner) => {
    showConfirm('УДАЛИТЬ?', `"${p.name}" будет удалён.`, async () => {
      try { await partnersApi.delete(p.id); showToast('Удалено', 'success'); fetchData(); }
      catch (e) { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  const addCategory = () => {
    const name = newCat.trim();
    if (!name || categories.includes(name)) return;
    const updated = [...categories, name];
    setCategories(updated);
    saveCategories(updated);
    setNewCat('');
  };

  const removeCategory = (cat: string) => {
    if (DEFAULT_CATEGORIES.includes(cat)) return;
    const updated = categories.filter(c => c !== cat);
    setCategories(updated);
    saveCategories(updated);
  };

  const getShareText = (p: Partner) =>
    [p.name, p.contactPerson && `👤 ${p.contactPerson}`, p.phone && `📞 ${p.phone}`, p.email && `📧 ${p.email}`, p.address && `📍 ${p.address}`].filter(Boolean).join('\n');

  const sendTelegram = (p: Partner) => {
    const text = encodeURIComponent(getShareText(p));
    window.open(`https://t.me/share/url?text=${text}`, '_blank');
  };

  const sendMax = async (p: Partner) => {
    const text = getShareText(p);
    // Try Web Share API first — opens native share sheet where user picks chat
    if (navigator.share) {
      try {
        await navigator.share({ title: p.name, text });
        return;
      } catch (e) { /* user cancelled */ }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      showToast('Скопировано — вставьте в МАКС', 'success');
    } catch (e) {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      showToast('Скопировано — вставьте в МАКС', 'success');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><Building2 className="w-12 h-12 animate-pulse" style={{ color: 'var(--color-primary)' }} /></div>;

  // Category tiles view
  if (!activeCategory) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
              <Building2 className="w-7 h-7 md:w-8 md:h-8" /> ПАРТНЁРЫ
            </h1>
            <p className="text-gray-400 mt-1 font-mono text-sm">// {partners.length} ПАРТНЁРОВ • {categories.length} КАТЕГОРИЙ</p>
          </div>
          <button onClick={() => setShowCatModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold glass hover:bg-white/10">
            <Plus className="w-4 h-4" /> КАТЕГОРИЯ
          </button>
        </div>

        {/* Category tiles */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categories.map(cat => (
              <motion.button key={cat} whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}
                onClick={() => setActiveCategory(cat)}
                className="glass-card rounded-2xl p-6 text-left transition-all hover:border-[var(--color-primary)]/40 group">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center glass-accent">
                    <Building2 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <span className="font-mono text-3xl font-bold neon-text" style={{ color: 'var(--color-primary)' }}>
                    {catCounts[cat] || 0}
                  </span>
                </div>
                <h3 className="font-mono text-lg font-bold text-gray-200 group-hover:text-white transition-colors">{cat}</h3>
                <p className="font-mono text-xs text-gray-500 mt-1">
                  {(catCounts[cat] || 0) === 0 ? '// ПУСТО' : `// ${catCounts[cat]} ПАРТНЁР${catCounts[cat] === 1 ? '' : catCounts[cat] < 5 ? 'А' : 'ОВ'}`}
                </p>
              </motion.button>
            ))}

            {/* "Без категории" tile if there are uncategorized partners */}
            {(catCounts['Без категории'] || 0) > 0 && (
              <motion.button whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}
                onClick={() => setActiveCategory('Без категории')}
                className="glass-card rounded-2xl p-6 text-left transition-all hover:border-gray-500/40 group opacity-60 hover:opacity-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5">
                    <Building2 className="w-6 h-6 text-gray-500" />
                  </div>
                  <span className="font-mono text-3xl font-bold text-gray-400">{catCounts['Без категории']}</span>
                </div>
                <h3 className="font-mono text-lg font-bold text-gray-400">Без категории</h3>
                <p className="font-mono text-xs text-gray-600 mt-1">// {catCounts['Без категории']} ПАРТНЁР{catCounts['Без категории'] === 1 ? '' : 'А'}</p>
              </motion.button>
            )}
          </div>
        </div>

        {/* Category Manager Modal */}
        <AnimatePresence>
          {showCatModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowCatModal(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="glass-frost rounded-2xl p-6 w-full max-w-sm" style={{ border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>КАТЕГОРИИ</h2>
                  <button onClick={() => setShowCatModal(false)} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {categories.map(c => (
                    <div key={c} className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20">
                      <span className="font-mono text-sm text-gray-200">{c} <span className="text-gray-500">({catCounts[c] || 0})</span></span>
                      {!DEFAULT_CATEGORIES.includes(c) && (
                        <button onClick={() => removeCategory(c)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="// НОВАЯ КАТЕГОРИЯ"
                    className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]"
                    onKeyDown={e => e.key === 'Enter' && addCategory()} />
                  <button onClick={addCategory} className="px-4 py-2 rounded-lg font-mono text-sm font-bold"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>+</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Partners list inside category
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveCategory(null)} className="p-2 rounded-lg glass hover:bg-white/10">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>
              {activeCategory}
            </h1>
            <p className="text-gray-400 mt-1 font-mono text-sm">// {filtered.length} ПАРТНЁРОВ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
              className="pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] w-48" />
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" /> ДОБАВИТЬ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {filtered.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.contactPerson.toLowerCase().includes(search.toLowerCase())).map(p => (
          <motion.div key={p.id} layout className="glass-card rounded-xl p-4 group">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-mono text-sm font-bold text-gray-200">{p.name}</h3>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-white/10"><Edit3 className="w-4 h-4 text-gray-400" /></button>
                <button onClick={() => handleDelete(p)} className="p-1.5 rounded hover:bg-red-500/20"><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
            </div>
            <div className="space-y-1.5 text-xs font-mono text-gray-400">
              {p.contactPerson && <p>👤 {p.contactPerson}</p>}
              {p.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</p>}
              {p.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</p>}
              {p.address && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.address}</p>}
              {p.inn && <p>ИНН: {p.inn}</p>}
              {p.notes && <p className="text-gray-500 mt-1">{p.notes}</p>}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
              <button onClick={() => sendTelegram(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
                <Send className="w-3 h-3" /> Telegram
              </button>
              <button onClick={() => sendMax(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors">
                <Send className="w-3 h-3" /> МАКС
              </button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
            <p className="font-mono text-gray-500">// ПАРТНЁРОВ НЕТ</p>
          </div>
        )}
      </div>

      <NexusFormModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'РЕДАКТИРОВАТЬ' : 'НОВЫЙ ПАРТНЁР'} onSave={handleSave}
        saveLabel={editing ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}>
        <div className="space-y-3">
          <NexusInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="// НАЗВАНИЕ *" />
          <NexusSelect value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            <option value="">БЕЗ КАТЕГОРИИ</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </NexusSelect>
          <NexusInput value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} placeholder="// КОНТАКТНОЕ ЛИЦО" />
          <div className="grid grid-cols-2 gap-3">
            <NexusInput value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="// EMAIL" />
            <NexusInput value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="// ТЕЛЕФОН" />
          </div>
          <NexusInput value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="// АДРЕС" />
          <NexusInput value={form.inn} onChange={e => setForm({ ...form, inn: e.target.value })} placeholder="// ИНН" />
          <NexusTextarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="// ЗАМЕТКИ" rows={2} />
        </div>
      </NexusFormModal>

      <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm}
        title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
}
