import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '../hooks/useDebounce';
import {
  UserPlus,
  Search,
  Edit,
  Trash,
  User,
  Users as UsersIcon,
  Camera,
  Loader2,
  X,
  Printer,
  Eye,
  EyeOff,
} from 'lucide-react';
import { User as UserType, UserRole } from '../types';
import { usersApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { getSocket } from '../services/socket';
import { printTable } from '../utils/printTable';
import { formatLastSeenKR, formatDateKR } from '../utils/timezone';

const ALL_ROLES: { value: UserRole; label: string; color: string }[] = [
  { value: 'super_admin', label: 'Super Admin', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'руководитель', label: 'Руководитель', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'редактор', label: 'Редактор', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'smm', label: 'SMM', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'документовед', label: 'Документовед', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'мол', label: 'МОЛ', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
];

function getRoleConfig(role: string) {
  return ALL_ROLES.find(r => r.value === role) || ALL_ROLES[0];
}

function parseRoles(user: UserType): string[] {
  // Try new 'roles' field first, fallback to legacy 'role'
  if ((user as any).roles && Array.isArray((user as any).roles)) return (user as any).roles;
  if (typeof (user as any).roles === 'string' && (user as any).roles) return (user as any).roles.split(',').map((r: string) => r.trim());
  return [user.role];
}

export default function Users() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [showPassword, setShowPassword] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    roles: ['редактор'] as string[],
  });

  useEffect(() => { fetchUsers(); }, []);

  // Listen for online users
  useEffect(() => {
    const socket = getSocket();
    const handleOnline = (ids: string[]) => setOnlineIds(new Set(ids));
    socket.on('users:online', handleOnline);
    return () => { socket.off('users:online', handleOnline); };
  }, []);

  const formatLastSeen = (lastSeen?: string) => formatLastSeenKR(lastSeen);

  const fetchUsers = async () => {
    try {
      const response = await usersApi.getAll();
      if (response.success && response.data) setUsers(response.data);
    } catch (error) { console.error('Failed to fetch users:', error); }
    finally { setIsLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, role: (formData.roles[0] || 'редактор') as UserRole, roles: formData.roles };
      if (editingUser) {
        await usersApi.update(editingUser.id, payload);
        showToast('Обновлено', 'success');
      } else {
        await usersApi.create(payload);
        showToast('Создано', 'success');
      }
      setShowModal(false);
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (error) { showToast('Ошибка', 'error'); }
  };

  const handleDelete = (user: UserType) => {
    showConfirm('УДАЛИТЬ?', `Пользователь "${user.fullName}" будет удалён.`, async () => {
      try { await usersApi.delete(user.id); showToast('Удалено', 'success'); fetchUsers(); }
      catch (e) { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  const handleEdit = (user: UserType) => {
    setEditingUser(user);
    const roles = parseRoles(user);
    setFormData({
      username: user.username,
      password: '',
      fullName: user.fullName,
      email: user.email,
      roles,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', fullName: '', email: '', roles: ['редактор'] });
  };

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role],
    }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingUser) return;
    setUploadingAvatar(true);
    try {
      const response = await usersApi.uploadAvatar(editingUser.id, file);
      if (response.success && response.data) {
        setEditingUser({ ...editingUser, avatar: response.data.avatar });
        fetchUsers();
      }
    } catch (error) { console.error('Failed to upload avatar:', error); }
    finally { setUploadingAvatar(false); }
  };

  const filteredUsers = users.filter(u => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="neon-text text-xl font-mono" style={{ color: 'var(--color-primary)' }}>Загрузка...</div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <UsersIcon className="w-7 h-7 md:w-8 md:h-8" /> ПОЛЬЗОВАТЕЛИ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// {users.length} УЧЁТНЫХ ЗАПИСЕЙ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditingUser(null); resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <UserPlus className="w-4 h-4" /> ДОБАВИТЬ
          </button>
          <button onClick={() => printTable('Пользователи', ['Имя', 'Логин', 'Email', 'Роли', 'Статус', 'Создан'],
            filteredUsers.map(u => [u.fullName, u.username, u.email, parseRoles(u).join(', '), onlineIds.has(u.id) ? 'Онлайн' : formatLastSeen((u as any).lastSeen), formatDateKR(u.createdAt)]))}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl font-mono text-sm hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#8a8aa0' }}>
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ПОИСК..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
      </div>

      {/* Users Table */}
      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left p-4 text-xs font-mono text-gray-500">ПОЛЬЗОВАТЕЛЬ</th>
              <th className="text-left p-4 text-xs font-mono text-gray-500">ЛОГИН</th>
              <th className="text-left p-4 text-xs font-mono text-gray-500">EMAIL</th>
              <th className="text-left p-4 text-xs font-mono text-gray-500">РОЛИ</th>
              <th className="text-left p-4 text-xs font-mono text-gray-500">СТАТУС</th>
              <th className="text-left p-4 text-xs font-mono text-gray-500">СОЗДАН</th>
              <th className="text-right p-4 text-xs font-mono text-gray-500">ДЕЙСТВИЯ</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => {
              const roles = parseRoles(user);
              return (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center glass-accent overflow-hidden flex-shrink-0">
                        {user.avatar ? (
                          <img loading="lazy" decoding="async" src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-primary)' }}>{user.fullName.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-200 font-medium">{user.fullName}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-400 font-mono">{user.username}</td>
                  <td className="p-4 text-sm text-gray-400">{user.email}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {roles.map(role => {
                        const cfg = getRoleConfig(role);
                        return (
                          <span key={role} className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="p-4">
                    {onlineIds.has(user.id) ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full online-pulse" style={{ background: '#00ff88', boxShadow: '0 0 6px rgba(0,255,136,0.5)' }} />
                        <span className="text-[11px] font-mono" style={{ color: '#00ff88' }}>Онлайн</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: '#4a4a60' }} />
                        <span className="text-[11px] font-mono" style={{ color: '#6a6a80' }}>{formatLastSeen((user as any).lastSeen)}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-400 font-mono">{formatDateKR(user.createdAt)}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleEdit(user)} className="p-1.5 rounded hover:bg-white/10"><Edit className="w-4 h-4 text-gray-400" /></button>
                      <button onClick={() => handleDelete(user)} className="p-1.5 rounded hover:bg-red-500/20"><Trash className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <User className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
            <p className="font-mono text-gray-500">// ПОЛЬЗОВАТЕЛЕЙ НЕТ</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'rgba(15,15,25,0.95)', backdropFilter: 'blur(20px)' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>
                  {editingUser ? 'РЕДАКТИРОВАТЬ' : 'НОВЫЙ ПОЛЬЗОВАТЕЛЬ'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              {/* Avatar */}
              {editingUser && (
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden" style={{ border: '2px solid var(--color-primary)' }}>
                      {editingUser.avatar ? (
                        <img loading="lazy" decoding="async" src={editingUser.avatar} alt={editingUser.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{editingUser.fullName.charAt(0)}</span>
                      )}
                    </div>
                    <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                      {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-mono mb-1.5 text-gray-500">ФИО</label>
                  <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Иван Иванов" required
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors placeholder:text-gray-600"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-mono mb-1.5 text-gray-500">ЛОГИН</label>
                  <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                    placeholder="operator_001" required disabled={!!editingUser}
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors disabled:opacity-50 placeholder:text-gray-600"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-mono mb-1.5 text-gray-500">EMAIL</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@company.ru" required
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors placeholder:text-gray-600"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-mono mb-1.5 text-gray-500">ПАРОЛЬ</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? 'Новый пароль (если нужно)' : 'Введите пароль'} required={!editingUser}
                      className="w-full px-4 py-2.5 pr-10 rounded-lg font-mono text-sm focus:outline-none transition-colors placeholder:text-gray-600"
                      style={{ backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-primary)' }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Multi-role selector */}
                <div>
                  <label className="block text-xs font-mono mb-2 text-gray-500">РОЛИ</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_ROLES.map(role => (
                      <button key={role.value} type="button" onClick={() => toggleRole(role.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-mono font-bold border transition-all ${
                          formData.roles.includes(role.value)
                            ? role.color
                            : 'border-gray-700 text-gray-500 hover:border-gray-500'
                        }`}>
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm transition-colors"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--color-text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    ОТМЕНИТЬ
                  </button>
                  <button type="submit"
                    className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                    {editingUser ? 'СОХРАНИТЬ' : 'ДОБАВИТЬ'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm}
        title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
}
