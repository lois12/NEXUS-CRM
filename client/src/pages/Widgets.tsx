import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, Puzzle, Copy, Globe, Lock, Upload, Code, ExternalLink, ChevronLeft, Eye, Pin, PinOff, CopyPlus, Settings, ImagePlus, X } from 'lucide-react';
import { widgetsApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { SkeletonGrid, SkeletonHeader } from '../components/ui/Skeleton';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';

interface Widget {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  htmlCode: string;
  publicSlug: string | null;
  customSlug: string;
  password: string;
  isPublic: number;
  isPinned: number;
  viewCount: number;
  category: string;
  folder: string;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
}

type SortMode = 'newest' | 'oldest' | 'name' | 'views';

export default function Widgets() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [view, setView] = useState<'list' | 'edit' | 'code' | 'settings'>('list');
  const [editing, setEditing] = useState<Widget | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: '', folder: '' });
  const [htmlCode, setHtmlCode] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishForm, setPublishForm] = useState({ customSlug: '', password: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [listRef] = useAutoAnimate({ duration: 200 });
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const fetchWidgets = useCallback(async () => {
    try {
      const res = await widgetsApi.getAll();
      if (res.success && res.data) setWidgets(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchWidgets(); }, [fetchWidgets]);

  // Initialize CodeMirror when code editor opens
  useEffect(() => {
    if (view !== 'code' || !editorRef.current) return;
    // Destroy previous instance
    if (editorViewRef.current) { editorViewRef.current.destroy(); editorViewRef.current = null; }

    const saveKeymap = keymap.of([{
      key: 'Mod-s',
      run: () => { handleSaveCode(); return true; },
    }]);

    const state = EditorState.create({
      doc: htmlCode,
      extensions: [
        basicSetup,
        html({ matchClosingTags: true, autoCloseTags: true }),
        css(),
        javascript(),
        oneDark,
        saveKeymap,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) setHtmlCode(update.state.doc.toString());
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { fontFamily: "'JetBrains Mono', monospace" },
          '.cm-content': { padding: '12px 0' },
          '&.cm-focused': { outline: 'none' },
          '.cm-gutters': { background: '#0d0d15', border: 'none' },
        }),
      ],
    });

    const editorInstance = new EditorView({ state, parent: editorRef.current });
    editorViewRef.current = editorInstance;

    return () => { editorInstance.destroy(); editorViewRef.current = null; };
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unique categories
  const categories = [...new Set(widgets.map(w => w.category).filter(Boolean))];

  // Unique folders
  const folders = [...new Set(widgets.map(w => w.folder).filter(Boolean))];

  // Filter + sort
  const filtered = widgets
    .filter(w => {
      if (search && !w.title.toLowerCase().includes(search.toLowerCase()) && !w.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && w.category !== categoryFilter) return false;
      if (folderFilter && w.folder !== folderFilter) return false;
      return true;
    })
    .sort((a, b) => {
      // Pinned always first
      if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
      switch (sortMode) {
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name': return a.title.localeCompare(b.title);
        case 'views': return (b.viewCount || 0) - (a.viewCount || 0);
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', category: '', folder: '' });
    setHtmlCode('');
    setImageUrl('');
    setImageFile(null);
    setGalleryImages([]);
    setView('edit');
  };

  const openEdit = async (w: Widget) => {
    setEditing(w);
    setForm({ title: w.title, description: w.description, category: w.category || '', folder: w.folder || '' });
    setHtmlCode(w.htmlCode || '');
    setImageUrl(w.imageUrl || '');
    setImageFile(null);
    setView('edit');
    // Load gallery images
    try {
      const res = await widgetsApi.getGallery(w.id);
      if (res.success && res.data) setGalleryImages(res.data);
    } catch { setGalleryImages([]); }
  };

  const openCodeEditor = (w: Widget) => {
    setEditing(w);
    setHtmlCode(w.htmlCode || '');
    setView('code');
  };

  const openSettings = (w: Widget) => {
    setEditing(w);
    setPublishForm({ customSlug: w.customSlug || '', password: w.password || '' });
    setView('settings');
  };

  const handleSave = async () => {
    if (!form.title.trim()) return showToast('Введите название', 'error');
    try {
      let widgetId = editing?.id;
      if (editing) {
        const res = await widgetsApi.update(editing.id, { title: form.title, description: form.description, category: form.category, folder: form.folder });
        if (res.success) widgetId = editing.id;
      } else {
        const res = await widgetsApi.create({ title: form.title, description: form.description, category: form.category, folder: form.folder });
        if (res.success && res.data) widgetId = res.data.id;
      }
      if (widgetId && imageFile) {
        setUploading(true);
        try {
          const imgRes = await widgetsApi.uploadImage(widgetId, imageFile);
          if (imgRes.success && imgRes.data) setImageUrl(imgRes.data.imageUrl);
        } catch { showToast('Ошибка загрузки картинки', 'error'); }
        finally { setUploading(false); }
      }
      showToast(editing ? 'Виджет обновлён' : 'Виджет создан');
      await fetchWidgets();
      setView('list');
    } catch { showToast('Ошибка сохранения', 'error'); }
  };

  const handleSaveCode = async () => {
    if (!editing) return;
    // Read current code from editor (always up-to-date)
    const currentCode = editorViewRef.current?.state.doc.toString() || htmlCode;
    try {
      const res = await widgetsApi.update(editing.id, { htmlCode: currentCode });
      if (res.success) { showToast('Код сохранён'); await fetchWidgets(); setView('list'); }
    } catch { showToast('Ошибка сохранения', 'error'); }
  };

  const handleSavePublishSettings = async () => {
    if (!editing) return;
    try {
      const res = await widgetsApi.updatePublishSettings(editing.id, publishForm);
      if (res.success) { showToast('Настройки сохранены'); await fetchWidgets(); setView('list'); }
    } catch (e: any) { showToast(e?.response?.data?.error || 'Ошибка', 'error'); }
  };

  const handleTogglePublish = async (w: Widget) => {
    try {
      const res = await widgetsApi.togglePublish(w.id);
      if (res.success) {
        showToast(w.isPublic ? 'Ссылка убрана' : 'Виджет опубликован');
        await fetchWidgets();
      }
    } catch { showToast('Ошибка публикации', 'error'); }
  };

  const handleTogglePin = async (w: Widget) => {
    try {
      await widgetsApi.togglePin(w.id);
      await fetchWidgets();
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleDuplicate = async (w: Widget) => {
    try {
      const res = await widgetsApi.duplicate(w.id);
      if (res.success) { showToast('Дубликат создан'); await fetchWidgets(); }
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleCopyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/w/${slug}`);
    showToast('Ссылка скопирована');
  };

  const handleCopyEmbed = (slug: string) => {
    const code = `<iframe src="${window.location.origin}/w/${slug}" width="100%" height="500" frameborder="0" style="border-radius:12px;border:1px solid rgba(0,255,136,0.1)" allow="clipboard-write"></iframe>`;
    navigator.clipboard.writeText(code);
    showToast('Embed-код скопирован');
  };

  const handleDelete = async (w: Widget) => {
    showConfirm('УДАЛИТЬ?', `Виджет «${w.title}» будет удалён безвозвратно.`, async () => {
      try {
        await widgetsApi.delete(w.id);
        showToast('Виджет удалён');
        await fetchWidgets();
      } catch { showToast('Ошибка удаления', 'error'); }
    });
  };

  const handleGalleryUpload = async (file: File) => {
    if (!editing) return;
    setGalleryUploading(true);
    try {
      const res = await widgetsApi.uploadGalleryImage(editing.id, file);
      if (res.success) {
        setGalleryImages(prev => [...prev, res.data]);
        showToast('Фото добавлено');
      }
    } catch { showToast('Ошибка загрузки', 'error'); }
    finally { setGalleryUploading(false); }
  };

  const handleGalleryDelete = async (imageId: string) => {
    if (!editing) return;
    try {
      await widgetsApi.deleteGalleryImage(editing.id, imageId);
      setGalleryImages(prev => prev.filter(img => img.id !== imageId));
      showToast('Фото удалено');
    } catch { showToast('Ошибка удаления', 'error'); }
  };

  if (isLoading) return (
    <div className="p-6 space-y-6">
      <SkeletonHeader /><SkeletonGrid count={6} />
    </div>
  );

  // ── Publish Settings View ──
  if (view === 'settings' && editing) {
    return (
      <div className="p-4 md:p-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="p-2 rounded-xl hover:bg-white/5 transition-colors" aria-label="Назад">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <Settings className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <h2 className="font-mono text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Настройки публикации
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-gray-500 mb-2 block">Кастомная ссылка</label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-600 whitespace-nowrap">/w/</span>
              <input
                value={publishForm.customSlug}
                onChange={(e) => setPublishForm({ ...publishForm, customSlug: e.target.value.replace(/[^a-zA-Z0-9-_]/g, '') })}
                className="flex-1 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}
                placeholder="my-widget"
              />
            </div>
            <p className="text-[10px] text-gray-600 mt-1 font-mono">Латиница, цифры, тире. Если пусто — генерируется автоматически.</p>
          </div>

          <div>
            <label className="text-xs font-mono text-gray-500 mb-2 block">Пароль доступа</label>
            <input
              value={publishForm.password}
              onChange={(e) => setPublishForm({ ...publishForm, password: e.target.value })}
              className="w-full rounded-xl px-4 py-3 font-mono text-sm focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}
              placeholder="Оставьте пустым для свободного доступа"
            />
            <p className="text-[10px] text-gray-600 mt-1 font-mono">Если пусто — виджет доступен всем. Если заполнено — нужен пароль для просмотра.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSavePublishSettings}
              className="px-6 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
              style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>
              СОХРАНИТЬ
            </button>
            <button onClick={() => setView('list')}
              className="px-6 py-2.5 rounded-xl font-mono text-sm text-gray-400 hover:text-gray-200 transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              ОТМЕНА
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Code Editor View ──
  if (view === 'code' && editing) {
    return (
      <div className="p-4 md:p-6 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('list')} className="p-2 rounded-xl hover:bg-white/5 transition-colors" aria-label="Назад">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <Code className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <h2 className="font-mono text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Код: {editing.title}
          </h2>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-xs font-mono text-gray-500 mb-2">HTML / CSS / JS</div>
            <div ref={editorRef} className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(0,255,136,0.1)', minHeight: '400px', height: '100%' }} />
            <button onClick={handleSaveCode}
              className="mt-3 px-6 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
              style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>
              СОХРАНИТЬ КОД
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-xs font-mono text-gray-500 mb-2">Превью</div>
            <div className="flex-1 rounded-xl overflow-hidden min-h-[300px]"
              style={{ border: '1px solid rgba(0,255,136,0.1)', background: '#fff' }}>
              <iframe
                srcDoc={htmlCode}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
                title="Превью виджета"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit / Create View ──
  if (view === 'edit') {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="p-2 rounded-xl hover:bg-white/5 transition-colors" aria-label="Назад">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <h2 className="font-mono text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {editing ? 'Редактирование' : 'Новый виджет'}
          </h2>
        </div>

        <div className="space-y-4">
          {/* Image */}
          <div>
            <label className="text-xs font-mono text-gray-500 mb-2 block">Картинка</label>
            {imageUrl && !imageFile ? (
              <div className="relative rounded-xl overflow-hidden mb-3 group">
                <img src={imageUrl} alt="" className="w-full h-40 object-cover rounded-xl" />
                <button onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Удалить изображение">
                  <span className="text-white text-sm">✕</span>
                </button>
              </div>
            ) : null}
            {imageFile && (
              <div className="mb-3">
                <div className="relative rounded-xl overflow-hidden mb-2">
                  <img src={URL.createObjectURL(imageFile)} alt="" className="w-full h-40 object-cover rounded-xl" />
                  <button onClick={() => setImageFile(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/80" aria-label="Удалить изображение">
                    <span className="text-white text-sm">✕</span>
                  </button>
                </div>
                {!editing && (
                  <p className="font-mono text-[10px] text-gray-500 text-center">Картинка будет загружена при сохранении</p>
                )}
                {editing && (
                  <button onClick={async () => {
                    setUploading(true);
                    try {
                      const res = await widgetsApi.uploadImage(editing.id, imageFile);
                      if (res.success && res.data) {
                        setImageUrl(res.data.imageUrl);
                        setImageFile(null);
                        showToast('Картинка загружена');
                        await fetchWidgets();
                      }
                    } catch { showToast('Ошибка загрузки', 'error'); }
                    finally { setUploading(false); }
                  }} disabled={uploading}
                    className="w-full py-2 rounded-lg font-mono text-xs font-bold transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                    {uploading ? 'ЗАГРУЗКА...' : 'ЗАГРУЗИТЬ СЕЙЧАС'}
                  </button>
                )}
              </div>
            )}
            <label
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgba(0,255,136,0.05)'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.background = '';
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) setImageFile(file);
              }}
              className="flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="font-mono text-[10px] text-gray-500">ПЕРЕТАЩИТЕ ИЛИ ВЫБЕРИТЕ</span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setImageFile(f); }} />
            </label>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-mono text-gray-500 mb-2 block">Название *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl px-4 py-3 font-mono text-sm focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}
              placeholder="Мой крутой виджет"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-mono text-gray-500 mb-2 block">Описание</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl px-4 py-3 font-mono text-sm resize-none focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}
              rows={3}
              placeholder="Краткое описание для превью"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-mono text-gray-500 mb-2 block">Категория</label>
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button key={cat} onClick={() => setForm({ ...form, category: form.category === cat ? '' : cat })}
                  className="px-3 py-1.5 rounded-lg font-mono text-xs transition-all"
                  style={{
                    background: form.category === cat ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                    color: form.category === cat ? 'var(--color-primary)' : '#9ca3af',
                    border: `1px solid ${form.category === cat ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  {cat}
                </button>
              ))}
            </div>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl px-4 py-3 mt-2 font-mono text-sm focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}
              placeholder="Введите или выберите категорию"
            />
          </div>

          {/* Folder */}
          <div>
            <label className="text-xs font-mono text-gray-500 mb-2 block">Папка</label>
            <div className="flex gap-2 flex-wrap">
              {folders.map(f => (
                <button key={f} onClick={() => setForm({ ...form, folder: form.folder === f ? '' : f })}
                  className="px-3 py-1.5 rounded-lg font-mono text-xs transition-all"
                  style={{
                    background: form.folder === f ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                    color: form.folder === f ? 'var(--color-primary)' : '#9ca3af',
                    border: `1px solid ${form.folder === f ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  {f}
                </button>
              ))}
            </div>
            <input
              value={form.folder}
              onChange={(e) => setForm({ ...form, folder: e.target.value })}
              className="w-full rounded-xl px-4 py-3 mt-2 font-mono text-sm focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}
              placeholder="Введите или выберите папку"
            />
          </div>

          {/* Gallery */}
          {editing && (
            <div>
              <label className="text-xs font-mono text-gray-500 mb-2 block">Галерея</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {galleryImages.map((img: any) => (
                  <div key={img.id} className="relative rounded-xl overflow-hidden group aspect-square">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => handleGalleryDelete(img.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Удалить фото">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
              <label
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = ''; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '';
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) handleGalleryUpload(file);
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
                <ImagePlus className="w-4 h-4 text-gray-400" />
                <span className="font-mono text-[10px] text-gray-500">{galleryUploading ? 'ЗАГРУЗКА...' : 'ДОБАВИТЬ ФОТО'}</span>
                <input ref={galleryFileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleGalleryUpload(f); e.target.value = ''; }} />
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave}
              className="px-6 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
              style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>
              {editing ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}
            </button>
            <button onClick={() => setView('list')}
              className="px-6 py-2.5 rounded-xl font-mono text-sm text-gray-400 hover:text-gray-200 transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              ОТМЕНА
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-3" style={{ color: 'var(--color-text-primary)' }}>
            <Puzzle className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
            Виджеты
          </h1>
          <p className="text-sm text-gray-500 font-mono mt-1">Создавайте и публикуйте встраиваемые HTML-блоки</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-bold transition-all hover:scale-105 active:scale-95"
          style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>
          <Plus className="w-4 h-4" /> СОЗДАТЬ
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl font-mono text-sm focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}
            placeholder="Поиск виджетов..."
          />
        </div>
        <div className="flex gap-2">
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl px-3 py-2.5 font-mono text-xs focus:outline-none appearance-none cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}>
              <option value="">Все категории</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-xl px-3 py-2.5 font-mono text-xs focus:outline-none appearance-none cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="name">По названию</option>
            <option value="views">По просмотрам</option>
          </select>
        </div>
      </div>

      {/* Folder tabs */}
      {folders.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFolderFilter('')}
            className="px-3 py-1.5 rounded-lg font-mono text-xs transition-all"
            style={{
              background: !folderFilter ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
              color: !folderFilter ? 'var(--color-primary)' : '#9ca3af',
              border: `1px solid ${!folderFilter ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            Все
          </button>
          {folders.map(f => (
            <button key={f} onClick={() => setFolderFilter(folderFilter === f ? '' : f)}
              className="px-3 py-1.5 rounded-lg font-mono text-xs transition-all"
              style={{
                background: folderFilter === f ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                color: folderFilter === f ? 'var(--color-primary)' : '#9ca3af',
                border: `1px solid ${folderFilter === f ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}>
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Puzzle className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="font-mono text-gray-500">{search || categoryFilter || folderFilter ? 'Ничего не найдено' : 'Виджетов пока нет'}</p>
          {!search && !categoryFilter && !folderFilter && (
            <button onClick={openCreate} className="mt-4 px-5 py-2 rounded-xl font-mono text-sm"
              style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>
              Создать первый
            </button>
          )}
        </div>
      ) : (
        <div ref={listRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="rounded-2xl overflow-hidden group"
              style={{
                background: w.isPinned ? 'rgba(0,255,136,0.04)' : 'rgba(255,255,255,0.03)',
                border: w.isPinned ? '1px solid rgba(0,255,136,0.15)' : '1px solid rgba(0,255,136,0.08)',
              }}
            >
              {/* Image */}
              {w.imageUrl ? (
                <div className="h-40 overflow-hidden relative">
                  <img src={w.imageUrl} alt={w.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {w.isPinned && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-mono flex items-center gap-1"
                      style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--color-primary)' }}>
                      <Pin className="w-3 h-3" /> Закреплён
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center relative" style={{ background: 'rgba(0,255,136,0.03)' }}>
                  <Puzzle className="w-12 h-12 text-gray-700" />
                  {w.isPinned && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-mono flex items-center gap-1"
                      style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--color-primary)' }}>
                      <Pin className="w-3 h-3" /> Закреплён
                    </div>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                <h3 className="font-mono font-bold text-sm mb-1 truncate" style={{ color: 'var(--color-text-primary)' }}>{w.title}</h3>
                {w.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{w.description}</p>}

                {/* Meta row */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {w.isPublic ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono"
                      style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)' }}>
                      <Globe className="w-3 h-3" /> Публичный
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-gray-500"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <Lock className="w-3 h-3" /> Черновик
                    </span>
                  )}
                  {w.password && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-yellow-500"
                      style={{ background: 'rgba(234,179,8,0.1)' }}>
                      🔒
                    </span>
                  )}
                  {w.category && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-gray-400"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {w.category}
                    </span>
                  )}
                  {w.folder && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-blue-400"
                      style={{ background: 'rgba(59,130,246,0.1)' }}>
                      📁 {w.folder}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-gray-500"
                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Eye className="w-3 h-3" /> {w.viewCount || 0}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button onClick={() => openEdit(w)} title="Редактировать" aria-label="Редактировать"
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => openCodeEditor(w)} title="Код" aria-label="Код"
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                    <Code className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleTogglePublish(w)} title={w.isPublic ? 'Снять с публикации' : 'Опубликовать'} aria-label={w.isPublic ? 'Снять с публикации' : 'Опубликовать'}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    style={{ color: w.isPublic ? 'var(--color-primary)' : undefined }}>
                    {w.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                  {w.isPublic && (
                    <button onClick={() => openSettings(w)} title="Настройки публикации" aria-label="Настройки публикации"
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                  {w.isPublic && w.publicSlug && (
                    <>
                      <button onClick={() => handleCopyLink(w.publicSlug!)} title="Копировать ссылку" aria-label="Копировать ссылку"
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleCopyEmbed(w.publicSlug!)} title="Embed-код" aria-label="Embed-код"
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                        <Code className="w-3.5 h-3.5" />
                      </button>
                      <a href={`/w/${w.publicSlug}`} target="_blank" rel="noopener noreferrer" title="Открыть" aria-label="Открыть"
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </>
                  )}
                  <button onClick={() => handleTogglePin(w)} title={w.isPinned ? 'Открепить' : 'Закрепить'} aria-label={w.isPinned ? 'Открепить' : 'Закрепить'}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    style={{ color: w.isPinned ? 'var(--color-primary)' : undefined }}>
                    {w.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDuplicate(w)} title="Дублировать" aria-label="Дублировать"
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                    <CopyPlus className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(w)} title="Удалить" aria-label="Удалить"
                    className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-gray-400 hover:text-red-400 ml-auto">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmModal {...confirmState} onCancel={closeConfirm} />
    </div>
  );
}