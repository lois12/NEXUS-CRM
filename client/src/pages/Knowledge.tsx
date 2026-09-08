import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, BookOpen, Clock, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { knowledgeApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { NexusInput, NexusTextarea, NexusSelect } from '../components/common/NexusInput';
import NexusFormModal from '../components/common/NexusFormModal';
import { formatDateKR } from '../utils/timezone';

interface Article {
  id: string; title: string; content: string; category: string; tags: string;
  authorId: string; authorName: string; createdAt: string; updatedAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Инструкции': '#00ff88',
  'FAQ': '#00d4ff',
  'Шаблоны': '#bf00ff',
  'Регламенты': '#eab308',
  'Прочее': '#6b7280',
};

export default function Knowledge() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [viewing, setViewing] = useState<Article | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [form, setForm] = useState({ title: '', content: '', category: '', tags: '' });

  const fetchData = useCallback(async () => {
    try {
      const res = await knowledgeApi.getAll();
      if (res.success && res.data) setArticles(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categories = [...new Set(articles.map(a => a.category).filter(Boolean))];
  const allTags = [...new Set(articles.flatMap(a => a.tags ? a.tags.split(',').map(t => t.trim()) : []).filter(Boolean))];

  const filtered = articles.filter(a => {
    if (filterCategory && a.category !== filterCategory) return false;
    if (filterTag && !a.tags.includes(filterTag)) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', content: '', category: '', tags: '' });
    setShowModal(true);
  };

  const openEdit = (a: Article) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, category: a.category, tags: a.tags });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      if (editing) { await knowledgeApi.update(editing.id, form); showToast('Обновлено', 'success'); }
      else { await knowledgeApi.create(form); showToast('Создано', 'success'); }
      setShowModal(false);
      fetchData();
    } catch (e) { showToast('Ошибка', 'error'); }
  };

  const handleDelete = (a: Article) => {
    showConfirm('УДАЛИТЬ?', `"${a.title}" будет удалена.`, async () => {
      try { await knowledgeApi.delete(a.id); showToast('Удалено', 'success'); fetchData(); }
      catch (e) { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><BookOpen className="w-12 h-12 animate-pulse" style={{ color: 'var(--color-primary)' }} /></div>;

  if (viewing) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setViewing(null)} className="mb-4 font-mono text-sm text-gray-400 hover:text-gray-200 transition-colors">
          ← НАЗАД
        </button>
        <div className="glass rounded-2xl p-6 md:p-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              {viewing.category && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded mb-2 inline-block"
                  style={{ backgroundColor: `${CATEGORY_COLORS[viewing.category] || '#6b7280'}20`, color: CATEGORY_COLORS[viewing.category] || '#6b7280' }}>
                  {viewing.category}
                </span>
              )}
              <h1 className="text-2xl font-mono text-gray-200 heading-neon">{viewing.title}</h1>
            </div>
            <button onClick={() => { setViewing(null); openEdit(viewing); }} className="p-2 rounded hover:bg-white/10">
              <Edit3 className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          {viewing.tags && (
            <div className="flex flex-wrap gap-1 mb-4">
              {viewing.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="font-mono text-xs text-gray-500 mb-6 flex items-center gap-4">
            {viewing.authorName && <span>👤 {viewing.authorName}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateKR(viewing.updatedAt)}</span>
          </div>
          <div className="text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{viewing.content || ''}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh-minus-header flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <BookOpen className="w-7 h-7 md:w-8 md:h-8" /> БАЗА ЗНАНИЙ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// {articles.length} СТАТЕЙ</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
              className={`pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] w-44 transition-all ${!search ? 'search-cursor' : ''}`} />
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
            <option value="">ВСЕ КАТЕГОРИИ</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
            className="px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
            <option value="">ВСЕ ТЕГИ</option>
            {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" /> СТАТЬЯ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {filtered.map(a => (
          <motion.div key={a.id} layout
            className="glass-card rounded-xl p-4 group cursor-pointer hover:border-[var(--color-primary)]/20 transition-all"
            onClick={() => setViewing(a)}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                {a.category && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded mb-1 inline-block"
                    style={{ backgroundColor: `${CATEGORY_COLORS[a.category] || '#6b7280'}20`, color: CATEGORY_COLORS[a.category] || '#6b7280' }}>
                    {a.category}
                  </span>
                )}
                <h3 className="font-mono text-sm font-bold text-gray-200 truncate">{a.title}</h3>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-white/10"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                <button onClick={() => handleDelete(a)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
              </div>
            </div>
            <p className="font-mono text-xs text-gray-500 line-clamp-3 mb-2">{a.content}</p>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {a.tags ? a.tags.split(',').slice(0, 3).map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-500">#{tag}</span>
                )) : null}
              </div>
              <span className="text-[10px] font-mono text-gray-600 flex items-center gap-1">
                <Eye className="w-3 h-3" />{formatDateKR(a.updatedAt)}
              </span>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
            <p className="font-mono text-gray-500">// СТАТЕЙ НЕТ</p>
          </div>
        )}
      </div>

      <NexusFormModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'РЕДАКТИРОВАТЬ' : 'НОВАЯ СТАТЬЯ'} onSave={handleSave}
        saveLabel={editing ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'} maxWidth="max-w-2xl">
        <div className="space-y-3">
          <NexusInput value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="// ЗАГОЛОВОК *" />
          <div className="grid grid-cols-2 gap-3">
            <NexusSelect value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">БЕЗ КАТЕГОРИИ</option>
              {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
            </NexusSelect>
            <NexusInput value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="// ТЕГИ (через запятую)" />
          </div>
          <NexusTextarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="// СОДЕРЖАНИЕ..." rows={12} />
        </div>
      </NexusFormModal>

      <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm}
        title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
}
