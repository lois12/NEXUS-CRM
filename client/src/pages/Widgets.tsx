import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, Puzzle, Copy, Globe, Lock, Upload, Code, ExternalLink, ChevronLeft } from 'lucide-react';
import { widgetsApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { SkeletonGrid, SkeletonHeader } from '../components/ui/Skeleton';

interface Widget {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  htmlCode: string;
  publicSlug: string | null;
  isPublic: number;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Widgets() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'edit' | 'code'>('list');
  const [editing, setEditing] = useState<Widget | null>(null);
  const [form, setForm] = useState({ title: '', description: '' });
  const [htmlCode, setHtmlCode] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [listRef] = useAutoAnimate({ duration: 200 });

  const fetchWidgets = useCallback(async () => {
    try {
      const res = await widgetsApi.getAll();
      if (res.success && res.data) setWidgets(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchWidgets(); }, [fetchWidgets]);

  const filtered = widgets.filter(w =>
    !search || w.title.toLowerCase().includes(search.toLowerCase()) || w.description.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '' });
    setHtmlCode('');
    setImageUrl('');
    setView('edit');
  };

  const openEdit = (w: Widget) => {
    setEditing(w);
    setForm({ title: w.title, description: w.description });
    setHtmlCode(w.htmlCode || '');
    setImageUrl(w.imageUrl || '');
    setView('edit');
  };

  const openCodeEditor = (w: Widget) => {
    setEditing(w);
    setHtmlCode(w.htmlCode || '');
    setView('code');
  };

  const handleSave = async () => {
    if (!form.title.trim()) return showToast('Введите название', 'error');
    try {
      if (editing) {
        const res = await widgetsApi.update(editing.id, { title: form.title, description: form.description });
        if (res.success) { showToast('Виджет обновлён'); await fetchWidgets(); setView('list'); }
      } else {
        const res = await widgetsApi.create({ title: form.title, description: form.description });
        if (res.success) { showToast('Виджет создан'); await fetchWidgets(); setView('list'); }
      }
    } catch { showToast('Ошибка сохранения', 'error'); }
  };

  const handleSaveCode = async () => {
    if (!editing) return;
    try {
      const res = await widgetsApi.update(editing.id, { htmlCode });
      if (res.success) { showToast('Код сохранён'); await fetchWidgets(); setView('list'); }
    } catch { showToast('Ошибка сохранения', 'error'); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    try {
      const res = await widgetsApi.uploadImage(editing.id, file);
      if (res.success && res.data) {
        setImageUrl(res.data.imageUrl);
        showToast('Картинка загружена');
        await fetchWidgets();
      }
    } catch { showToast('Ошибка загрузки', 'error'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
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

  const handleCopyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/w/${slug}`);
    showToast('Ссылка скопирована');
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

  if (isLoading) return (
    <div className="p-6 space-y-6">
      <SkeletonHeader /><SkeletonGrid count={6} />
    </div>
  );

  // ── Code Editor View ──
  if (view === 'code' && editing) {
    return (
      <div className="p-4 md:p-6 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('list')} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <Code className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <h2 className="font-mono text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Код: {editing.title}
          </h2>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
          {/* Editor */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-xs font-mono text-gray-500 mb-2">HTML / CSS / JS</div>
            <textarea
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              className="flex-1 min-h-[300px] w-full rounded-xl p-4 font-mono text-sm resize-none focus:outline-none"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(0,255,136,0.1)',
                color: '#e8e8ec',
                fontFamily: "'JetBrains Mono', monospace",
              }}
              placeholder="<!DOCTYPE html>&#10;<html>&#10;  <body>&#10;    <h1>Привет!</h1>&#10;  </body>&#10;</html>"
              spellCheck={false}
            />
            <button onClick={handleSaveCode}
              className="mt-3 px-6 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
              style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>
              СОХРАНИТЬ КОД
            </button>
          </div>

          {/* Preview */}
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
          <button onClick={() => setView('list')} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
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
            <div className="flex items-center gap-4">
              {imageUrl ? (
                <div className="w-24 h-24 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,255,136,0.1)' }}>
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl flex items-center justify-center"
                  style={{ border: '1px dashed rgba(0,255,136,0.2)', background: 'rgba(0,0,0,0.2)' }}>
                  <Puzzle className="w-8 h-8 text-gray-600" />
                </div>
              )}
              {editing && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="px-4 py-2 rounded-xl font-mono text-xs transition-all"
                    style={{ background: 'rgba(0,255,136,0.08)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>
                    <Upload className="w-4 h-4 inline mr-2" />
                    {uploading ? 'Загрузка...' : 'Загрузить'}
                  </button>
                </>
              )}
            </div>
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl font-mono text-sm focus:outline-none"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.1)', color: '#e8e8ec' }}
          placeholder="Поиск виджетов..."
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Puzzle className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="font-mono text-gray-500">{search ? 'Ничего не найдено' : 'Виджетов пока нет'}</p>
          {!search && (
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
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,136,0.08)' }}
            >
              {/* Image */}
              {w.imageUrl ? (
                <div className="h-40 overflow-hidden">
                  <img src={w.imageUrl} alt={w.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center" style={{ background: 'rgba(0,255,136,0.03)' }}>
                  <Puzzle className="w-12 h-12 text-gray-700" />
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                <h3 className="font-mono font-bold text-sm mb-1 truncate" style={{ color: 'var(--color-text-primary)' }}>{w.title}</h3>
                {w.description && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{w.description}</p>}

                {/* Status */}
                <div className="flex items-center gap-2 mb-3">
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
                  {w.htmlCode && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-gray-500"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      HTML
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => openEdit(w)} title="Редактировать"
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => openCodeEditor(w)} title="Код"
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                    <Code className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleTogglePublish(w)} title={w.isPublic ? 'Снять с публикации' : 'Опубликовать'}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    style={{ color: w.isPublic ? 'var(--color-primary)' : undefined }}>
                    {w.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                  {w.isPublic && w.publicSlug && (
                    <>
                      <button onClick={() => handleCopyLink(w.publicSlug!)} title="Копировать ссылку"
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                        <Copy className="w-4 h-4" />
                      </button>
                      <a href={`/w/${w.publicSlug}`} target="_blank" rel="noopener noreferrer" title="Открыть"
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </>
                  )}
                  <button onClick={() => handleDelete(w)} title="Удалить"
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