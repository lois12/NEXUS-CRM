import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, X, ClipboardList, Eye, QrCode, Copy, Calendar, Users, MapPin, ArrowLeft, Clock, Upload, Camera } from 'lucide-react';
import { Registration, RegistrationField, RegistrationSubmission, FieldType, FIELD_TYPE_CONFIG } from '../types';
import { registrationsApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import FieldBuilder from '../components/registrations/FieldBuilder';
import MapField from '../components/registrations/MapField';
import SubmissionsTable from '../components/registrations/SubmissionsTable';
import RichEditor from '../components/ui/RichEditor';
import { QRCodeSVG } from 'qrcode.react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { SkeletonGrid, SkeletonHeader } from '../components/ui/Skeleton';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: '#6b7280' },
  active: { label: 'Активна', color: '#00ff88' },
  closed: { label: 'Закрыта', color: '#ff3b30' },
  archived: { label: 'Архив', color: '#4a4a60' },
};

export default function Registrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [view, setView] = useState<'list' | 'constructor' | 'submissions'>('list');
  const [editing, setEditing] = useState<Registration | null>(null);
  const [form, setForm] = useState({ title: '', description: '', eventDate: '', eventTime: '', location: '', videoUrl: '', maxParticipants: 0, status: 'draft' as string, registrationStart: '', registrationEnd: '', closedMessage: '', mapCoords: '', showLimit: 1, showTimer: 1, organizer: '' });
  const [regFields, setRegFields] = useState<RegistrationField[]>([]);
  const [submissions, setSubmissions] = useState<RegistrationSubmission[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [listRef] = useAutoAnimate({ duration: 200 });

  const fetchData = useCallback(async () => {
    try {
      const res = await registrationsApi.getAll();
      if (res.success && res.data) setRegistrations(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = registrations.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', eventDate: '', eventTime: '', location: '', videoUrl: '', maxParticipants: 0, status: 'draft', registrationStart: '', registrationEnd: '', closedMessage: '', mapCoords: '', showLimit: 1, showTimer: 1, organizer: '' });
    setRegFields([]);
    setImageUrl('');
    setImageFiles([]);
    setVideoUrl('');
    setVideoFile(null);
    setMediaItems([]);
    setMediaFiles([]);
    setView('constructor');
  };

  const safeParseOptions = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.length > 0 && val[0] === '[') {
      try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
  };

  const safeParseSettings = (val: any): Record<string, any> => {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) return val;
    if (typeof val === 'string' && val.length > 0 && val[0] === '{') {
      try { const p = JSON.parse(val); return (typeof p === 'object' && p !== null && !Array.isArray(p)) ? p : {}; } catch { return {}; }
    }
    return {};
  };

  const normalizeFields = (fields: any[]): RegistrationField[] => {
    if (!Array.isArray(fields)) return [];
    return fields.map((f: any) => ({
      ...f,
      options: safeParseOptions(f.options),
      settings: safeParseSettings(f.settings),
    }));
  };

  const openEdit = async (reg: Registration) => {
    try {
      const res = await registrationsApi.getOne(reg.id);
      if (res.success && res.data) {
        const data = res.data;
        setEditing(data);
        setForm({
          title: data.title, description: data.description, eventDate: data.eventDate || '',
          eventTime: data.eventTime || '', location: data.location || '', videoUrl: data.videoUrl || '',
          maxParticipants: data.maxParticipants || 0, status: data.status,
          registrationStart: data.registrationStart || '', registrationEnd: data.registrationEnd || '',
          closedMessage: data.closedMessage || '', mapCoords: data.mapCoords || '',
          showLimit: data.showLimit ?? 1, showTimer: data.showTimer ?? 1,
          organizer: data.organizer || '',
        });
        setRegFields(normalizeFields(data.fields));
        setImageUrl(data.imageUrl || '');
        setImageFiles([]);
        setVideoUrl(data.videoUrl || '');
        setVideoFile(null);
        // Load media
        try {
          const mediaRes = await registrationsApi.getMedia(reg.id);
          if (mediaRes.success && mediaRes.data) setMediaItems(Array.isArray(mediaRes.data) ? mediaRes.data : []);
        } catch { setMediaItems([]); }
        setMediaFiles([]);
        setView('constructor');
      }
    } catch { showToast('Ошибка загрузки', 'error'); }
  };

  const openSubmissions = async (reg: Registration) => {
    try {
      const [subRes, regRes] = await Promise.all([
        registrationsApi.getSubmissions(reg.id),
        registrationsApi.getOne(reg.id),
      ]);
      if (subRes.success && subRes.data) setSubmissions(subRes.data);
      if (regRes.success && regRes.data) setRegFields(regRes.data.fields || []);
      setEditing(reg);
      setView('submissions');
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Введите название', 'error'); return; }
    try {
      let regId = editing?.id;
      if (editing) {
        await registrationsApi.update(editing.id, form);
        regId = editing.id;
      } else {
        const res = await registrationsApi.create(form);
        if (res.success && res.data) regId = res.data.id;
      }

      // Upload image if new file selected
      if (imageFiles.length > 0 && regId) {
        setUploading(true);
        await registrationsApi.uploadImage(regId, imageFiles[0]);
      }

      // Upload video if new file selected
      if (videoFile && regId) {
        setUploading(true);
        await registrationsApi.uploadVideo(regId, videoFile);
      }

      // Upload media files
      if (mediaFiles.length > 0 && regId) {
        setUploading(true);
        for (const file of mediaFiles) {
          await registrationsApi.uploadMedia(regId, file);
        }
      }

      setUploading(false);

      // Save fields
      if (regId) {
        // Delete removed fields
        const existingIds = regFields.map(f => f.id);
        const currentFields = editing ? (await registrationsApi.getOne(regId)).data?.fields || [] : [];
        for (const f of currentFields) {
          if (!existingIds.includes(f.id)) {
            await registrationsApi.deleteField(regId, f.id);
          }
        }
        // Create/update fields
        for (let i = 0; i < regFields.length; i++) {
          const field = regFields[i];
          const fieldData = {
            ...field,
            position: i,
            options: Array.isArray(field.options) ? JSON.stringify(field.options) : (typeof field.options === 'string' ? field.options : '[]'),
            settings: (typeof field.settings === 'object' && field.settings !== null && !Array.isArray(field.settings)) ? JSON.stringify(field.settings) : (typeof field.settings === 'string' ? field.settings : '{}'),
          };
          if (field.id.startsWith('temp-')) {
            await registrationsApi.createField(regId, fieldData);
          } else {
            await registrationsApi.updateField(regId, field.id, fieldData);
          }
        }
      }

      showToast(editing ? 'Обновлено' : 'Создано', 'success');
      setView('list');
      fetchData();
    } catch { showToast('Ошибка сохранения', 'error'); }
    finally { setUploading(false); }
  };

  const handleSaveAndNotify = async () => {
    if (!editing) return;
    if (!form.title.trim()) { showToast('Введите название', 'error'); return; }
    try {
      setUploading(true);
      // Save fields first (same as handleSave)
      const currentRes = await registrationsApi.getOne(editing.id);
      if (currentRes.success && currentRes.data) {
        const existingIds = currentRes.data.fields?.map((f: any) => f.id) || [];
        for (const f of regFields) {
          if (!existingIds.includes(f.id) && !f.id.startsWith('temp-')) continue;
        }
        for (const f of (currentRes.data.fields || [])) {
          if (!regFields.find(rf => rf.id === f.id)) {
            await registrationsApi.deleteField(editing.id, f.id);
          }
        }
        for (let i = 0; i < regFields.length; i++) {
          const field = regFields[i];
          const fieldData = {
            ...field, position: i,
            options: Array.isArray(field.options) ? JSON.stringify(field.options) : (typeof field.options === 'string' ? field.options : '[]'),
            settings: (typeof field.settings === 'object' && field.settings !== null && !Array.isArray(field.settings)) ? JSON.stringify(field.settings) : (typeof field.settings === 'string' ? field.settings : '{}'),
          };
          if (field.id.startsWith('temp-')) await registrationsApi.createField(editing.id, fieldData);
          else await registrationsApi.updateField(editing.id, field.id, fieldData);
        }
      }

      // Update and notify
      const res = await registrationsApi.updateAndNotify(editing.id, form);
      if (res.success) {
        showToast(res.message || 'Обновлено и отправлено!', 'success');
        setView('list');
        fetchData();
      } else {
        showToast(res.error || 'Ошибка', 'error');
      }
    } catch { showToast('Ошибка сохранения', 'error'); }
    finally { setUploading(false); }
  };

  const handleDelete = (reg: Registration) => {
    showConfirm('УДАЛИТЬ?', `"${reg.title}" будет удалён безвозвратно.`, async () => {
      try { await registrationsApi.delete(reg.id); showToast('Удалено', 'success'); fetchData(); }
      catch { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  const addField = (type: FieldType) => {
    const tempId = `temp-${Date.now()}`;
    const config = FIELD_TYPE_CONFIG[type];
    const newField: RegistrationField = {
      id: tempId, registrationId: '', type, label: config.label,
      placeholder: '', required: 0, options: ['Вариант 1', 'Вариант 2'] as any,
      settings: {} as any, position: regFields.length, createdAt: new Date().toISOString(),
    };
    setRegFields(prev => [...prev, newField]);
  };

  const updateField = (fieldId: string, data: Partial<RegistrationField>) => {
    setRegFields(prev => prev.map(f => f.id === fieldId ? { ...f, ...data } : f));
  };

  const deleteField = (fieldId: string) => {
    setRegFields(prev => prev.filter(f => f.id !== fieldId));
  };

  const reorderFields = (from: number, to: number) => {
    setRegFields(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const publicUrl = editing?.publicSlug ? `${window.location.origin}/reg/${editing.publicSlug}` : '';

  const copyLink = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(publicUrl).then(() => showToast('Ссылка скопирована', 'success')).catch(() => fallbackCopy(publicUrl));
    } else {
      fallbackCopy(publicUrl);
    }
  };

  const fallbackCopy = (text: string) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('Ссылка скопирована', 'success'); }
    catch { showToast('Не удалось скопировать', 'error'); }
    document.body.removeChild(ta);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonHeader />
        <SkeletonGrid count={6} />
      </div>
    );
  }

  // ── Submissions View ──
  if (view === 'submissions' && editing) {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('list')} className="flex items-center gap-2 font-mono text-sm text-gray-400 hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4" /> НАЗАД
        </button>
        <SubmissionsTable registrationId={editing.id} fields={regFields} submissions={submissions} onRefresh={() => openSubmissions(editing)} onClose={() => setView('list')} />
        <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm} title={confirmState.title} message={confirmState.message} type={confirmState.type} />
      </div>
    );
  }

  // ── Constructor View ──
  if (view === 'constructor') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => setView('list')} className="flex items-center gap-2 font-mono text-sm text-gray-400 hover:text-gray-200 transition-colors">
            <ArrowLeft className="w-4 h-4" /> НАЗАД
          </button>

          {/* Status toggle — prominent */}
          <div className="flex items-center gap-3">
            <button onClick={() => {
              const newStatus = form.status === 'active' ? 'draft' : 'active';
              setForm(prev => ({ ...prev, status: newStatus }));
            }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold transition-all"
              style={form.status === 'active'
                ? { background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', boxShadow: '0 0 12px rgba(0,255,136,0.2)' }
                : form.status === 'closed'
                ? { background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.3)', color: '#ff3b30' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}>
              {form.status === 'active' ? '● АКТИВНА' : form.status === 'closed' ? '● ЗАКРЫТА' : '○ ЧЕРНОВИК'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {editing && (
              <>
                <button onClick={() => openSubmissions(editing)} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg font-mono text-[10px] sm:text-xs glass hover:bg-white/10">
                  <Eye className="w-3.5 h-3.5" /> ЗАЯВКИ ({editing.confirmedCount || 0})
                </button>
                <button onClick={() => setShowQR(true)} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg font-mono text-[10px] sm:text-xs glass hover:bg-white/10">
                  <QrCode className="w-3.5 h-3.5" /> QR
                </button>
                {publicUrl && (
                  <button onClick={copyLink} className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg font-mono text-[10px] sm:text-xs glass hover:bg-white/10">
                    <Copy className="w-3.5 h-3.5" /> ССЫЛКА
                  </button>
                )}
              </>
            )}
            <button onClick={handleSave} disabled={uploading}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-mono text-xs sm:text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
              {uploading ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
            </button>
            {editing && (
              <button onClick={handleSaveAndNotify} disabled={uploading}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg font-mono text-[10px] sm:text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                ИЗМЕНИТЬ И ОПОВЕСТИТЬ
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Basic info */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-6 space-y-4">
              <h2 className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>ИНФОРМАЦИЯ</h2>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="// НАЗВАНИЕ МЕРОПРИЯТИЯ *"
                className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
              <input value={form.organizer} onChange={e => setForm({ ...form, organizer: e.target.value })} placeholder="// ОРГАНИЗАТОР"
                className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[10px] text-gray-500 mb-1 block">ДАТА</label>
                  <input type="date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-500 mb-1 block">ВРЕМЯ</label>
                  <input type="time" value={form.eventTime} onChange={e => setForm({ ...form, eventTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                </div>
              </div>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="// МЕСТО ПРОВЕДЕНИЯ"
                className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
              {/* Location map */}
              <div>
                <label className="font-mono text-[10px] text-gray-500 mb-1 block">МЕСТО НА КАРТЕ</label>
                <MapField value={form.mapCoords || ''} onChange={coords => setForm(prev => ({ ...prev, mapCoords: coords }))} />
              </div>
              <input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="// ССЫЛКА НА ВИДЕО"
                className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[10px] text-gray-500 mb-1 block">ЛИМИТ УЧАСТНИКОВ</label>
                  <input type="number" min={0} value={form.maxParticipants} onChange={e => setForm({ ...form, maxParticipants: Number(e.target.value) })}
                    placeholder="0 = без лимита"
                    className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-500 mb-1 block">СТАТУС</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                    <option value="draft">Черновик</option>
                    <option value="active">Активна</option>
                    <option value="closed">Закрыта</option>
                  </select>
                </div>
              </div>
              {/* Registration time window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[10px] text-gray-500 mb-1 block">НАЧАЛО РЕГИСТРАЦИИ</label>
                  <input type="datetime-local" value={form.registrationStart} onChange={e => setForm({ ...form, registrationStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-gray-500 mb-1 block">КОНЕЦ РЕГИСТРАЦИИ</label>
                  <input type="datetime-local" value={form.registrationEnd} onChange={e => setForm({ ...form, registrationEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                </div>
              </div>
              {/* Custom message after close */}
              <div>
                <label className="font-mono text-[10px] text-gray-500 mb-1 block">СООБЩЕНИЕ ПОСЛЕ ЗАКРЫТИЯ</label>
                <textarea value={form.closedMessage} onChange={e => setForm({ ...form, closedMessage: e.target.value })}
                  placeholder="// ТЕКСТ КОТОРЫЙ УВИДЯТ ПОЛЬЗОВАТЕЛИ ПОСЛЕ ЗАКРЫТИЯ РЕГИСТРАЦИИ"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] resize-none" />
              </div>
              {/* Display toggles */}
              <div className="flex items-center gap-4 sm:gap-6 pt-2 flex-wrap">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div onClick={() => setForm(prev => ({ ...prev, showLimit: prev.showLimit ? 0 : 1 }))}
                    className="w-10 h-5 rounded-full transition-colors relative cursor-pointer"
                    style={{ background: form.showLimit ? 'var(--color-primary)' : '#3a3a50' }}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.showLimit ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="font-mono text-xs text-gray-300">Показывать лимит мест</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div onClick={() => setForm(prev => ({ ...prev, showTimer: prev.showTimer ? 0 : 1 }))}
                    className="w-10 h-5 rounded-full transition-colors relative cursor-pointer"
                    style={{ background: form.showTimer ? 'var(--color-primary)' : '#3a3a50' }}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.showTimer ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="font-mono text-xs text-gray-300">Показывать таймер</span>
                </label>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="font-mono text-sm font-bold mb-3" style={{ color: 'var(--color-primary)' }}>ОПИСАНИЕ</h2>
              <RichEditor content={form.description} onChange={html => setForm({ ...form, description: html })} placeholder="// ОПИСАНИЕ МЕРОПРИЯТИЯ..." />
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="font-mono text-sm font-bold mb-3" style={{ color: 'var(--color-primary)' }}>ОБЛОЖКА</h2>
              {/* Current image preview */}
              {imageUrl && !imageFiles.length ? (
                <div className="relative rounded-xl overflow-hidden mb-3 group">
                  <img src={imageUrl} alt="" draggable="false" className="w-full h-40 object-cover rounded-xl select-none" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => { setImageUrl(''); }} className="p-2 rounded-lg bg-red-500/30 hover:bg-red-500/50 transition-colors">
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ) : null}
              {/* New file preview with upload button */}
              {imageFiles.length > 0 && (
                <div className="mb-3">
                  <div className="relative rounded-xl overflow-hidden mb-2">
                    <img src={URL.createObjectURL(imageFiles[0])} alt="" draggable="false" className="w-full h-40 object-cover rounded-xl select-none" />
                    <button onClick={() => { setImageFiles([]); }} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/80">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  {!editing ? (
                    <p className="font-mono text-[10px] text-gray-500 text-center">Обложка будет загружена при сохранении</p>
                  ) : (
                    <button onClick={async () => {
                      setUploading(true);
                      try {
                        const res = await registrationsApi.uploadImage(editing.id, imageFiles[0]);
                        if (res.success && res.data) {
                          setImageUrl(res.data.imageUrl);
                          setImageFiles([]);
                          showToast('Обложка загружена', 'success');
                        }
                      } catch { showToast('Ошибка загрузки', 'error'); }
                      finally { setUploading(false); }
                    }} disabled={uploading}
                      className="w-full py-2 rounded-lg font-mono text-xs font-bold transition-all disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                      {uploading ? 'ЗАГРУЗКА...' : 'ЗАГРУЗИТЬ ОБЛОЖКУ'}
                    </button>
                  )}
                </div>
              )}
              {/* Drag-and-drop zone */}
              <label
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgba(0,255,136,0.05)'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '';
                  e.currentTarget.style.background = '';
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    setImageFiles([file]);
                  }
                }}
                className="flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="font-mono text-[10px] text-gray-500">ПЕРЕТАЩИТЕ ИЛИ ВЫБЕРИТЕ</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setImageFiles([f]); }} />
              </label>
            </div>

            {/* Video */}
            <div className="glass rounded-2xl p-6">
              <h2 className="font-mono text-sm font-bold mb-3" style={{ color: 'var(--color-primary)' }}>ВИДЕО</h2>
              {videoUrl && !videoFile ? (
                <div className="relative rounded-xl overflow-hidden mb-3 group">
                  <video src={videoUrl} controls draggable="false" className="w-full rounded-xl select-none" style={{ maxHeight: 300 }} />
                  <button onClick={() => { setVideoUrl(''); setForm(prev => ({ ...prev, videoUrl: '' })); }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : null}
              {videoFile && (
                <div className="mb-3">
                  <div className="relative rounded-xl overflow-hidden mb-2">
                    <video src={URL.createObjectURL(videoFile)} controls draggable="false" className="w-full rounded-xl select-none" style={{ maxHeight: 300 }} />
                    <button onClick={() => setVideoFile(null)} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/80">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  {!editing ? (
                    <p className="font-mono text-[10px] text-gray-500 text-center">Видео будет загружено при сохранении</p>
                  ) : (
                    <button onClick={async () => {
                      setUploading(true);
                      try {
                        const res = await registrationsApi.uploadVideo(editing.id, videoFile);
                        if (res.success && res.data) {
                          setVideoUrl(res.data.videoUrl);
                          setVideoFile(null);
                          showToast('Видео загружено', 'success');
                        }
                      } catch { showToast('Ошибка загрузки', 'error'); }
                      finally { setUploading(false); }
                    }} disabled={uploading}
                      className="w-full py-2 rounded-lg font-mono text-xs font-bold transition-all disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                      {uploading ? 'ЗАГРУЗКА...' : 'ЗАГРУЗИТЬ ВИДЕО'}
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
                  if (file && file.type.startsWith('video/')) {
                    setVideoFile(file);
                  }
                }}
                className="flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="font-mono text-[10px] text-gray-500">ПЕРЕТАЩИТЕ ВИДЕО ИЛИ ВЫБЕРИТЕ</span>
                <span className="font-mono text-[9px] text-gray-600">MP4, WebM, OGG</span>
                <input type="file" accept="video/mp4,video/webm,video/ogg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setVideoFile(f); }} />
              </label>
            </div>

            {/* Media Gallery */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>МЕДИАГАЛЕРЕЯ ({mediaItems.length + mediaFiles.length})</h2>
                {editing && mediaFiles.length > 0 && (
                  <button onClick={async () => {
                    setUploading(true);
                    let ok = 0;
                    for (const file of mediaFiles) {
                      try { await registrationsApi.uploadMedia(editing.id, file); ok++; } catch {}
                    }
                    setUploading(false);
                    showToast(`Загружено: ${ok} файлов`, 'success');
                    setMediaFiles([]);
                    try { const res = await registrationsApi.getMedia(editing.id); if (res.success && res.data) setMediaItems(Array.isArray(res.data) ? res.data : []); } catch {}
                  }} disabled={uploading}
                    className="px-3 py-1 rounded-lg font-mono text-[10px] font-bold transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                    {uploading ? 'ЗАГРУЗКА...' : `ЗАГРУЗИТЬ ВСЕ (${mediaFiles.length})`}
                  </button>
                )}
              </div>
              {/* Existing media */}
              {mediaItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {mediaItems.map((m: any) => (
                    <div key={m.id} className="relative rounded-lg overflow-hidden group">
                      {m.type === 'video' ? (
                        <video src={m.url} draggable="false" className="w-full h-24 object-cover select-none" />
                      ) : (
                        <img src={m.url} alt="" draggable="false" className="w-full h-24 object-cover select-none" />
                      )}
                      <button onClick={async () => { await registrationsApi.deleteMedia(m.id); setMediaItems(prev => prev.filter((i: any) => i.id !== m.id)); showToast('Удалено', 'success'); }}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* New files preview */}
              {mediaFiles.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {mediaFiles.map((f, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden">
                      {f.type.startsWith('video/') ? (
                        <video src={URL.createObjectURL(f)} draggable="false" className="w-full h-24 object-cover select-none" />
                      ) : (
                        <img src={URL.createObjectURL(f)} alt="" draggable="false" className="w-full h-24 object-cover select-none" />
                      )}
                      <button onClick={() => setMediaFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60">
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <div className="absolute bottom-1 left-1 right-1 text-center">
                        <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-black/60 text-gray-300 truncate block">{f.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Drag-and-drop zone */}
              <label
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgba(0,255,136,0.05)'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '';
                  e.currentTarget.style.background = '';
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
                  if (files.length > 0) setMediaFiles(prev => [...prev, ...files]);
                }}
                className="flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
                <Plus className="w-5 h-5 text-gray-400" />
                <span className="font-mono text-[10px] text-gray-500">ПЕРЕТАЩИТЕ ИЛИ ВЫБЕРИТЕ</span>
                <span className="font-mono text-[9px] text-gray-600">Фото + Видео • можно несколько сразу</span>
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { const files = e.target.files; if (files) setMediaFiles(prev => [...prev, ...Array.from(files)]); }} />
              </label>
            </div>
          </div>

          {/* Right: Field Builder */}
          <div className="glass rounded-2xl p-6">
            <FieldBuilder fields={regFields} onAdd={addField} onUpdate={updateField} onDelete={deleteField} onReorder={reorderFields} />
          </div>
        </div>

        {/* Public link display */}
        {editing && publicUrl && (
          <div className="glass rounded-2xl p-4 flex items-center gap-4 flex-wrap">
            <span className="font-mono text-xs text-gray-400">ПУБЛИЧНАЯ ССЫЛКА:</span>
            <code className="font-mono text-sm px-3 py-1.5 rounded-lg bg-black/30 border border-gray-700 text-green-400 break-all">{publicUrl}</code>
            <button onClick={copyLink} className="p-2 rounded-lg hover:bg-white/10"><Copy className="w-4 h-4 text-gray-400" /></button>
          </div>
        )}

        {/* QR Modal */}
        <AnimatePresence>
          {showQR && editing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowQR(false)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="glass-frost rounded-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
                <h3 className="font-mono text-sm font-bold mb-4" style={{ color: 'var(--color-primary)' }}>QR-КОД РЕГИСТРАЦИИ</h3>
                <div className="inline-block p-4 bg-white rounded-xl">
                  <QRCodeSVG value={publicUrl} size={200} />
                </div>
                <p className="font-mono text-xs text-gray-400 mt-3 break-all max-w-xs mx-auto">{publicUrl}</p>
                <button onClick={() => setShowQR(false)} className="mt-4 px-4 py-2 rounded-xl glass font-mono text-xs text-gray-400">ЗАКРЫТЬ</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm} title={confirmState.title} message={confirmState.message} type={confirmState.type} />
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <ClipboardList className="w-7 h-7 md:w-8 md:h-8" /> РЕГИСТРАЦИЯ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// {registrations.length} ФОРМ</p>
        </div>
        <div className="flex gap-2">
          <a href="/checkin-scanner" className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm glass hover:bg-white/10 transition-all">
            <Camera className="w-4 h-4" /> СКАНЕР
          </a>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" /> СОЗДАТЬ
          </button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
            className="w-full pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
        </div>
        {['', 'draft', 'active', 'closed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold transition-all"
            style={filterStatus === s
              ? { background: s ? STATUS_CONFIG[s]?.color : 'var(--color-primary)', color: '#000' }
              : { color: '#6a6a80', background: 'rgba(255,255,255,0.03)' }}>
            {s ? STATUS_CONFIG[s]?.label : 'ВСЕ'}
          </button>
        ))}
      </div>

      <div ref={listRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(reg => {
          const status = STATUS_CONFIG[reg.status] || STATUS_CONFIG.draft;
          return (
            <motion.div key={reg.id} layout whileHover={{ y: -4 }}
              className="glass-card rounded-xl overflow-hidden group cursor-pointer"
              onClick={() => openEdit(reg)}>
              {reg.imageUrl && (
                <div className="h-32 overflow-hidden">
                  <img src={reg.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-mono text-sm font-bold text-gray-200 truncate flex-1">{reg.title}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: `${status.color}20`, color: status.color }}>{status.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500 flex-wrap">
                  {reg.eventDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{reg.eventDate}</span>}
                  {reg.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{reg.location}</span>}
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{reg.confirmedCount || 0}{reg.maxParticipants > 0 ? `/${reg.maxParticipants}` : ''}</span>
                  {(reg.waitlistCount || 0) > 0 && <span className="flex items-center gap-1" style={{ color: '#eab308' }}><Clock className="w-3 h-3" />{reg.waitlistCount}</span>}
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                  <button onClick={e => { e.stopPropagation(); openEdit(reg); }} className="p-1.5 rounded hover:bg-white/10"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button onClick={e => { e.stopPropagation(); openSubmissions(reg); }} className="p-1.5 rounded hover:bg-white/10"><Eye className="w-3.5 h-3.5 text-gray-400" /></button>
                  <a href={`/registrations/${reg.id}/participants`} onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-white/10"><Users className="w-3.5 h-3.5 text-gray-400" /></a>
                  <button onClick={e => { e.stopPropagation(); handleDelete(reg); }} className="p-1.5 rounded hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
          <p className="font-mono text-gray-500">// НЕТ РЕГИСТРАЦИЙ</p>
        </div>
      )}

      <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm} title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
}
