import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Save, Globe, Edit3, User, Briefcase, MessageSquare, Link2, Zap, Bell, BellOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../services/api';
import { showToast } from '../components/ui/NexusModal';
import Spinner from '../components/common/Spinner';
import { formatDateKR } from '../utils/timezone';

const STATUS_OPTIONS = [
  { value: '', label: 'Без статуса', icon: '' },
  { value: 'online', label: 'В сети', icon: '🟢' },
  { value: 'busy', label: 'Занят', icon: '🔴' },
  { value: 'away', label: 'Отошёл', icon: '🟡' },
  { value: 'dnd', label: 'Не беспокоить', icon: '⛔' },
  { value: 'remote', label: 'Удалёнка', icon: '🏠' },
];

const SOCIAL_PLATFORMS = [
  { key: 'telegram', label: 'Telegram', placeholder: '@username' },
  { key: 'vk', label: 'VK', placeholder: 'https://vk.com/...' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/...' },
  { key: 'website', label: 'Сайт', placeholder: 'https://...' },
  { key: 'email', label: 'Email', placeholder: 'user@example.com' },
  { key: 'phone', label: 'Телефон', placeholder: '+7 ...' },
];

export default function Profile() {
  const { user, setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: '',
    position: '',
    about: '',
    status: '',
    socialLinks: {} as Record<string, string>,
  });

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        position: (user as any).position || '',
        about: (user as any).about || '',
        status: (user as any).status || '',
        socialLinks: (user as any).socialLinks || {},
      });
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    try {
      if ('Notification' in window && 'serviceWorker' in navigator) {
        setPushEnabled(Notification.permission === 'granted');
      }
    } catch {}
  }, []);

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      const nav = typeof window !== 'undefined' ? window.navigator : null;
      if (!nav?.serviceWorker) {
        showToast('Service Worker не поддерживается', 'error');
        return;
      }

      if (pushEnabled) {
        // Unsubscribe
        const reg = await nav.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token')}`,
            },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setPushEnabled(false);
        showToast('Push-уведомления отключены', 'success');
      } else {
        // Subscribe
        await nav.serviceWorker.register('/sw.js');
        const ready = await nav.serviceWorker.ready;

        const vapidRes = await (await fetch('/api/push/vapid-key', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token')}` }
        })).json();

        if (!vapidRes.success || !vapidRes.data?.publicKey) {
          showToast('Ошибка получения ключа', 'error');
          return;
        }

        const key = vapidRes.data.publicKey;
        const padding = '='.repeat((4 - (key.length % 4)) % 4);
        const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const keyArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) keyArray[i] = rawData.charCodeAt(i);

        const sub = await ready.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyArray,
        });

        const subJson = sub.toJSON();
        const saveRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token')}`,
          },
          body: JSON.stringify({
            subscription: {
              endpoint: sub.endpoint,
              keys: { p256dh: subJson.keys!.p256dh, auth: subJson.keys!.auth },
            },
          }),
        });

        const saveData = await saveRes.json();
        if (saveData.success) {
          setPushEnabled(true);
          showToast('Push-уведомления включены', 'success');
        } else {
          showToast('Ошибка сохранения', 'error');
        }
      }
    } catch (err) {
      showToast('Ошибка: ' + (err as Error).message, 'error');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await usersApi.updateMyProfile(form);
      if (res.success && res.data) {
        const updatedUser = { ...user, ...res.data };
        localStorage.setItem('nexus_user', JSON.stringify(updatedUser));
        setUser(updatedUser as any);
        showToast('Профиль обновлён', 'success');
        setIsEditing(false);
      }
    } catch (e) { showToast('Ошибка сохранения', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await usersApi.uploadMyAvatar(file);
      if (res.success && res.data) {
        const updatedUser = { ...user, avatar: res.data.avatar };
        localStorage.setItem('nexus_user', JSON.stringify(updatedUser));
        setUser(updatedUser as any);
        showToast('Аватар обновлён', 'success');
      }
    } catch (e) { showToast('Ошибка загрузки', 'error'); }
    finally { setUploading(false); }
  };

  const handlePasswordChange = async () => {
    if (!passwords.new || passwords.new.length < 4) { showToast('Пароль слишком короткий', 'error'); return; }
    if (passwords.new !== passwords.confirm) { showToast('Пароли не совпадают', 'error'); return; }
    setIsSaving(true);
    try {
      const res = await usersApi.updateMyProfile({ password: passwords.new });
      if (res.success) {
        showToast('Пароль изменён', 'success');
        setShowPasswordChange(false);
        setPasswords({ new: '', confirm: '' });
      }
    } catch { showToast('Ошибка смены пароля', 'error'); }
    finally { setIsSaving(false); }
  };

  const updateSocialLink = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [key]: value },
    }));
  };

  if (isLoading) return <Spinner text="ЗАГРУЗКА ПРОФИЛЯ..." />;

  const statusConfig = STATUS_OPTIONS.find(s => s.value === form.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl overflow-hidden"
      >
        {/* Banner gradient */}
        <div className="h-32 md:h-40 relative" style={{
          background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 50%, #ff00ff 100%)`,
          opacity: 0.3,
        }}>
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(10,10,15,0.8) 100%)',
          }} />
        </div>

        {/* Profile info */}
        <div className="px-6 pb-6 -mt-16 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden border-4"
                style={{ borderColor: 'var(--color-bg)', boxShadow: '0 0 30px var(--color-glow)' }}>
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center glass-accent">
                    <User className="w-12 h-12" style={{ color: 'var(--color-primary)' }} />
                  </div>
                )}
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
            </div>

            {/* Name and role */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                  {user?.fullName}
                </h1>
                {statusConfig?.icon && (
                  <span className="text-sm" title={statusConfig.label}>{statusConfig.icon}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                  {user?.role}
                </span>
                {(user as any).position && (
                  <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {(user as any).position}
                  </span>
                )}
              </div>
              <p className="font-mono text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                @{user?.username}
              </p>
            </div>

            {/* Edit button */}
            <button onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-bold transition-all"
              style={isEditing
                ? { backgroundColor: 'var(--color-primary)', color: '#000' }
                : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--color-text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }
              }>
              {isSaving ? <Zap className="w-4 h-4 animate-spin" /> : isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              {isEditing ? 'СОХРАНИТЬ' : 'РЕДАКТИРОВАТЬ'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — About */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* About */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-mono text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> О СЕБЕ
            </h2>
            {isEditing ? (
              <textarea value={form.about} onChange={e => setForm({ ...form, about: e.target.value })}
                placeholder="Расскажите о себе..."
                rows={5}
                className="w-full px-4 py-3 rounded-xl font-mono text-sm resize-none nx-input" />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>
                {(user as any).about || <span style={{ color: 'var(--color-text-tertiary)' }}>Информация не указана</span>}
              </p>
            )}
          </div>

          {/* Social links */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-mono text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Link2 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> ССЫЛКИ
            </h2>
            <div className="space-y-3">
              {SOCIAL_PLATFORMS.map(platform => (
                <div key={platform.key} className="flex items-center gap-3">
                  <span className="font-mono text-xs w-20 shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                    {platform.label}
                  </span>
                  {isEditing ? (
                    <input value={form.socialLinks[platform.key] || ''}
                      onChange={e => updateSocialLink(platform.key, e.target.value)}
                      placeholder={platform.placeholder}
                      className="flex-1 px-3 py-2 rounded-lg nx-input text-sm" />
                  ) : (
                    <div className="flex-1">
                      {(user as any).socialLinks?.[platform.key] ? (
                        <a href={(user as any).socialLinks[platform.key].startsWith('http') ? (user as any).socialLinks[platform.key] : `https://${(user as any).socialLinks[platform.key]}`}
                          target="_blank" rel="noopener noreferrer"
                          className="font-mono text-sm hover:underline transition-colors"
                          style={{ color: 'var(--color-primary)' }}>
                          {(user as any).socialLinks[platform.key]}
                        </a>
                      ) : (
                        <span className="font-mono text-sm" style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right column — Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Position */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-mono text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Briefcase className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> ДОЛЖНОСТЬ
            </h2>
            {isEditing ? (
              <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                placeholder="Ваша должность"
                className="w-full px-3 py-2 rounded-lg nx-input text-sm" />
            ) : (
              <p className="font-mono text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {(user as any).position || <span style={{ color: 'var(--color-text-tertiary)' }}>Не указана</span>}
              </p>
            )}
          </div>

          {/* Status */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-mono text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Globe className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> СТАТУС
            </h2>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setForm({ ...form, status: opt.value })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                      form.status === opt.value ? 'ring-1 ring-[var(--color-primary)]' : 'hover:bg-white/5'
                    }`}
                    style={form.status === opt.value
                      ? { backgroundColor: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)' }
                      : { color: 'var(--color-text-secondary)' }
                    }>
                    {opt.icon && <span>{opt.icon}</span>}
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {statusConfig?.icon && <span className="text-lg">{statusConfig.icon}</span>}
                <span className="font-mono text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {statusConfig?.label || 'Не указан'}
                </span>
              </div>
            )}
          </div>

          {/* Account info */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-mono text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <User className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> АККАУНТ
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Логин</span>
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-primary)' }}>@{user?.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Email</span>
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-primary)' }}>{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Роль</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                  {user?.role}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Создан</span>
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-primary)' }}>
                  {user?.createdAt ? formatDateKR(user.createdAt) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Push notifications */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-mono text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              {pushEnabled ? <Bell className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> : <BellOff className="w-4 h-4" style={{ color: '#6b7280' }} />}
              PUSH-УВЕДОМЛЕНИЯ
            </h2>
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono" style={{ color: '#5a5a70' }}>
                {pushEnabled ? 'Получать уведомления в фоне' : 'Уведомления отключены'}
              </p>
              <button
                onClick={handlePushToggle}
                disabled={pushLoading}
                className="relative w-12 h-6 rounded-full transition-all disabled:opacity-50"
                style={{
                  background: pushEnabled
                    ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
                    : 'rgba(255,255,255,0.1)',
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all"
                  style={{ left: pushEnabled ? '26px' : '2px' }}
                />
              </button>
            </div>
          </div>

          {/* Password change */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                <svg className="w-4 h-4" style={{ color: 'var(--color-primary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                ПАРОЛЬ
              </h2>
              {!showPasswordChange && (
                <button onClick={() => setShowPasswordChange(true)} className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--color-primary)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Изменить
                </button>
              )}
            </div>
            {showPasswordChange ? (
              <div className="space-y-3">
                <input type="password" value={passwords.new} onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))}
                  placeholder="Новый пароль" className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#e0e0e0' }} />
                <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="Повторите пароль" className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#e0e0e0' }}
                  onKeyDown={e => e.key === 'Enter' && handlePasswordChange()} />
                <div className="flex gap-2">
                  <button onClick={() => { setShowPasswordChange(false); setPasswords({ new: '', confirm: '' }); }}
                    className="flex-1 py-2 rounded-lg text-xs font-mono transition-colors hover:bg-white/5" style={{ color: '#8a8aa0', border: '1px solid rgba(255,255,255,0.06)' }}>
                    Отмена
                  </button>
                  <button onClick={handlePasswordChange} disabled={isSaving}
                    className="flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#000' }}>
                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs font-mono" style={{ color: '#5a5a70' }}>••••••••</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
