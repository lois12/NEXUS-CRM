import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, X, ClipboardList, Eye, QrCode, Copy, Calendar, Users, MapPin, ArrowLeft, Clock, Upload, Camera, ExternalLink, BarChart3, Phone } from 'lucide-react';
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
import { shareToMax } from '../utils/shareToMax';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: '#6b7280' },
  active: { label: 'Активна', color: '#00ff88' },
  closed: { label: 'Закрыта', color: '#ff3b30' },
  archived: { label: 'Архив', color: '#4a4a60' },
};

export default function Registrations() {
  const REG_THEMES = [
    { id: 'cyberpunk', label: 'Киберпанк', preview: { bg: '#0a0a0f', primary: '#00ff88', text: '#e8e8ec', card: 'rgba(15,15,25,0.9)', border: 'rgba(0,255,136,0.15)' } },
    { id: 'synthwave', label: 'Синтвейв', preview: { bg: '#1a0a2e', primary: '#ff00ff', text: '#f0e0ff', card: 'rgba(30,10,50,0.9)', border: 'rgba(255,0,255,0.2)' } },
    { id: 'minimal', label: 'Минимализм', preview: { bg: '#ffffff', primary: '#111827', text: '#374151', card: '#f9fafb', border: '#e5e7eb' } },
    { id: 'corporate', label: 'Корпоратив', preview: { bg: '#f0f4f8', primary: '#2563eb', text: '#1e293b', card: '#ffffff', border: '#cbd5e1' } },
    { id: 'nature', label: 'Природа', preview: { bg: '#0f1f0f', primary: '#4ade80', text: '#dcfce7', card: 'rgba(20,40,20,0.9)', border: 'rgba(74,222,128,0.2)' } },
    { id: 'sunset', label: 'Закат', preview: { bg: '#1a0a0a', primary: '#f97316', text: '#fed7aa', card: 'rgba(30,15,10,0.9)', border: 'rgba(249,115,22,0.2)' } },
    { id: 'ocean', label: 'Океан', preview: { bg: '#0a1628', primary: '#06b6d4', text: '#cffafe', card: 'rgba(10,25,45,0.9)', border: 'rgba(6,182,212,0.2)' } },
    { id: 'elegant', label: 'Элегант', preview: { bg: '#0f0f0f', primary: '#d4a574', text: '#f5e6d3', card: 'rgba(20,20,20,0.95)', border: 'rgba(212,165,116,0.2)' } },
  ];
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'planned' | 'archive'>('active');
  const [view, setView] = useState<'list' | 'constructor' | 'submissions'>('list');
  const [editing, setEditing] = useState<Registration | null>(null);
  const [form, setForm] = useState({ title: '', description: '', eventDate: '', eventTime: '', location: '', videoUrl: '', maxParticipants: 0, status: 'draft' as string, registrationStart: '', registrationEnd: '', closedMessage: '', mapCoords: '', showLimit: 1, showTimer: 1, organizer: '', color: '', theme: 'cyberpunk', waitlistEnabled: 1, maxWaitlist: 0 });
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
  const [stats, setStats] = useState<any>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  const fetchStats = async (regId: string) => {
    try {
      const res = await registrationsApi.getStats(regId);
      if (res.success) setStats(res.data);
    } catch {}
  };

  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await registrationsApi.getAllContacts();
      if (res.success && res.data) setContacts(res.data);
    } catch { showToast('Ошибка загрузки контактов', 'error'); }
    finally { setContactsLoading(false); }
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await registrationsApi.getAll();
      if (res.success && res.data) setRegistrations(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = registrations.filter(r => {
    if (activeTab === 'active' && r.status !== 'active') return false;
    if (activeTab === 'planned' && r.status !== 'draft') return false;
    if (activeTab === 'archive' && r.status !== 'archived' && r.status !== 'closed') return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', eventDate: '', eventTime: '', location: '', videoUrl: '', maxParticipants: 0, status: 'draft', registrationStart: '', registrationEnd: '', closedMessage: '', mapCoords: '', showLimit: 1, showTimer: 1, organizer: '', color: '', theme: 'cyberpunk', waitlistEnabled: 1, maxWaitlist: 0 });
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
          color: data.color || '',
          theme: data.theme || 'cyberpunk',
          waitlistEnabled: data.waitlistEnabled ?? 1,
          maxWaitlist: data.maxWaitlist ?? 0,
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
      fetchStats(reg.id);
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Введите название мероприятия', 'error'); return; }
    if (!form.organizer.trim()) { showToast('Введите организатора', 'error'); return; }
    if (!form.eventDate) { showToast('Укажите дату проведения', 'error'); return; }
    if (!form.eventTime) { showToast('Укажите время проведения', 'error'); return; }
    if (!form.location.trim()) { showToast('Укажите место проведения', 'error'); return; }
    if (!form.registrationStart) { showToast('Укажите начало регистрации', 'error'); return; }
    if (!form.registrationEnd) { showToast('Укажите конец регистрации', 'error'); return; }
    if (!form.description.trim()) { showToast('Введите описание мероприятия', 'error'); return; }
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
    if (!form.title.trim()) { showToast('Введите название мероприятия', 'error'); return; }
    if (!form.organizer.trim()) { showToast('Введите организатора', 'error'); return; }
    if (!form.eventDate) { showToast('Укажите дату проведения', 'error'); return; }
    if (!form.eventTime) { showToast('Укажите время проведения', 'error'); return; }
    if (!form.location.trim()) { showToast('Укажите место проведения', 'error'); return; }
    if (!form.registrationStart) { showToast('Укажите начало регистрации', 'error'); return; }
    if (!form.registrationEnd) { showToast('Укажите конец регистрации', 'error'); return; }
    if (!form.description.trim()) { showToast('Введите описание мероприятия', 'error'); return; }
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

  const handleDuplicate = async (id: string) => {
    try {
      const res = await registrationsApi.duplicate(id);
      if (res.success) {
        showToast('Регистрация скопирована', 'success');
        fetchData();
      }
    } catch {
      showToast('Ошибка копирования', 'error');
    }
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

  const duplicateField = (fieldId: string) => {
    setRegFields(prev => {
      const src = prev.find(f => f.id === fieldId);
      if (!src) return prev;
      const dup: RegistrationField = {
        ...src,
        id: `temp-${Date.now()}`,
        label: src.label + ' (копия)',
        position: prev.length,
        createdAt: new Date().toISOString(),
      };
      const idx = prev.findIndex(f => f.id === fieldId);
      const arr = [...prev];
      arr.splice(idx + 1, 0, dup);
      return arr;
    });
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

        {/* Statistics cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <p className="font-mono text-[10px] text-gray-500 mb-1">ВСЕГО ЗАЯВОК</p>
              <p className="font-mono text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{stats.total || submissions.length}</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="font-mono text-[10px] text-gray-500 mb-1">ПОДТВЕРЖДЕНО</p>
              <p className="font-mono text-2xl font-bold" style={{ color: '#00d4ff' }}>{stats.confirmed || submissions.filter(s => s.status === 'confirmed').length}</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="font-mono text-[10px] text-gray-500 mb-1">ЗАРЕГИСТРИРОВАНО</p>
              <p className="font-mono text-2xl font-bold" style={{ color: '#00ff88' }}>{stats.registered || submissions.filter(s => s.status === 'registered').length}</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="font-mono text-[10px] text-gray-500 mb-1">В ОЖИДАНИИ</p>
              <p className="font-mono text-2xl font-bold" style={{ color: '#eab308' }}>{stats.waitlist || submissions.filter(s => s.status === 'waitlist').length}</p>
            </div>
          </div>
        )}

        {/* Daily trend */}
        {stats?.dailyTrend && stats.dailyTrend.length > 0 && (
          <div className="glass rounded-xl p-4">
            <h3 className="font-mono text-xs font-bold text-gray-400 mb-3 flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5" /> РЕГИСТРАЦИИ ПО ДНЯМ</h3>
            <div className="flex items-end gap-1 h-20">
              {stats.dailyTrend.map((d: any, i: number) => {
                const max = Math.max(...stats.dailyTrend.map((x: any) => x.count), 1);
                const height = (d.count / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                    <span className="font-mono text-[8px] text-gray-500">{d.count}</span>
                    <div className="w-full rounded-t" style={{ height: `${height}%`, minHeight: 2, background: 'var(--color-primary)', opacity: 0.7 }} />
                    <span className="font-mono text-[7px] text-gray-600 truncate w-full text-center">{d.date?.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
              {/* Waitlist toggle */}
              <div>
                <label className="text-xs font-mono text-gray-500 mb-2 block">ВЕЙТЛИСТ</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setForm({ ...form, waitlistEnabled: form.waitlistEnabled ? 0 : 1 })}
                    className="w-10 h-5 rounded-full transition-colors relative"
                    style={{ background: form.waitlistEnabled ? 'var(--color-primary)' : '#3a3a50' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                      style={{ transform: form.waitlistEnabled ? 'translateX(20px)' : 'translateX(2px)' }} />
                  </button>
                  <span className="text-xs font-mono text-gray-400">{form.waitlistEnabled ? 'Включён' : 'Выключен'}</span>
                </div>
                {form.waitlistEnabled === 1 && (
                  <div className="mt-2">
                    <label className="text-xs font-mono text-gray-500 mb-1 block">Лимит вейтлиста (0 = без лимита)</label>
                    <input type="number" min="0" value={form.maxWaitlist}
                      onChange={e => setForm({ ...form, maxWaitlist: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 rounded-xl font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
                  </div>
                )}
              </div>
              {/* Color picker */}
              <label className="block">
                <span className="font-mono text-sm text-gray-300">ЦВЕТ АКЦЕНТА</span>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={form.color || '#00ff88'}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-gray-700" />
                  <span className="font-mono text-xs text-gray-400">{form.color || '#00ff88'}</span>
                  {form.color && (
                    <button onClick={() => setForm({ ...form, color: '' })} className="text-xs text-gray-500 hover:text-gray-300">Сбросить</button>
                  )}
                </div>
              </label>
              {/* Theme picker */}
              <div>
                <label className="text-xs font-mono text-gray-500 mb-2 block">ТЕМА ОФОРМЛЕНИЯ</label>
                <div className="grid grid-cols-4 gap-2">
                  {REG_THEMES.map(t => (
                    <button key={t.id} onClick={() => setForm({ ...form, theme: t.id })}
                      className="rounded-xl p-2 transition-all text-center"
                      style={form.theme === t.id
                        ? { background: t.preview.primary, color: t.preview.bg, border: `2px solid ${t.preview.primary}`, boxShadow: `0 0 12px ${t.preview.primary}40` }
                        : { background: t.preview.card, color: t.preview.text, border: `1px solid ${t.preview.border}` }
                      }>
                      <div className="text-[10px] font-mono font-bold">{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Live preview */}
              {form.theme && (
                <div>
                  <label className="text-xs font-mono text-gray-500 mb-2 block">ПРЕДПРОСМОТР</label>
                  {(() => {
                    const t = REG_THEMES.find(th => th.id === form.theme);
                    if (!t) return null;
                    return (
                      <div className="rounded-xl overflow-hidden" style={{ background: t.preview.bg, border: `1px solid ${t.preview.border}`, padding: '16px' }}>
                        <h3 className="font-mono text-sm font-bold mb-2" style={{ color: t.preview.primary }}>{form.title || 'Название мероприятия'}</h3>
                        <p className="text-[10px] mb-3" style={{ color: t.preview.text, opacity: 0.7 }}>{form.description || 'Описание мероприятия'}</p>
                        <div className="space-y-2">
                          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${t.preview.border}` }}>
                            <span className="text-[10px] font-mono" style={{ color: t.preview.text, opacity: 0.5 }}>// ФАМИЛИЯ *</span>
                          </div>
                          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${t.preview.border}` }}>
                            <span className="text-[10px] font-mono" style={{ color: t.preview.text, opacity: 0.5 }}>// ИМЯ *</span>
                          </div>
                          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${t.preview.border}` }}>
                            <span className="text-[10px] font-mono" style={{ color: t.preview.text, opacity: 0.5 }}>// EMAIL *</span>
                          </div>
                          <div className="rounded-lg px-3 py-2 text-center" style={{ background: t.preview.primary, color: t.preview.bg }}>
                            <span className="text-[10px] font-mono font-bold">ЗАРЕГИСТРИРОВАТЬСЯ</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
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
            <FieldBuilder fields={regFields} onAdd={addField} onUpdate={updateField} onDelete={deleteField} onDuplicate={duplicateField} onReorder={reorderFields} />
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
          <button onClick={() => { setShowContacts(true); fetchContacts(); }} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm glass hover:bg-white/10 transition-all">
            <Users className="w-4 h-4" /> БАЗА
          </button>
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-black/30 border border-gray-800 w-fit">
        {([
          { key: 'active' as const, label: 'АКТИВНЫЕ', color: '#00ff88' },
          { key: 'planned' as const, label: 'ЗАПЛАНИРОВАНЫ', color: '#eab308' },
          { key: 'archive' as const, label: 'АРХИВ', color: '#6b7280' },
        ]).map(tab => {
          const count = tab.key === 'active'
            ? registrations.filter(r => r.status === 'active').length
            : tab.key === 'planned'
            ? registrations.filter(r => r.status === 'draft').length
            : registrations.filter(r => r.status === 'archived' || r.status === 'closed').length;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all"
              style={activeTab === tab.key
                ? { background: `${tab.color}18`, color: tab.color, boxShadow: `0 0 12px ${tab.color}20` }
                : { color: '#4a4a60' }}>
              {tab.label}
              <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                style={activeTab === tab.key
                  ? { background: `${tab.color}25`, color: tab.color }
                  : { background: 'rgba(255,255,255,0.05)', color: '#4a4a60' }}>
                {count}
              </span>
            </button>
          );
        })}
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
                  <h3 className="font-mono text-sm font-bold text-gray-200 truncate flex-1">
                    {reg.color && <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: reg.color }} />}
                    {reg.title}
                  </h3>
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
                  {reg.publicSlug && (
                    <a href={`/reg/${reg.publicSlug}`} target="_blank" rel="noopener"
                      onClick={e => e.stopPropagation()}
                      className="p-1.5 rounded hover:bg-white/10" title="Предпросмотр">
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </a>
                  )}
                  <button onClick={e => { e.stopPropagation(); handleDuplicate(reg.id); }} className="p-1.5 rounded hover:bg-white/10" title="Копировать"><Copy className="w-3.5 h-3.5 text-gray-400" /></button>
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

      {/* Contacts Database Modal */}
      <AnimatePresence>
        {showContacts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setShowContacts(false); setSelectedContact(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
              style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="font-mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>БАЗА КОНТАКТОВ</h3>
                <button onClick={() => { setShowContacts(false); setSelectedContact(null); }} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Закрыть">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              {/* Search */}
              <div className="px-6 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="Поиск по имени, телефону, email..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 focus:border-white/20 transition-colors placeholder:text-gray-600"
                  />
                </div>
              </div>
              
              {/* Table */}
              <div className="flex-1 overflow-y-auto px-6">
                {contactsLoading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-3 py-2 font-mono text-[10px] text-gray-500">№</th>
                        <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ФАМИЛИЯ</th>
                        <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ИМЯ</th>
                        <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ОТЧЕСТВО</th>
                        <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ТЕЛЕФОН</th>
                        <th className="px-3 py-2 font-mono text-[10px] text-gray-500">ПОЧТА</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts
                        .filter(c => {
                          if (!contactSearch) return true;
                          const q = contactSearch.toLowerCase();
                          return (
                            (c.contactLastName || '').toLowerCase().includes(q) ||
                            (c.contactFirstName || '').toLowerCase().includes(q) ||
                            (c.contactPatronymic || '').toLowerCase().includes(q) ||
                            (c.contactName || '').toLowerCase().includes(q) ||
                            (c.contactPhone || '').toLowerCase().includes(q) ||
                            (c.contactEmail || '').toLowerCase().includes(q)
                          );
                        })
                        .map((c, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/[0.04] cursor-pointer transition-colors"
                            onClick={() => setSelectedContact(c)}>
                            <td className="px-3 py-2 font-mono text-xs text-gray-500">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-sm text-gray-200">{c.contactLastName || c.contactName?.split(' ')[0] || '—'}</td>
                            <td className="px-3 py-2 font-mono text-sm text-gray-200">{c.contactFirstName || c.contactName?.split(' ')[1] || '—'}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-400">{c.contactPatronymic || c.contactName?.split(' ')[2] || '—'}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-300">{c.contactPhone || '—'}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-300">{c.contactEmail || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
                {!contactsLoading && contacts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="font-mono text-xs text-gray-500">// НЕТ КОНТАКТОВ</p>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="px-6 py-3 text-right" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="font-mono text-[10px] text-gray-500">{contacts.length} контактов</span>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Contact detail modal */}
        {selectedContact && (() => {
          const c = selectedContact;
          const displayName = [c.contactLastName, c.contactFirstName, c.contactPatronymic].filter(Boolean).join(' ')
            || c.contactName || 'Без имени';
          const cleanPhone = (c.contactPhone || '').replace(/[^\d+]/g, '');
          const copyText = [displayName, c.contactPhone, c.contactEmail].filter(Boolean).join('\n');

          // МАКС: на телефоне — шейлер с приложением, на десктопе — web.max.ru
          const shareToMaxHandler = () => shareToMax(displayName, copyText);

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={() => setSelectedContact(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full max-w-md rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 className="font-mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>КОНТАКТ</h3>
                  <button onClick={() => setSelectedContact(null)} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Закрыть">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
                      style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)' }}>
                      {(c.contactLastName || displayName)[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-mono text-sm font-bold text-gray-200 truncate">{displayName}</h4>
                      {c.contactPhone && <p className="font-mono text-xs text-gray-400">{c.contactPhone}</p>}
                      {c.contactEmail && <p className="font-mono text-xs text-gray-500 truncate">{c.contactEmail}</p>}
                    </div>
                  </div>

                  {/* Stats */}
                  {(c.eventCount != null || c.lastRegistration) && (
                    <div className="flex gap-2">
                      {c.eventCount != null && (
                        <div className="flex-1 rounded-lg px-3 py-2" style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.12)' }}>
                          <p className="font-mono text-[9px] text-gray-500">МЕРОПРИЯТИЙ</p>
                          <p className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{c.eventCount}</p>
                        </div>
                      )}
                      {c.lastRegistration && (
                        <div className="flex-1 rounded-lg px-3 py-2" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}>
                          <p className="font-mono text-[9px] text-gray-500">ПОСЛЕДНЯЯ РЕГ.</p>
                          <p className="font-mono text-xs text-gray-300 mt-0.5">{String(c.lastRegistration).slice(0, 10)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions: copy + socials */}
                  <div className="grid grid-cols-5 gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(copyText); showToast('Скопировано'); }}
                      className="flex flex-col items-center gap-1 p-2.5 rounded-xl glass hover:bg-white/10 transition-all">
                      <Copy className="w-4 h-4 text-gray-400" />
                      <span className="font-mono text-[9px] text-gray-500">Копия</span>
                    </button>

                    <a href={`https://t.me/share/url?url=${encodeURIComponent(copyText)}`} target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 p-2.5 rounded-xl glass hover:bg-white/10 transition-all no-underline">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#0088CC"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      <span className="font-mono text-[9px] text-gray-500">Telegram</span>
                    </a>

                    {cleanPhone ? (
                      <a href={`https://api.whatsapp.com/send?phone=${cleanPhone.replace(/^\+/, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1 p-2.5 rounded-xl glass hover:bg-white/10 transition-all no-underline">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        <span className="font-mono text-[9px] text-gray-500">WhatsApp</span>
                      </a>
                    ) : (
                      <div className="flex flex-col items-center gap-1 p-2.5 rounded-xl opacity-30">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        <span className="font-mono text-[9px] text-gray-500">WhatsApp</span>
                      </div>
                    )}

                    <a href={`https://vk.com/share.php?url=${encodeURIComponent(window.location.href)}&title=${encodeURIComponent(displayName)}&comment=${encodeURIComponent(copyText)}`} target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 p-2.5 rounded-xl glass hover:bg-white/10 transition-all no-underline">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#0077FF"><path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.596-.189 1.362 1.26 2.174 1.817.613.42 1.079.328 1.079.328l2.172-.03s1.136-.07.598-.964c-.044-.073-.314-.66-1.618-1.866-1.364-1.264-1.182-1.06.462-3.246.999-1.33 1.398-2.143 1.273-2.49-.12-.334-.86-.246-.86-.246l-2.446.015s-.182-.025-.316.056c-.131.079-.216.263-.216.263s-.387 1.026-.902 1.906c-1.086 1.85-1.524 1.952-1.702 1.838-.415-.268-.312-1.076-.312-1.65 0-1.793.272-2.54-.529-2.734-.266-.064-.462-.107-1.143-.114-.874-.008-1.613.003-2.032.208-.28.137-.496.442-.363.46.163.022.532.099.728.366.254.346.245 1.124.245 1.124s.146 2.15-.34 2.416c-.333.184-.791-.19-1.776-1.9-.503-.877-.882-1.844-.882-1.844s-.073-.18-.204-.277c-.159-.118-.38-.156-.38-.156l-2.32.015s-.348.01-.476.162c-.114.135-.01.413-.01.413s1.82 4.262 3.882 6.408c1.89 1.968 4.04 1.836 4.04 1.836h.976z"/></svg>
                      <span className="font-mono text-[9px] text-gray-500">ВКонтакте</span>
                    </a>

                    <button onClick={shareToMaxHandler}
                      className="flex flex-col items-center gap-1 p-2.5 rounded-xl glass hover:bg-white/10 transition-all no-underline">
                      <svg viewBox="0 0 100 100" className="w-4 h-4" fill="currentColor"><path fillRule="evenodd" d="M50.76 0c27.53 0 49.12 22.34 49.12 49.89S77.61 99.23 51.02 99.23c-9.43 0-14.01-1.33-21.37-6.54-.5-.36-1.2-.26-1.63.19-5.66 6.04-20.17 10.28-20.83 2.03C7.19 80.53 0 71.18 0 49.61 0 21.3 23.22 0 50.76 0m.77 24.55c-13.07-.68-23.26 8.39-25.51 22.58-1.86 11.75 1.44 26.07 4.26 26.8 1.2.3 4.08-1.9 6.18-3.88.4-.37.99-.44 1.45-.15 3.27 2 6.97 3.5 11.05 3.71 13.42.7 25.3-9.8 26-23.21.71-13.42-10.01-25.14-23.43-25.85" clipRule="evenodd"/></svg>
                      <span className="font-mono text-[9px] text-gray-500">МАКС</span>
                    </button>
                  </div>

                  {/* Call button */}
                  {cleanPhone && (
                    <a href={`tel:${cleanPhone}`}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-bold w-full transition-all"
                      style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>
                      <Phone className="w-4 h-4" /> ПОЗВОНИТЬ
                    </a>
                  )}

                  {/* Copy phone / copy email */}
                  <div className="flex gap-2">
                    {c.contactPhone && (
                      <button onClick={() => { navigator.clipboard.writeText(c.contactPhone); showToast('Телефон скопирован'); }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all text-gray-300">
                        <Copy className="w-3.5 h-3.5" /> ТЕЛЕФОН
                      </button>
                    )}
                    {c.contactEmail && (
                      <button onClick={() => { navigator.clipboard.writeText(c.contactEmail); showToast('Email скопирован'); }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-all text-gray-300">
                        <Copy className="w-3.5 h-3.5" /> EMAIL
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
