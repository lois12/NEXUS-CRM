import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Edit3, X, Search, Calendar, Flag, User,
  ChevronRight, ArrowLeft, Image, FileText, Paperclip, Upload, Download,
  Play, Circle, CheckCircle2, Target, GitBranch, ZoomIn, Sliders, Link
} from 'lucide-react';
import { projectsApi } from '../services/api';
import { showToast } from '../components/ui/NexusModal';

interface Project {
  id: string; title: string; description: string; status: string; priority: string;
  startDate: string; endDate: string; responsiblePerson: string; budget: number;
  progress: number; imageUrl: string; createdAt: string; updatedAt: string;
}

interface TimelinePoint {
  id: string; projectId: string; type: string; title: string; description: string; date: string; position: number;
}

interface ProjectDocument {
  id: string; projectId: string; fileName: string; filePath: string; fileSize: number; mimeType: string; thumbnailPath?: string; createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'АКТИВНЫЙ', color: '#00ff88' },
  paused: { label: 'ПАУЗА', color: '#eab308' },
  completed: { label: 'ЗАВЕРШЁН', color: '#00d4ff' },
  cancelled: { label: 'ОТМЕНЁН', color: '#6b7280' },
};
const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'НИЗКИЙ', color: '#6b7280' },
  medium: { label: 'СРЕДНИЙ', color: '#00d4ff' },
  high: { label: 'ВЫСОКИЙ', color: '#eab308' },
  urgent: { label: 'СРОЧНЫЙ', color: '#ff3b30' },
};

const TIMELINE_TYPES: Record<string, { label: string; color: string; icon: typeof Play }> = {
  start: { label: 'СТАРТ', color: '#00ff88', icon: Play },
  milestone: { label: 'ЭТАП', color: '#00d4ff', icon: Circle },
  checkpoint: { label: 'КОНТРОЛЬ', color: '#eab308', icon: Target },
  finish: { label: 'ФИНИШ', color: '#ff3b30', icon: CheckCircle2 },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewing, setViewing] = useState<Project | null>(null);
  const [viewTab, setViewTab] = useState<'desc' | 'media' | 'docs' | 'timeline' | 'links'>('desc');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState({ title: '', description: '', status: 'active', priority: 'medium', startDate: '', endDate: '', responsiblePerson: '', budget: 0, progress: 0 });
  const [uploading, setUploading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [mediaGridSize, setMediaGridSize] = useState(() => {
    const saved = localStorage.getItem('nexus_projects_media_grid');
    return saved ? parseInt(saved) : 2;
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const MEDIA_GRID_PRESETS = [
    { label: 'S', cols: 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6', imgH: 'h-24' },
    { label: 'M', cols: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4', imgH: 'h-36' },
    { label: 'L', cols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3', imgH: 'h-48' },
    { label: 'XL', cols: 'grid-cols-1 md:grid-cols-2', imgH: 'h-64' },
  ];
  const mediaPreset = MEDIA_GRID_PRESETS[mediaGridSize];

  useEffect(() => { localStorage.setItem('nexus_projects_media_grid', String(mediaGridSize)); }, [mediaGridSize]);

  // Timeline state
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState<TimelinePoint | null>(null);
  const [pointForm, setPointForm] = useState({ type: 'milestone', title: '', description: '', date: '' });

  // Documents state
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);

  // Links state
  const [links, setLinks] = useState<any[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: '', url: '', description: '' });

  const fetchLinks = async (projectId: string) => {
    try { const res = await projectsApi.getLinks(projectId); if (res.success && res.data) setLinks(res.data); } catch {}
  };

  const handleAddLink = async () => {
    if (!viewing || !linkForm.title || !linkForm.url) return;
    try {
      await projectsApi.createLink(viewing.id, linkForm);
      setLinkForm({ title: '', url: '', description: '' });
      setShowLinkForm(false);
      fetchLinks(viewing.id);
      showToast('Ссылка добавлена', 'success');
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!viewing) return;
    try { await projectsApi.deleteLink(viewing.id, linkId); fetchLinks(viewing.id); showToast('Удалено', 'success'); }
    catch { showToast('Ошибка', 'error'); }
  };

  const fetchProjects = async () => {
    try {
      const res = await projectsApi.getAll();
      if (res.success && res.data) setProjects(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, []);

  const filtered = projects.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // CRUD
  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', status: 'active', priority: 'medium', startDate: '', endDate: '', responsiblePerson: '', budget: 0, progress: 0 });
    setShowModal(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({ title: p.title, description: p.description, status: p.status, priority: p.priority, startDate: p.startDate || '', endDate: p.endDate || '', responsiblePerson: p.responsiblePerson, budget: p.budget, progress: p.progress });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      if (editing) {
        await projectsApi.update(editing.id, form);
        showToast('Проект обновлён', 'success');
      } else {
        await projectsApi.create(form);
        showToast('Проект создан', 'success');
      }
      setShowModal(false);
      fetchProjects();
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try { await projectsApi.delete(id); showToast('Удалено', 'success'); if (viewing?.id === id) setViewing(null); fetchProjects(); }
    catch { showToast('Ошибка', 'error'); }
  };

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewing) return;
    setUploading(true);
    try {
      const res = await projectsApi.uploadImage(viewing.id, file);
      if (res.success) {
        const updated = { ...viewing, imageUrl: res.data.imageUrl };
        setViewing(updated);
        setProjects(prev => prev.map(p => p.id === viewing.id ? updated : p));
        showToast('Изображение загружено', 'success');
      }
    } catch { showToast('Ошибка', 'error'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  // Open detail view
  const openDetail = async (p: Project) => {
    setViewing(p);
    setViewTab('desc');
    try {
      const [tlRes, docRes, linkRes] = await Promise.all([projectsApi.getTimeline(p.id), projectsApi.getDocuments(p.id), projectsApi.getLinks(p.id)]);
      if (tlRes.success && tlRes.data) setTimeline(tlRes.data);
      if (docRes.success && docRes.data) setDocuments(docRes.data);
      if (linkRes.success && linkRes.data) setLinks(linkRes.data);
    } catch {}
  };

  // Timeline CRUD
  const openAddPoint = () => {
    setEditingPoint(null);
    setPointForm({ type: 'milestone', title: '', description: '', date: '' });
    setShowTimelineModal(true);
  };

  const openEditPoint = (p: TimelinePoint) => {
    setEditingPoint(p);
    setPointForm({ type: p.type, title: p.title, description: p.description, date: p.date || '' });
    setShowTimelineModal(true);
  };

  const handleSavePoint = async () => {
    if (!pointForm.title.trim() || !viewing) return;
    try {
      if (editingPoint) {
        await projectsApi.updateTimelinePoint(editingPoint.id, pointForm);
        showToast('Точка обновлена', 'success');
      } else {
        await projectsApi.createTimelinePoint(viewing.id, pointForm);
        showToast('Точка добавлена', 'success');
      }
      setShowTimelineModal(false);
      const res = await projectsApi.getTimeline(viewing.id);
      if (res.success && res.data) setTimeline(res.data);
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleDeletePoint = async (id: string) => {
    if (!viewing) return;
    try {
      await projectsApi.deleteTimelinePoint(id);
      setTimeline(prev => prev.filter(p => p.id !== id));
      showToast('Точка удалена', 'success');
    } catch { showToast('Ошибка', 'error'); }
  };

  // Drag-and-drop upload
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!viewing) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Separate media and docs
    const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const docFiles = files.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/'));

    setUploading(true);
    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token');

      if (mediaFiles.length > 0) {
        const formData = new FormData();
        mediaFiles.forEach(f => formData.append('files', f));
        const res = await fetch(`/api/projects/${viewing.id}/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (data.success && data.data) {
          setDocuments(prev => [...data.data, ...prev]);
          showToast(`Загружено медиа: ${data.data.length}`, 'success');
        }
      }

      if (docFiles.length > 0) {
        const formData = new FormData();
        docFiles.forEach(f => formData.append('files', f));
        const res = await fetch(`/api/projects/${viewing.id}/documents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (data.success && data.data) {
          setDocuments(prev => [...data.data, ...prev]);
          showToast(`Загружено документов: ${data.data.length}`, 'success');
        }
      }
    } catch { showToast('Ошибка загрузки', 'error'); }
    finally { setUploading(false); }
  }, [viewing]);

  // Documents — multi-upload
  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !viewing) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) formData.append('files', files[i]);
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token');
      const res = await fetch(`/api/projects/${viewing.id}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDocuments(prev => [...data.data, ...prev]);
        showToast(`Загружено файлов: ${data.data.length}`, 'success');
      }
    } catch { showToast('Ошибка', 'error'); }
    finally { setUploading(false); if (docRef.current) docRef.current.value = ''; }
  };

  // Media — multi-upload (images/videos only)
  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !viewing) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) formData.append('files', files[i]);
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token');
      const res = await fetch(`/api/projects/${viewing.id}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDocuments(prev => [...data.data, ...prev]);
        showToast(`Загружено медиа: ${data.data.length}`, 'success');
      }
    } catch { showToast('Ошибка', 'error'); }
    finally { setUploading(false); if (mediaRef.current) mediaRef.current.value = ''; }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await projectsApi.deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      showToast('Документ удалён', 'success');
    } catch { showToast('Ошибка', 'error'); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}><Flag className="w-12 h-12" style={{ color: 'var(--color-primary)' }} /></motion.div></div>;
  }

  // ── Detail View ──
  if (viewing) {
    return (
      <div className="space-y-4 cyber-grid">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewing(null)} className="p-2 rounded-lg hover:bg-white/10 transition-colors"><ArrowLeft className="w-5 h-5 text-gray-400" /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>{viewing.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${STATUS_CONFIG[viewing.status]?.color}20`, color: STATUS_CONFIG[viewing.status]?.color }}>{STATUS_CONFIG[viewing.status]?.label}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${PRIORITY_CONFIG[viewing.priority]?.color}20`, color: PRIORITY_CONFIG[viewing.priority]?.color }}>{PRIORITY_CONFIG[viewing.priority]?.label}</span>
            </div>
          </div>
          <button onClick={() => openEdit(viewing)} className="p-2 rounded-lg hover:bg-white/10"><Edit3 className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/5 pb-0">
          {([['desc', 'ОПИСАНИЕ', FileText], ['media', 'МЕДИА', Image], ['docs', 'ДОКУМЕНТЫ', Paperclip], ['timeline', 'РЕАЛИЗАЦИЯ', GitBranch], ['links', 'ССЫЛКИ', Link]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setViewTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-mono text-xs font-bold transition-all border-b-2 ${viewTab === id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={viewTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            className={`relative ${dragOver ? 'ring-2 ring-dashed ring-green-500/50 rounded-xl' : ''}`}>
            {dragOver && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl pointer-events-none" style={{ background: 'rgba(0,255,136,0.05)', backdropFilter: 'blur(2px)' }}>
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10" style={{ color: 'var(--color-primary)' }} />
                  <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>ПЕРЕТАЩИТЕ ФАЙЛЫ СЮДА</span>
                  <span className="text-[10px] font-mono" style={{ color: '#5a5a70' }}>Фото/видео → Медиа • Документы → Документы</span>
                </div>
              </div>
            )}
            {/* ── Description ── */}
            {viewTab === 'desc' && (
              <div className="glass rounded-xl p-6 space-y-4">
                {viewing.imageUrl && <img loading="lazy" decoding="async" src={`${viewing.imageUrl}`} alt="" draggable="false" className="w-full max-h-64 object-cover rounded-lg select-none" />}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-gray-500 font-mono text-xs block">ПЕРИОД</span><span className="text-gray-200 font-mono">{viewing.startDate || '—'} — {viewing.endDate || '—'}</span></div>
                  <div><span className="text-gray-500 font-mono text-xs block">ОТВЕТСТВЕННЫЙ</span><span className="text-gray-200 font-mono">{viewing.responsiblePerson || '—'}</span></div>
                  <div><span className="text-gray-500 font-mono text-xs block">БЮДЖЕТ</span><span className="text-gray-200 font-mono">{viewing.budget ? `${viewing.budget.toLocaleString()} ₽` : '—'}</span></div>
                  <div><span className="text-gray-500 font-mono text-xs block">ПРОГРЕСС</span>
                    <div className="flex items-center gap-2 mt-1"><div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${viewing.progress}%`, backgroundColor: 'var(--color-primary)' }} /></div><span className="font-mono text-xs" style={{ color: 'var(--color-primary)' }}>{viewing.progress}%</span></div>
                  </div>
                </div>
                <div><span className="text-gray-500 font-mono text-xs block mb-2">ОПИСАНИЕ</span><p className="text-gray-300 text-sm whitespace-pre-wrap">{viewing.description || 'Нет описания'}</p></div>
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs cursor-pointer transition-all ${uploading ? 'opacity-50' : 'hover:bg-white/10'}`} style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Upload className="w-3.5 h-3.5" /> {uploading ? 'ЗАГРУЗКА...' : 'ЗАГРУЗИТЬ ОБЛОЖКУ'}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              </div>
            )}

            {/* ── Media ── */}
            {viewTab === 'media' && (
              <div className="glass rounded-xl p-6 relative">
                {uploading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                      <span className="text-xs font-mono" style={{ color: 'var(--color-primary)' }}>ЗАГРУЗКА...</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <span className="font-mono text-xs text-gray-400">МЕДИА МАТЕРИАЛЫ</span>
                  <div className="flex items-center gap-3">
                    {/* Grid size selector */}
                    <div className="flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5" style={{ color: '#5a5a70' }} />
                      {MEDIA_GRID_PRESETS.map((p, i) => (
                        <button key={p.label} onClick={() => setMediaGridSize(i)}
                          className="px-2 py-1 rounded text-[10px] font-mono transition-all"
                          style={mediaGridSize === i
                            ? { background: 'var(--color-primary)', color: '#000' }
                            : { color: '#5a5a70', background: 'rgba(255,255,255,0.03)' }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer transition-all ${uploading ? 'opacity-70 pointer-events-none' : 'hover:bg-white/10'}`} style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      {uploading ? (
                        <><span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /> ЗАГРУЗКА...</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> ЗАГРУЗИТЬ</>
                      )}
                      <input ref={mediaRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUploadMedia} disabled={uploading} />
                    </label>
                  </div>
                </div>
                {(() => {
                  const mediaDocs = documents.filter(d => d.mimeType.startsWith('image/') || d.mimeType.startsWith('video/'));
                  return mediaDocs.length > 0 ? (
                    <div className={`grid ${mediaPreset.cols} gap-3`}>
                      {mediaDocs.map(doc => (
                        <div key={doc.id} className="relative group rounded-lg overflow-hidden cursor-pointer" onClick={() => setZoomImage(`${doc.filePath}`)}>
                          {doc.mimeType.startsWith('video/') ? (
                            <video src={`${doc.filePath}`} draggable="false" className={`w-full ${mediaPreset.imgH} object-cover transition-opacity duration-500`}
                              onLoadedData={e => (e.target as HTMLVideoElement).style.opacity = '1'} style={{ opacity: 0 }} />
                          ) : (
                            <img loading="lazy" decoding="async" src={doc.thumbnailPath || doc.filePath} alt={doc.fileName} draggable="false"
                              className={`w-full ${mediaPreset.imgH} object-cover transition-opacity duration-500 select-none`}
                              onLoad={e => (e.target as HTMLImageElement).style.opacity = '1'}
                              style={{ opacity: 0 }} />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="w-6 h-6 text-white" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[10px] font-mono text-white truncate">{doc.fileName}</p>
                          </div>
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={doc.filePath} download={doc.fileName} onClick={e => e.stopPropagation()} className="p-1 rounded bg-black/60 hover:bg-blue-500/80" title="Скачать">
                              <Download className="w-3 h-3 text-white" />
                            </a>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }} className="p-1 rounded bg-black/60 hover:bg-red-500/80" title="Удалить">
                              <Trash2 className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500"><Image className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-mono text-xs">// НЕТ МЕДИА</p></div>
                  );
                })()}
              </div>
            )}

            {/* ── Documents ── */}
            {viewTab === 'docs' && (
              <div className="glass rounded-xl p-6 relative">
                {uploading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                      <span className="text-xs font-mono" style={{ color: 'var(--color-primary)' }}>ЗАГРУЗКА...</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <span className="font-mono text-xs text-gray-400">ДОКУМЕНТЫ ({documents.filter(d => !d.mimeType.startsWith('image/') && !d.mimeType.startsWith('video/')).length})</span>
                  <div className="flex items-center gap-3">
                    {/* Grid size selector */}
                    <div className="flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5" style={{ color: '#5a5a70' }} />
                      {MEDIA_GRID_PRESETS.map((p, i) => (
                        <button key={p.label} onClick={() => setMediaGridSize(i)}
                          className="px-2 py-1 rounded text-[10px] font-mono transition-all"
                          style={mediaGridSize === i
                            ? { background: 'var(--color-primary)', color: '#000' }
                            : { color: '#5a5a70', background: 'rgba(255,255,255,0.03)' }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer transition-all ${uploading ? 'opacity-70 pointer-events-none' : 'hover:bg-white/10'}`} style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      {uploading ? (
                        <><span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /> ЗАГРУЗКА...</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> ЗАГРУЗИТЬ</>
                      )}
                      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.json" multiple className="hidden" onChange={handleUploadDoc} disabled={uploading} />
                    </label>
                  </div>
                </div>
                {(() => {
                  const docFiles = documents.filter(d => !d.mimeType.startsWith('image/') && !d.mimeType.startsWith('video/'));
                  return docFiles.length > 0 ? (
                    <div className={`grid ${mediaPreset.cols} gap-3`}>
                      {docFiles.map(doc => (
                        <div key={doc.id} className="rounded-lg bg-white/5 overflow-hidden group hover:ring-1 hover:ring-white/10 transition-all">
                          <div className={`flex items-center justify-center ${mediaPreset.imgH}`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className="text-center p-3">
                              <FileText className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--color-primary)', opacity: 0.4 }} />
                              <p className="font-mono text-[10px] truncate max-w-full px-1" style={{ color: '#8a8aa0' }}>
                                {doc.fileName.split('.').pop()?.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <div className="p-2.5">
                            <p className="font-mono text-xs text-gray-300 truncate">{doc.fileName}</p>
                            <p className="font-mono text-[10px] text-gray-600">{formatFileSize(doc.fileSize)}</p>
                            <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a href={`${doc.filePath}`} target="_blank" rel="noopener" className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-gray-200 text-[10px]">
                                <Download className="w-3 h-3" />
                              </a>
                              <button onClick={() => handleDeleteDoc(doc.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 text-[10px]">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-mono text-xs">// НЕТ ДОКУМЕНТОВ</p></div>
                  );
                })()}
              </div>
            )}
            {/* ── Timeline (Algorithm Flow) ── */}
            {viewTab === 'timeline' && (
              <div className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-xs text-gray-400">ПРОЦЕСС РЕАЛИЗАЦИИ</span>
                  <button onClick={openAddPoint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                    <Plus className="w-3.5 h-3.5" /> ДОБАВИТЬ ТОЧКУ
                  </button>
                </div>

                {timeline.length === 0 ? (
                  <div className="text-center py-12 text-gray-500"><GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-mono text-xs">// ДОБАВЬТЕ ТОЧКИ РЕАЛИЗАЦИИ</p></div>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/10" />

                    <div className="space-y-1">
                      {timeline.map((point, i) => {
                        const cfg = TIMELINE_TYPES[point.type] || TIMELINE_TYPES.milestone;
                        const Icon = cfg.icon;
                        const isLast = i === timeline.length - 1;
                        return (
                          <div key={point.id} className="relative flex items-start gap-4 group">
                            {/* Node */}
                            <div className="relative z-10 w-12 flex-shrink-0 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center border-2" style={{ borderColor: cfg.color, backgroundColor: `${cfg.color}15` }}>
                                <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                              </div>
                            </div>

                            {/* Arrow between points */}
                            {!isLast && (
                              <div className="absolute left-[42px] top-8 bottom-0 flex items-center justify-center" style={{ height: 'calc(100% - 16px)' }}>
                                <ChevronRight className="w-4 h-4 text-gray-600 absolute -right-2" style={{ top: '50%', transform: 'translateY(-50%) rotate(90deg)' }} />
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 pb-4">
                              <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/5 group-hover:border-white/10 transition-all">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                                    <span className="font-mono text-sm text-gray-200">{point.title}</span>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditPoint(point)} className="p-1 rounded hover:bg-white/10"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                                    <button onClick={() => handleDeletePoint(point.id)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                  </div>
                                </div>
                                {point.date && <p className="font-mono text-[10px] text-gray-500 mb-1"><Calendar className="w-3 h-3 inline mr-1" />{point.date}</p>}
                                {point.description && <p className="font-mono text-xs text-gray-400">{point.description}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Links tab */}
            {viewTab === 'links' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>// ССЫЛКИ ({links.length})</h3>
                  <button onClick={() => setShowLinkForm(!showLinkForm)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors hover:bg-white/5" style={{ color: 'var(--color-primary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Plus className="w-3 h-3" /> Добавить
                  </button>
                </div>
                <AnimatePresence>
                  {showLinkForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="glass-card rounded-xl p-4 space-y-3 overflow-hidden">
                      <input value={linkForm.title} onChange={e => setLinkForm({ ...linkForm, title: e.target.value })}
                        placeholder="Название" className="w-full px-3 py-2 rounded-lg bg-black/30 border border-gray-700 text-sm text-gray-200 font-mono" />
                      <input value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })}
                        placeholder="https://..." className="w-full px-3 py-2 rounded-lg bg-black/30 border border-gray-700 text-sm text-gray-200 font-mono" />
                      <input value={linkForm.description} onChange={e => setLinkForm({ ...linkForm, description: e.target.value })}
                        placeholder="Описание (необязательно)" className="w-full px-3 py-2 rounded-lg bg-black/30 border border-gray-700 text-sm text-gray-200 font-mono" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowLinkForm(false)} className="flex-1 py-2 rounded-lg text-xs font-mono text-gray-400 hover:bg-white/5 border border-gray-700">Отмена</button>
                        <button onClick={handleAddLink} className="flex-1 py-2 rounded-lg text-xs font-mono font-bold" style={{ background: 'var(--color-primary)', color: '#000' }}>Добавить</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {links.length > 0 ? (
                  <div className="space-y-2">
                    {links.map((link: any) => (
                      <div key={link.id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 group">
                        <Link className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                        <div className="flex-1 min-w-0">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-200 hover:underline truncate block">{link.title}</a>
                          {link.description && <p className="text-[10px] text-gray-500 truncate">{link.description}</p>}
                        </div>
                        <button onClick={() => handleDeleteLink(link.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-mono text-gray-600 text-center py-6">// НЕТ ССЫЛОК</p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Timeline Point Modal */}
        <AnimatePresence>
          {showTimelineModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowTimelineModal(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-frost rounded-2xl p-6 w-full max-w-md" style={{ border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>{editingPoint ? 'РЕДАКТИРОВАТЬ' : 'НОВАЯ ТОЧКА'}</h2>
                  <button onClick={() => setShowTimelineModal(false)} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="font-mono text-xs text-gray-500 mb-1 block">ТИП ТОЧКИ</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Object.entries(TIMELINE_TYPES).map(([key, cfg]) => {
                        const TIcon = cfg.icon;
                        return (
                          <button key={key} onClick={() => setPointForm({ ...pointForm, type: key })}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center ${pointForm.type === key ? 'border' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                            style={pointForm.type === key ? { backgroundColor: `${cfg.color}15`, borderColor: cfg.color, color: cfg.color } : {}}>
                            <TIcon className="w-4 h-4" />
                            <span className="text-[9px] font-mono font-bold">{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <input value={pointForm.title} onChange={e => setPointForm({ ...pointForm, title: e.target.value })} placeholder="// НАЗВАНИЕ ТОЧКИ"
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
                  <div>
                    <label className="font-mono text-xs text-gray-500 mb-1 block">ДАТА</label>
                    <input type="date" value={pointForm.date} onChange={e => setPointForm({ ...pointForm, date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                  </div>
                  <textarea value={pointForm.description} onChange={e => setPointForm({ ...pointForm, description: e.target.value })} placeholder="// ОПИСАНИЕ" rows={2}
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] resize-none" />
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowTimelineModal(false)} className="flex-1 px-4 py-2.5 rounded-xl glass font-mono text-sm text-gray-400">ОТМЕНА</button>
                  <button onClick={handleSavePoint} className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold" style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>{editingPoint ? 'СОХРАНИТЬ' : 'ДОБАВИТЬ'}</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zoom overlay */}
        <AnimatePresence>
          {zoomImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
              style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
              onClick={() => setZoomImage(null)}>
              <motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
                src={zoomImage} alt="" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-4 cyber-grid">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>ПРОЕКТЫ</h1>
          <p className="text-gray-400 font-mono text-sm mt-1">// {projects.length} ПРОЕКТОВ</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold" style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
          <Plus className="w-4 h-4" /> СОЗДАТЬ
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="// ПОИСК..." className="w-full pl-10 pr-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
          <option value="all">ВСЕ</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => (
          <div key={p.id} onClick={() => openDetail(p)} className="glass rounded-xl p-4 cursor-pointer hover:border-white/15 transition-all group">
            {p.imageUrl && <img loading="lazy" decoding="async" src={`${p.imageUrl}`} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />}
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-mono text-sm font-bold text-gray-200 truncate flex-1">{p.title}</h3>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_CONFIG[p.status]?.color}20`, color: STATUS_CONFIG[p.status]?.color }}>{STATUS_CONFIG[p.status]?.label}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${PRIORITY_CONFIG[p.priority]?.color}20`, color: PRIORITY_CONFIG[p.priority]?.color }}>{PRIORITY_CONFIG[p.priority]?.label}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: 'var(--color-primary)' }} /></div>
              <span className="font-mono text-[10px]" style={{ color: 'var(--color-primary)' }}>{p.progress}%</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono">
              {p.startDate && <span><Calendar className="w-3 h-3 inline mr-1" />{p.startDate}</span>}
              {p.responsiblePerson && <span><User className="w-3 h-3 inline mr-1" />{p.responsiblePerson}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-frost rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>{editing ? 'РЕДАКТИРОВАТЬ' : 'НОВЫЙ ПРОЕКТ'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="// НАЗВАНИЕ ПРОЕКТА" className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="// ОПИСАНИЕ" rows={3} className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] resize-none" />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="font-mono text-xs text-gray-500 mb-1 block">СТАТУС</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div><label className="font-mono text-xs text-gray-500 mb-1 block">ПРИОРИТЕТ</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                      {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div><label className="font-mono text-xs text-gray-500 mb-1 block">НАЧАЛО</label><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" /></div>
                  <div><label className="font-mono text-xs text-gray-500 mb-1 block">КОНЕЦ</label><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" /></div>
                  <div><label className="font-mono text-xs text-gray-500 mb-1 block">ОТВЕТСТВЕННЫЙ</label><input value={form.responsiblePerson} onChange={e => setForm({ ...form, responsiblePerson: e.target.value })} placeholder="// ИМЯ" className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" /></div>
                  <div><label className="font-mono text-xs text-gray-500 mb-1 block">БЮДЖЕТ (₽)</label><input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" /></div>
                </div>
                <div><label className="font-mono text-xs text-gray-500 mb-1 block">ПРОГРЕСС: {form.progress}%</label><input type="range" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: Number(e.target.value) })} className="w-full accent-[var(--color-primary)]" /></div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl glass font-mono text-sm text-gray-400">ОТМЕНА</button>
                <button onClick={handleSave} className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold" style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>{editing ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
