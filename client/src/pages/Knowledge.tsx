import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, BookOpen, Clock, Eye, Upload, Download, X, Image as ImageIcon, FileText, File, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { knowledgeApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { NexusInput, NexusTextarea, NexusSelect } from '../components/common/NexusInput';
import NexusFormModal from '../components/common/NexusFormModal';
import { formatDateKR } from '../utils/timezone';

interface Article {
  id: string; title: string; content: string; category: string; tags: string;
  authorId: string; authorName: string; attachmentCount?: number; createdAt: string; updatedAt: string;
}

interface Attachment {
  id: string; articleId: string; type: 'image' | 'document'; url: string;
  filename: string; originalName: string; size: number;
  uploadedBy: string; uploaderName?: string; createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Инструкции': '#00ff88',
  'FAQ': '#00d4ff',
  'Шаблоны': '#bf00ff',
  'Регламенты': '#eab308',
  'Прочее': '#6b7280',
};

const DOC_ICONS: Record<string, typeof FileText> = {
  'application/pdf': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/vnd.ms-excel': File,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': File,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

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

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const currentUserId = (() => { try { return JSON.parse(localStorage.getItem('nexus_user') || '{}').id; } catch { return ''; } })();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

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

  const fetchAttachments = async (articleId: string) => {
    try {
      const res = await knowledgeApi.getAttachments(articleId);
      if (res.success && res.data) setAttachments(res.data);
    } catch { setAttachments([]); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', content: '', category: '', tags: '' });
    setPendingFiles([]);
    setShowModal(true);
  };

  const openEdit = (a: Article) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, category: a.category, tags: a.tags });
    setPendingFiles([]);
    setShowModal(true);
  };

  const openView = async (a: Article) => {
    setViewing(a);
    await fetchAttachments(a.id);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      let articleId = editing?.id;
      if (editing) {
        await knowledgeApi.update(editing.id, form);
        articleId = editing.id;
      } else {
        const res = await knowledgeApi.create(form);
        if (res.success && res.data) articleId = res.data.id;
      }

      // Upload pending files
      if (articleId && pendingFiles.length > 0) {
        setUploading(true);
        let ok = 0;
        for (const file of pendingFiles) {
          try { await knowledgeApi.uploadAttachment(articleId, file); ok++; } catch {}
        }
        setUploading(false);
        if (ok > 0) showToast(`Загружено файлов: ${ok}`, 'success');
      }

      showToast(editing ? 'Обновлено' : 'Создано', 'success');
      setShowModal(false);
      setPendingFiles([]);
      fetchData();
    } catch (e) { showToast('Ошибка', 'error'); }
  };

  const handleDelete = (a: Article) => {
    showConfirm('УДАЛИТЬ?', `"${a.title}" будет удалена.`, async () => {
      try { await knowledgeApi.delete(a.id); showToast('Удалено', 'success'); fetchData(); }
      catch (e: any) { showToast(e?.response?.data?.error || 'Ошибка', 'error'); }
    }, 'danger');
  };

  const handleUploadFiles = async (files: File[]) => {
    if (!viewing) return;
    setUploading(true);
    let ok = 0;
    for (const file of files) {
      try { await knowledgeApi.uploadAttachment(viewing.id, file); ok++; } catch {}
    }
    setUploading(false);
    if (ok > 0) {
      showToast(`Загружено: ${ok}`, 'success');
      fetchAttachments(viewing.id);
    }
  };

  const handleDeleteAttachment = async (att: Attachment) => {
    showConfirm('УДАЛИТЬ ФАЙЛ?', `"${att.originalName}" будет удалён.`, async () => {
      try {
        await knowledgeApi.deleteAttachment(att.id);
        showToast('Удалено', 'success');
        if (viewing) fetchAttachments(viewing.id);
      } catch (e: any) { showToast(e?.response?.data?.error || 'Ошибка', 'error'); }
    }, 'danger');
  };

  const handleDownload = (att: Attachment) => {
    const a = document.createElement('a');
    a.href = att.url;
    a.download = att.originalName || att.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const canDeleteArticle = (a: Article) => a.authorId === currentUserId;
  const canDeleteAttachment = (att: Attachment) => att.uploadedBy === currentUserId || (viewing?.authorId === currentUserId);

  const images = attachments.filter(a => a.type === 'image');
  const documents = attachments.filter(a => a.type === 'document');

  const addPendingFiles = (files: FileList | File[]) => {
    setPendingFiles(prev => [...prev, ...Array.from(files)]);
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><BookOpen className="w-12 h-12 animate-pulse" style={{ color: 'var(--color-primary)' }} /></div>;

  // ── Article detail view ──
  if (viewing) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button onClick={() => { setViewing(null); setAttachments([]); }} className="font-mono text-sm text-gray-400 hover:text-gray-200 transition-colors">
          ← НАЗАД
        </button>

        <div className="glass rounded-2xl p-6 md:p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              {viewing.category && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded mb-2 inline-block"
                  style={{ backgroundColor: `${CATEGORY_COLORS[viewing.category] || '#6b7280'}20`, color: CATEGORY_COLORS[viewing.category] || '#6b7280' }}>
                  {viewing.category}
                </span>
              )}
              <h1 className="text-2xl font-mono text-gray-200 heading-neon">{viewing.title}</h1>
            </div>
            <div className="flex gap-2 flex-shrink-0 ml-3">
              <button onClick={() => { setViewing(null); openEdit(viewing); }} className="p-2 rounded hover:bg-white/10">
                <Edit3 className="w-4 h-4 text-gray-400" />
              </button>
              {canDeleteArticle(viewing) && (
                <button onClick={() => { setViewing(null); handleDelete(viewing); }} className="p-2 rounded hover:bg-red-500/20">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              )}
            </div>
          </div>

          {viewing.tags && (
            <div className="flex flex-wrap gap-1 mb-4">
              {viewing.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">#{tag}</span>
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

        {/* ── Image Gallery ── */}
        {images.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <h2 className="font-mono text-sm font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
              <ImageIcon className="w-4 h-4 inline mr-2" />ГАЛЕРЕЯ ({images.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((att, idx) => (
                <div key={att.id} className="relative rounded-xl overflow-hidden group">
                  <img src={att.url} alt={att.originalName} draggable="false"
                    className="w-full h-32 object-cover select-none cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setLightboxIdx(idx)} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-gray-300 truncate max-w-[60%]">{att.originalName}</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleDownload(att)} className="p-1 rounded bg-black/50 hover:bg-black/80" title="Скачать">
                          <Download className="w-3 h-3 text-white" />
                        </button>
                        {canDeleteAttachment(att) && (
                          <button onClick={() => handleDeleteAttachment(att)} className="p-1 rounded bg-black/50 hover:bg-red-500/80" title="Удалить">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Documents ── */}
        {documents.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <h2 className="font-mono text-sm font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
              <FileText className="w-4 h-4 inline mr-2" />ДОКУМЕНТЫ ({documents.length})
            </h2>
            <div className="space-y-2">
              {documents.map(att => {
                const Icon = FileText;
                const ext = getFileExt(att.originalName).toUpperCase();
                return (
                  <div key={att.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors group">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                      <Icon className="w-5 h-5 text-[#00d4ff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-sm text-gray-200 truncate block">{att.originalName}</span>
                      <span className="font-mono text-[10px] text-gray-500">{ext} &middot; {formatSize(att.size)}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleDownload(att)} className="p-2 rounded hover:bg-white/10" title="Скачать">
                        <Download className="w-4 h-4 text-gray-400" />
                      </button>
                      {canDeleteAttachment(att) && (
                        <button onClick={() => handleDeleteAttachment(att)} className="p-2 rounded hover:bg-red-500/20" title="Удалить">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Upload zone ── */}
        <div className="glass rounded-2xl p-6">
          <label
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = ''; }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '';
              handleUploadFiles(e.dataTransfer.files);
            }}
            className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
            <Upload className="w-6 h-6 text-gray-400" />
            <span className="font-mono text-xs text-gray-400">ЗАГРУЗИТЬ ФАЙЛЫ</span>
            <span className="font-mono text-[10px] text-gray-600">Фото, PDF, Word, Excel</span>
            <input ref={fileInputRef} type="file" multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              className="hidden"
              onChange={e => { if (e.target.files) handleUploadFiles(e.target.files); e.target.value = ''; }} />
          </label>
        </div>

        {/* ── Lightbox ── */}
        <AnimatePresence>
          {lightboxIdx !== null && images.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }}
              onClick={() => setLightboxIdx(null)}>
              <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null && i > 0 ? i - 1 : images.length - 1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 z-10">
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <motion.img key={images[lightboxIdx]?.id}
                src={images[lightboxIdx]?.url} alt=""
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl select-none"
                onClick={e => e.stopPropagation()} />
              <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null && i < images.length - 1 ? i + 1 : 0); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 z-10">
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                <span className="font-mono text-sm text-gray-400">{lightboxIdx + 1} / {images.length}</span>
                <button onClick={e => { e.stopPropagation(); handleDownload(images[lightboxIdx]); }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-mono text-sm text-white flex items-center gap-2">
                  <Download className="w-4 h-4" /> СКАЧАТЬ
                </button>
              </div>
              <button onClick={() => setLightboxIdx(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20">
                <X className="w-6 h-6 text-white" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm}
          title={confirmState.title} message={confirmState.message} type={confirmState.type} />
      </div>
    );
  }

  // ── List view ──
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
            onClick={() => openView(a)}>
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
                {canDeleteArticle(a) && (
                  <button onClick={() => handleDelete(a)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                )}
              </div>
            </div>
            <p className="font-mono text-xs text-gray-500 line-clamp-3 mb-2">{a.content}</p>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1 items-center">
                {a.tags ? a.tags.split(',').slice(0, 3).map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-500">#{tag}</span>
                )) : null}
                {(a.attachmentCount || 0) > 0 && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-500 flex items-center gap-1">
                    <ImageIcon className="w-2.5 h-2.5" /> {a.attachmentCount}
                  </span>
                )}
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

      <NexusFormModal isOpen={showModal} onClose={() => { setShowModal(false); setPendingFiles([]); }}
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

          {/* File upload in modal */}
          <div className="pt-2 border-t border-white/5">
            <label className="font-mono text-xs text-gray-400 mb-2 block">ФАЙЛЫ</label>
            {pendingFiles.length > 0 && (
              <div className="space-y-1 mb-3">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03]">
                    {f.type.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-gray-500" /> : <FileText className="w-3.5 h-3.5 text-gray-500" />}
                    <span className="font-mono text-xs text-gray-300 flex-1 truncate">{f.name}</span>
                    <span className="font-mono text-[10px] text-gray-600">{formatSize(f.size)}</span>
                    <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="font-mono text-[10px] text-gray-500">Фото, PDF, Word, Excel</span>
              <input ref={modalFileInputRef} type="file" multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                className="hidden"
                onChange={e => { if (e.target.files) addPendingFiles(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
        </div>
      </NexusFormModal>

      <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm}
        title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
}
