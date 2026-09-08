import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useDebounce } from '../hooks/useDebounce';
import {
  Upload, FolderOpen, File, Image, Video, Music, FileText,
  Trash, Download, Search, Grid, List, Folder, Link,
  Sliders, Send, X, MessageCircle, CheckCircle, AlertCircle,
} from 'lucide-react';
import { Material, MaterialType, ChatConversation } from '../types';
import { materialsApi, chatApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { formatDateKR } from '../utils/timezone';
import Spinner from '../components/common/Spinner';

interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

const typeIcons: Record<MaterialType, typeof File> = {
  image: Image, document: FileText, video: Video, audio: Music, other: File,
};

const typeColors: Record<MaterialType, string> = {
  image: 'text-pink-400', document: 'text-blue-400', video: 'text-red-400',
  audio: 'text-purple-400', other: 'text-gray-400',
};

const GRID_PRESETS = [
  { label: 'XS', cols: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8', imgH: 'h-20', textSize: 'text-[10px]' },
  { label: 'S', cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6', imgH: 'h-28', textSize: 'text-xs' },
  { label: 'M', cols: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4', imgH: 'h-32', textSize: 'text-sm' },
  { label: 'L', cols: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3', imgH: 'h-44', textSize: 'text-sm' },
  { label: 'XL', cols: 'grid-cols-1 sm:grid-cols-2', imgH: 'h-56', textSize: 'text-base' },
];

export default function Materials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [filterType, setFilterType] = useState<MaterialType | 'all'>('all');
  const [currentFolder, setCurrentFolder] = useState('');
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [gridSize, setGridSize] = useState(() => {
    const saved = localStorage.getItem('nexus_materials_grid');
    return saved ? parseInt(saved) : 2;
  });
  const [sendModal, setSendModal] = useState<Material | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const dragMaterialId = useRef<string | null>(null);
  const internalDragRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [listRef] = useAutoAnimate({ duration: 200 });

  const preset = GRID_PRESETS[gridSize];

  useEffect(() => { fetchMaterials(); }, []);
  useEffect(() => { localStorage.setItem('nexus_materials_grid', String(gridSize)); }, [gridSize]);

  const fetchMaterials = async () => {
    try {
      const response = await materialsApi.getAll();
      if (response.success && response.data) setMaterials(response.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const processUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    const items: UploadItem[] = fileArray.map((f, i) => ({
      id: `${Date.now()}-${i}`, name: f.name, size: f.size, progress: 0, status: 'uploading' as const,
    }));
    setUploadQueue(items);
    setShowUploadPanel(true);

    for (let i = 0; i < fileArray.length; i++) {
      try {
        const formData = new FormData();
        formData.append('file', fileArray[i]);
        if (currentFolder) formData.append('folder', currentFolder);
        await materialsApi.upload(fileArray[i], currentFolder);
        setUploadQueue(prev => prev.map(item => item.id === items[i].id ? { ...item, progress: 100, status: 'done' } : item));
      } catch (err: any) {
        setUploadQueue(prev => prev.map(item => item.id === items[i].id ? { ...item, status: 'error', error: err?.message || 'Ошибка' } : item));
      }
    }
    fetchMaterials();
    showToast(`Загружено: ${fileArray.length} файлов`, 'success');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await processUpload(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag-drop upload zone
  const [dragOverMain, setDragOverMain] = useState(false);
  const handleMainDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!internalDragRef.current && e.dataTransfer.types.includes('Files')) setDragOverMain(true);
  }, []);
  const handleMainDragLeave = useCallback((e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOverMain(false);
  }, []);
  const handleMainDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverMain(false);
    if (e.dataTransfer.files.length) await processUpload(e.dataTransfer.files);
  }, [processUpload]);

  const handleDelete = (id: string) => {
    showConfirm('УДАЛИТЬ МАТЕРИАЛ?', 'Это действие нельзя отменить.', async () => {
      try { await materialsApi.delete(id); showToast('Удалено', 'success'); fetchMaterials(); }
      catch { showToast('Ошибка удаления', 'error'); }
    });
  };

  const handleCopyLink = async (material: Material) => {
    const fullUrl = `${window.location.origin}${material.url}`;
    try { await navigator.clipboard.writeText(fullUrl); showToast('Скопировано', 'success'); }
    catch { showToast('Ошибка', 'error'); }
  };

  const openSendModal = async (material: Material) => {
    setSendModal(material);
    setSelectedConv(null);
    setCaption('');
    try {
      const res = await chatApi.getConversations();
      if (res.success && res.data) setConversations(res.data);
    } catch {}
  };

  const handleSendToChat = async () => {
    if (!sendModal || !selectedConv) return;
    setSending(true);
    try {
      await chatApi.sendMessage(selectedConv.id, {
        content: sendModal.url,
        type: sendModal.type === 'image' ? 'image' : 'file',
        caption: caption.trim() || undefined,
      });
      showToast('Отправлено в чат', 'success');
      setSendModal(null);
    } catch { showToast('Ошибка отправки', 'error'); }
    finally { setSending(false); }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredMaterials = materials.filter(m => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (debouncedSearch && !m.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    if (currentFolder && m.folder !== currentFolder) return false;
    return true;
  });

  const folders = [...new Set(materials.map(m => m.folder).filter(Boolean))] as string[];

  // Drag-and-drop: move file to folder
  const handleFileDragStart = useCallback((e: React.DragEvent, materialId: string) => {
    internalDragRef.current = true;
    dragMaterialId.current = materialId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', materialId);
    (e.target as HTMLElement).style.opacity = '0.4';
  }, []);

  const handleFileDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    internalDragRef.current = false;
    dragMaterialId.current = null;
    setDragOverFolder(null);
  }, []);

  const handleFolderDragOver = useCallback((e: React.DragEvent, folder: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folder);
  }, []);

  const handleFolderDrop = useCallback(async (e: React.DragEvent, folder: string) => {
    e.preventDefault();
    setDragOverFolder(null);
    if (!dragMaterialId.current) return;
    const materialId = dragMaterialId.current;
    dragMaterialId.current = null;
    try {
      await materialsApi.update(materialId, { folder });
      showToast(`Перемещено в "${folder}"`, 'success');
      fetchMaterials();
    } catch { showToast('Ошибка перемещения', 'error'); }
  }, [fetchMaterials]);

  if (isLoading) return <Spinner text="ЗАГРУЗКА МАТЕРИАЛОВ..." />;

  return (
    <div className="space-y-6 cyber-grid">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <FolderOpen className="w-7 h-7 md:w-8 md:h-8" /> ХРАНИЛИЩЕ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// УПРАВЛЕНИЕ ФАЙЛАМИ И МЕДИА</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => fileInputRef.current?.click()} disabled={uploadQueue.some(u => u.status === 'uploading')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm transition-all"
          style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
          <Upload className="w-5 h-5" /> {uploadQueue.some(u => u.status === 'uploading') ? 'Загрузка...' : 'Загрузить'}
        </motion.button>
        <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск..." className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-200 placeholder-gray-500" />
          </div>
        </div>

        <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200">
          <option value="all">Все типы</option>
          <option value="image">Изображения</option>
          <option value="document">Документы</option>
          <option value="video">Видео</option>
          <option value="audio">Аудио</option>
        </select>

        {/* Grid size slider */}
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

        <div className="flex gap-2">
          <button onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'glass-accent' : 'bg-white/5 text-gray-400'}`}>
            <Grid className="w-5 h-5" style={viewMode === 'grid' ? { color: 'var(--color-primary)' } : {}} />
          </button>
          <button onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'glass-accent' : 'bg-white/5 text-gray-400'}`}>
            <List className="w-5 h-5" style={viewMode === 'list' ? { color: 'var(--color-primary)' } : {}} />
          </button>
        </div>
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCurrentFolder('')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${!currentFolder ? 'glass-accent' : 'bg-white/5 text-gray-400'}`}
            style={!currentFolder ? { color: 'var(--color-primary)' } : {}}>
            <FolderOpen className="w-4 h-4" /> Все файлы
          </button>
          {folders.map(f => (
            <button key={f} onClick={() => setCurrentFolder(f)}
              onDragOver={(e) => handleFolderDragOver(e, f)}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => handleFolderDrop(e, f)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${currentFolder === f ? 'glass-accent' : 'bg-white/5 text-gray-400'} ${dragOverFolder === f ? 'ring-2 ring-green-500/50' : ''}`}
              style={currentFolder === f ? { color: 'var(--color-primary)' } : {}}>
              <Folder className="w-4 h-4" /> {f}
            </button>
          ))}
        </div>
      )}

      {/* Upload progress panel */}
      <AnimatePresence>
        {showUploadPanel && uploadQueue.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
                // ЗАГРУЗКА ({uploadQueue.filter(u => u.status === 'done').length}/{uploadQueue.length})
              </span>
              <button onClick={() => { setShowUploadPanel(false); setUploadQueue([]); }} className="p-1 rounded hover:bg-white/10">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {uploadQueue.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {item.status === 'done' ? <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#00ff88' }} />
                    : item.status === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#ff6b6b' }} />
                    : <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />}
                  <span className="text-xs font-mono truncate flex-1" style={{ color: item.status === 'error' ? '#ff6b6b' : '#c0c0d0' }}>{item.name}</span>
                  <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#5a5a70' }}>
                    {item.status === 'done' ? '✓' : item.status === 'error' ? item.error : `${item.size > 0 ? (item.size / 1024).toFixed(0) + ' KB' : ''}`}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Materials Grid with drag-drop zone */}
      <div
        onDragOver={handleMainDragOver}
        onDragLeave={handleMainDragLeave}
        onDrop={handleMainDrop}
        className="relative rounded-2xl transition-all"
        style={dragOverMain ? { outline: '2px dashed var(--color-primary)', background: 'rgba(0,255,136,0.03)' } : {}}
      >
        {dragOverMain && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl pointer-events-none" style={{ background: 'rgba(0,255,136,0.05)', backdropFilter: 'blur(2px)' }}>
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-10 h-10" style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>ПЕРЕТАЩИТЕ ФАЙЛЫ</span>
            </div>
          </div>
        )}
      {viewMode === 'grid' ? (
        <div ref={listRef} className={`grid ${preset.cols} gap-3`}>
          <AnimatePresence>
            {filteredMaterials.map(material => {
              const Icon = typeIcons[material.type];
              return (
                <motion.div key={material.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  draggable
                  onDragStart={(e) => handleFileDragStart(e as any, material.id)}
                  onDragEnd={handleFileDragEnd as any}
                  className="glass rounded-xl overflow-hidden hover:shadow-neon transition-shadow group cursor-grab active:cursor-grabbing">
                  <div className={`flex items-center justify-center ${preset.imgH} bg-white/5`}>
                    {material.type === 'image' ? (
                      <img loading="lazy" decoding="async" src={material.url} alt={material.name} draggable="false" className="h-full w-full object-cover select-none" />
                    ) : (
                      <Icon className={`w-10 h-10 ${typeColors[material.type]}`} />
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3 className={`${preset.textSize} font-medium text-gray-200 truncate`}>{material.name}</h3>
                    <p className="text-[10px] text-gray-400">{formatFileSize(material.size)}</p>
                    <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {material.type === 'image' && (
                        <button onClick={() => openSendModal(material)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] transition-colors"
                          style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>
                          <Send className="w-3 h-3" /> Чат
                        </button>
                      )}
                      <a href={material.url} download className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-gray-200 text-[10px]">
                        <Download className="w-3 h-3" />
                      </a>
                      <button onClick={() => handleCopyLink(material)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-gray-200 text-[10px]">
                        <Link className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(material.id)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-sm font-medium text-gray-400">Имя</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">Тип</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">Размер</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">Дата</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map(material => {
                const Icon = typeIcons[material.type];
                return (
                  <tr key={material.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4"><div className="flex items-center gap-3"><Icon className={`w-5 h-5 ${typeColors[material.type]}`} /><span className="text-sm text-gray-200">{material.name}</span></div></td>
                    <td className="p-4 text-sm text-gray-400 capitalize">{material.type}</td>
                    <td className="p-4 text-sm text-gray-400">{formatFileSize(material.size)}</td>
                    <td className="p-4 text-sm text-gray-400">{formatDateKR(material.createdAt)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {material.type === 'image' && (
                          <button onClick={() => openSendModal(material)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-green-400" title="Отправить в чат">
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        <a href={material.url} download className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-200"><Download className="w-4 h-4" /></a>
                        <button onClick={() => handleCopyLink(material)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-200"><Link className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(material.id)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-red-400"><Trash className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      </div>

      {filteredMaterials.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Нет материалов</p>
        </div>
      )}

      {/* Send to Chat Modal */}
      <AnimatePresence>
        {sendModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setSendModal(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
              style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>ОТПРАВИТЬ В ЧАТ</span>
                <button onClick={() => setSendModal(null)} className="p-1.5 rounded-xl hover:bg-white/5"><X className="w-4 h-4 text-gray-400" /></button>
              </div>

              {/* Preview */}
              <div className="px-5 py-3 flex items-center gap-3">
                <img loading="lazy" decoding="async" src={sendModal.url} alt="" draggable="false" className="w-16 h-16 rounded-lg object-cover select-none" style={{ border: '1px solid rgba(255,255,255,0.06)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{sendModal.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(sendModal.size)}</p>
                </div>
              </div>

              {/* Chat list */}
              <div className="px-5 py-2 max-h-48 overflow-y-auto">
                {selectedConv ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.15)' }}>
                    <MessageCircle className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-sm text-gray-200 flex-1">{selectedConv.otherName}</span>
                    <button onClick={() => setSelectedConv(null)} className="text-xs text-gray-400 hover:text-gray-200">Сменить</button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {conversations.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Нет чатов</p>}
                    {conversations.map(conv => (
                      <button key={conv.id} onClick={() => setSelectedConv(conv)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors text-left">
                        <MessageCircle className="w-4 h-4 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-200 truncate block">{conv.otherName}</span>
                          {conv.isGroup && <span className="text-[10px] text-gray-400">{conv.memberCount} участн.</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Caption */}
              <div className="px-5 py-3">
                <input type="text" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Подпись (необязательно)..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#e0e0e0' }}
                  onKeyDown={e => e.key === 'Enter' && handleSendToChat()} />
              </div>

              {/* Send button */}
              <div className="px-5 pb-5">
                <button onClick={handleSendToChat} disabled={!selectedConv || sending}
                  className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#000' }}>
                  {sending ? 'Отправка...' : 'ОТПРАВИТЬ'}
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
