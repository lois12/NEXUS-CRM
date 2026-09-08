import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, X, Download, Upload, Image, FileText, Film, Music, Edit3, Grid, List, Sliders } from 'lucide-react';
import { brandApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { NexusInput, NexusSelect } from '../components/common/NexusInput';
import { formatDateKR } from '../utils/timezone';

const CATEGORIES = [
  { id: 'logo', label: 'Логотипы', icon: Image, color: '#00ff88' },
  { id: 'brand', label: 'Брендбук', icon: FileText, color: '#00d4ff' },
  { id: 'template', label: 'Шаблоны', icon: FileText, color: '#bf00ff' },
  { id: 'photo', label: 'Фото', icon: Image, color: '#eab308' },
  { id: 'video', label: 'Видео', icon: Film, color: '#ff00ff' },
  { id: 'audio', label: 'Аудио', icon: Music, color: '#ff3b30' },
  { id: 'other', label: 'Прочее', icon: FileText, color: '#6b7280' },
];

const GRID_PRESETS = [
  { label: 'XS', cols: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8', imgH: 'h-20', textSize: 'text-[10px]' },
  { label: 'S', cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6', imgH: 'h-28', textSize: 'text-xs' },
  { label: 'M', cols: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4', imgH: 'h-32', textSize: 'text-sm' },
  { label: 'L', cols: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3', imgH: 'h-44', textSize: 'text-sm' },
  { label: 'XL', cols: 'grid-cols-1 sm:grid-cols-2', imgH: 'h-56', textSize: 'text-base' },
];

interface Asset {
  id: string; name: string; category: string; description: string;
  url: string; mimeType: string; size: number; uploaderName: string;
  createdAt: string; updatedAt: string;
}

function getCategoryConfig(cat: string) {
  return CATEGORIES.find(c => c.id === cat) || CATEGORIES[CATEGORIES.length - 1];
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function isImage(mime: string) {
  return mime.startsWith('image/');
}

export default function BrandBank() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('nexus_brandbank_view') as 'grid' | 'list') || 'grid');
  const [gridSize, setGridSize] = useState(() => {
    const saved = localStorage.getItem('nexus_brandbank_grid');
    return saved ? parseInt(saved) : 2;
  });
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [form, setForm] = useState({ name: '', category: 'logo', description: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const preset = GRID_PRESETS[gridSize];

  useEffect(() => { localStorage.setItem('nexus_brandbank_view', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('nexus_brandbank_grid', String(gridSize)); }, [gridSize]);

  const fetchData = useCallback(async () => {
    try {
      const res = await brandApi.getAll();
      if (res.success && res.data) setAssets(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Category counts
  const catCounts: Record<string, number> = {};
  assets.forEach(a => { catCounts[a.category] = (catCounts[a.category] || 0) + 1; });

  const filtered = assets.filter(a => {
    if (filterCategory && a.category !== filterCategory) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (!form.name) setForm(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!form.name.trim() || !selectedFile) { showToast('Название и файл обязательны', 'error'); return; }
    setUploading(true);
    try {
      await brandApi.upload(selectedFile, form);
      showToast('Загружено', 'success');
      setShowModal(false);
      setForm({ name: '', category: 'logo', description: '' });
      setSelectedFile(null);
      setPreview(null);
      fetchData();
    } catch (e) { showToast('Ошибка', 'error'); }
    finally { setUploading(false); }
  };

  const handleUpdate = async () => {
    if (!editingAsset || !form.name.trim()) return;
    setUploading(true);
    try {
      await brandApi.update(editingAsset.id, { name: form.name, category: form.category, description: form.description });
      showToast('Обновлено', 'success');
      setShowModal(false);
      setEditingAsset(null);
      fetchData();
    } catch (e) { showToast('Ошибка', 'error'); }
    finally { setUploading(false); }
  };

  const handleDelete = (a: Asset) => {
    showConfirm('УДАЛИТЬ?', `"${a.name}" будет удалён.`, async () => {
      try { await brandApi.delete(a.id); showToast('Удалено', 'success'); fetchData(); }
      catch (e) { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  const openCreateModal = () => {
    setEditingAsset(null);
    setForm({ name: '', category: 'logo', description: '' });
    setSelectedFile(null);
    setPreview(null);
    setShowModal(true);
  };

  const openEditModal = (a: Asset) => {
    setEditingAsset(a);
    setForm({ name: a.name, category: a.category, description: a.description });
    setSelectedFile(null);
    setPreview(isImage(a.mimeType) ? a.url : null);
    setShowModal(true);
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><Upload className="w-12 h-12 animate-pulse" style={{ color: 'var(--color-primary)' }} /></div>;

  return (
    <div className="h-dvh-minus-header flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <Upload className="w-7 h-7 md:w-8 md:h-8" /> БАНК ПРОМО
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// {assets.length} ФАЙЛОВ</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
              className="pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] w-44" />
          </div>

          {/* Grid size presets */}
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4" style={{ color: '#5a5a70' }} />
            <div className="flex gap-1">
              {GRID_PRESETS.map((p, i) => (
                <button key={p.label} onClick={() => setGridSize(i)}
                  className="px-2 py-1 rounded text-[10px] font-mono transition-all"
                  style={gridSize === i
                    ? { background: 'var(--color-primary)', color: '#000' }
                    : { color: '#5a5a70', background: 'rgba(255,255,255,0.03)' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-1 rounded-lg overflow-hidden border border-gray-700">
            <button onClick={() => setViewMode('grid')}
              className={`p-2 transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <Grid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-2 transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>

          <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" /> ЗАГРУЗИТЬ
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCategory('')}
          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${!filterCategory ? 'text-black' : 'glass text-gray-400 hover:text-gray-200'}`}
          style={!filterCategory ? { backgroundColor: 'var(--color-primary)' } : {}}>
          ВСЕ ({assets.length})
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setFilterCategory(cat.id === filterCategory ? '' : cat.id)}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${filterCategory === cat.id ? 'text-black' : 'glass text-gray-400 hover:text-gray-200'}`}
            style={filterCategory === cat.id ? { backgroundColor: cat.color } : {}}>
            {cat.label} ({catCounts[cat.id] || 0})
          </button>
        ))}
      </div>

      {/* Grid / List */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'grid' ? (
          <div className={`grid ${preset.cols} gap-3`}>
            {filtered.map(a => {
              const cat = getCategoryConfig(a.category);
              const CatIcon = cat.icon;
              return (
                <motion.div key={a.id} layout
                  className="glass-card rounded-xl overflow-hidden group relative">
                  {/* Preview */}
                  <div className={`flex items-center justify-center ${preset.imgH} bg-white/5 overflow-hidden`}>
                    {isImage(a.mimeType) ? (
                      <img loading="lazy" decoding="async" src={a.url} alt={a.name} draggable="false" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ink-reveal select-none" />
                    ) : (
                      <CatIcon className="w-10 h-10 text-gray-600" />
                    )}
                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button onClick={() => openEditModal(a)} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors" title="Редактировать">
                        <Edit3 className="w-4 h-4 text-white" />
                      </button>
                      <a href={a.url} download className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors" title="Скачать">
                        <Download className="w-4 h-4 text-white" />
                      </a>
                      <button onClick={() => handleDelete(a)} className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors" title="Удалить">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-2">
                    <p className={`font-mono ${preset.textSize} text-gray-200 truncate`}>{a.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                        {cat.label}
                      </span>
                      <span className="text-[9px] font-mono text-gray-600">{formatSize(a.size)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Upload className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
                <p className="font-mono text-gray-500">// ПУСТО</p>
              </div>
            )}
          </div>
        ) : (
          /* List view */
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Имя</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Категория</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Размер</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Дата</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const cat = getCategoryConfig(a.category);
                  const CatIcon = cat.icon;
                  return (
                    <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {isImage(a.mimeType) ? (
                            <img loading="lazy" decoding="async" src={a.url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 flex-shrink-0">
                              <CatIcon className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          <span className="text-sm text-gray-200 truncate max-w-[200px]">{a.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>{cat.label}</span>
                      </td>
                      <td className="p-4 text-sm text-gray-400">{formatSize(a.size)}</td>
                      <td className="p-4 text-sm text-gray-400">{formatDateKR(a.createdAt)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditModal(a)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-blue-400 transition-colors" title="Редактировать">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <a href={a.url} download className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-200 transition-colors">
                            <Download className="w-4 h-4" />
                          </a>
                          <button onClick={() => handleDelete(a)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Upload className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
                <p className="font-mono text-gray-500">// ПУСТО</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowModal(false); setEditingAsset(null); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-frost rounded-2xl p-6 w-full max-w-md" style={{ border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>
                  {editingAsset ? 'РЕДАКТИРОВАТЬ' : 'ЗАГРУЗИТЬ'}
                </h2>
                <button onClick={() => { setShowModal(false); setEditingAsset(null); }} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              {/* Drop zone / Preview */}
              <div className="mb-4">
                {preview ? (
                  <div className="relative rounded-xl overflow-hidden">
                    <img loading="lazy" decoding="async" src={preview} alt="" draggable="false" className="w-full h-40 object-contain bg-white/5 select-none" />
                    {!editingAsset && (
                      <button onClick={() => { setSelectedFile(null); setPreview(null); }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/80">
                        <X className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>
                ) : selectedFile ? (
                  <div className="rounded-xl border border-gray-700 p-4 flex items-center gap-3">
                    <FileText className="w-8 h-8 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-gray-200 truncate">{selectedFile.name}</p>
                      <p className="font-mono text-xs text-gray-500">{formatSize(selectedFile.size)}</p>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                ) : (
                  <div onClick={() => fileRef.current?.click()}
                    className="rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors">
                    <Upload className="w-8 h-8 text-gray-500" />
                    <p className="font-mono text-xs text-gray-500">НАЖМИТЕ ИЛИ ПЕРЕТАЩИТЕ</p>
                    <p className="font-mono text-[10px] text-gray-600">PNG, JPG, SVG, PDF, MP4, MP3</p>
                  </div>
                )}
                <input ref={fileRef} type="file" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              </div>

              <div className="space-y-3">
                <NexusInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="// НАЗВАНИЕ *" />
                <NexusSelect value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </NexusSelect>
                <NexusInput value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="// ОПИСАНИЕ" />
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowModal(false); setEditingAsset(null); }} className="flex-1 px-4 py-2.5 rounded-xl glass font-mono text-sm text-gray-400">ОТМЕНА</button>
                <button onClick={editingAsset ? handleUpdate : handleUpload} disabled={uploading || (!editingAsset && !selectedFile)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                  {uploading ? 'СОХРАНЕНИЕ...' : editingAsset ? 'СОХРАНИТЬ' : 'ЗАГРУЗИТЬ'}
                </button>
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
