import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  LogOut,
  X,
  Package,
  ChevronRight,
  ArrowLeft,
  Briefcase,
  Wrench,
  Shield,
  UserCircle,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  CloudSun,
  BookOpen,
} from 'lucide-react';

interface NavChild {
  to: string;
  label: string;
  roles: string[];
}

interface NavGroup {
  id: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles: string[];
  children: NavChild[];
}

// Role lists for nav — new 4 roles + legacy aliases kept working via hasRole expansion
const ALL = ['super_admin', 'руководитель', 'информационный', 'туризм', 'редактор', 'smm', 'документовед', 'мол'];
const WRITE = ['super_admin', 'руководитель', 'информационный', 'туризм', 'редактор', 'smm', 'документовед'];
const BOSS_ONLY = ['super_admin', 'руководитель'];
const SUPER_ONLY = ['super_admin'];

const navGroups: NavGroup[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    label: 'Дашборд',
    roles: ALL,
    children: [{ to: '/', label: 'Обзор', roles: ALL }],
  },
  {
    id: 'profile',
    icon: UserCircle,
    label: 'Личный кабинет',
    roles: ALL,
    children: [
      { to: '/kanban', label: 'Мои задачи', roles: ALL },
      { to: '/profile', label: 'Профиль', roles: ALL },
    ],
  },
  {
    id: 'info',
    icon: Briefcase,
    label: 'Контент и медиа',
    roles: ALL,
    children: [
      { to: '/content', label: 'Контент-план', roles: ALL },
      { to: '/analytics', label: 'Аналитика', roles: ALL },
      { to: '/brandbank', label: 'Банк промо', roles: ALL },
      { to: '/partners', label: 'Партнёры', roles: WRITE },
    ],
  },
  {
    id: 'tourism',
    icon: Globe,
    label: 'Мероприятия и проекты',
    roles: ALL,
    children: [
      { to: '/events', label: 'Мероприятия', roles: ALL },
      { to: '/projects', label: 'Проекты', roles: ALL },
    ],
  },
  {
    id: 'tools',
    icon: Wrench,
    label: 'Инструменты',
    roles: ALL,
    children: [
      { to: '/qr', label: 'QR-генератор', roles: ALL },
      { to: '/image-converter', label: 'Конвертер изображений', roles: ALL },
      { to: '/doc-converter', label: 'Конвертер документов', roles: ALL },
      { to: '/photo-collage', label: 'Коллаж из фото', roles: ALL },
      { to: '/short-links', label: 'Сокращатель ссылок', roles: ALL },
      { to: '/bg-remover', label: 'Удаление фона', roles: ALL },
      { to: '/random', label: 'Рандомайзер', roles: ALL },
      { to: '/ping', label: 'IP Ping', roles: ALL },
    ],
  },
  {
    id: 'ai-creative',
    icon: Sparkles,
    label: 'AI и Креатив',
    roles: ALL,
    children: [
      { to: '/ai-chat', label: 'AI Чат', roles: ALL },
      { to: '/images', label: 'Генератор изображений', roles: WRITE },
      { to: '/aurora', label: 'Северное сияние', roles: ALL },
    ],
  },
  {
    id: 'workspace',
    icon: BookOpen,
    label: 'Рабочее пространство',
    roles: ALL,
    children: [
      { to: '/knowledge', label: 'База знаний', roles: ALL },
      { to: '/ideas', label: 'Идеи', roles: ALL },
      { to: '/registrations', label: 'Регистрация', roles: ALL },
      { to: '/widgets', label: 'Виджеты', roles: ALL },
      { to: '/lists', label: 'Списки', roles: ALL },
      { to: '/surveys', label: 'Опросы', roles: ALL },
      { to: '/materials', label: 'Материалы (файлы)', roles: ALL },
    ],
  },
  {
    id: 'weather',
    icon: CloudSun,
    label: 'Погода',
    roles: ALL,
    children: [{ to: '/weather', label: 'Погода', roles: ALL }],
  },
  {
    id: 'mol',
    icon: Package,
    label: 'Оборудование',
    roles: ALL,
    children: [
      { to: '/inventory', label: 'Список', roles: ALL },
    ],
  },
  {
    id: 'admin',
    icon: Shield,
    label: 'Администратор',
    roles: BOSS_ONLY,
    children: [
      { to: '/users', label: 'Пользователи', roles: BOSS_ONLY },
      { to: '/admin/monitoring', label: 'Управление NEXUS', roles: SUPER_ONLY },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout, hasRole } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nexus_sidebar_collapsed') === 'true');
  const [activeGroup, setActiveGroup] = useState<string | null>(() => {
    // Find multi-child group containing current path
    const found = navGroups.find(g => {
      const accessible = g.children.filter(c => hasRole(c.roles));
      return accessible.length > 1 && g.children.some(c => c.to === '/' ? location.pathname === '/' : location.pathname.startsWith(c.to));
    });
    return found ? found.id : null;
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('nexus_sidebar_collapsed', String(next));
      if (next) setActiveGroup(null);
      return next;
    });
  };

  const filteredGroups = navGroups
    .filter(g => hasRole(g.roles));

  const currentGroup = activeGroup ? navGroups.find(g => g.id === activeGroup) : null;
  const filteredChildren = currentGroup?.children.filter(c => hasRole(c.roles)) || [];

  // If single-child group, go directly to that page
  const handleGroupClick = (group: NavGroup) => {
    const accessible = group.children.filter(c => hasRole(c.roles));
    if (accessible.length === 1) {
      // Direct navigation
      window.location.hash = '';
      onClose();
      return;
    }
    setActiveGroup(group.id);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={`
          fixed md:static inset-y-0 left-0 z-50
          ${collapsed ? 'w-[68px]' : 'w-64'} glass-frost flex flex-col
          transform transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ borderRight: '1px solid rgba(0,255,136,0.06)', background: 'linear-gradient(180deg, rgba(15,15,25,0.85) 0%, rgba(10,10,18,0.95) 100%)' }}
      >
        {/* Logo */}
        <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>NEXUS</h1>
              <p className="text-xs text-gray-500 font-mono">CRM // v2.12</p>
            </div>
          )}
          {collapsed && (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-lg font-bold font-mono" style={{ color: 'var(--color-primary)' }}>N</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={toggleCollapsed} className="p-2 rounded-xl hover:bg-white/5 transition-colors hidden md:flex" aria-label={collapsed ? 'Развернуть боковое меню' : 'Свернуть боковое меню'} title={collapsed ? 'Развернуть' : 'Свернуть'}>
              {collapsed ? <PanelLeftOpen className="w-4 h-4 text-gray-400" /> : <PanelLeftClose className="w-4 h-4 text-gray-400" />}
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors md:hidden" aria-label="Закрыть меню">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-3 md:p-4'} overflow-y-auto`}>
          {collapsed ? (
            // COLLAPSED MENU — icons only
            <div className="space-y-1">
              {filteredGroups.map(group => {
                const accessible = group.children.filter(c => hasRole(c.roles));
                const isSingle = accessible.length === 1;
                const target = accessible[0];
                const isGroupActive = group.children.some(c => c.to === '/' ? location.pathname === '/' : location.pathname.startsWith(c.to));

                if (isSingle) {
                  return (
                    <NavLink key={group.id} to={target.to} end={target.to === '/'} onClick={onClose}
                      className="flex items-center justify-center w-full h-10 rounded-xl transition-all duration-200"
                      style={isGroupActive ? { background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' } : { color: '#6b7280' }}
                      aria-label={group.label}
                      title={group.label}>
                      <group.icon className="w-5 h-5" />
                    </NavLink>
                  );
                }

                // Multi-child: expand sidebar and show sub-menu
                return (
                  <button key={group.id}
                    onClick={() => { setCollapsed(false); localStorage.setItem('nexus_sidebar_collapsed', 'false'); setActiveGroup(group.id); }}
                    className="flex items-center justify-center w-full h-10 rounded-xl transition-all duration-200"
                    style={isGroupActive ? { background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' } : { color: '#6b7280' }}
                    aria-label={group.label}
                    title={group.label}>
                    <group.icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          ) : (
          <AnimatePresence mode="wait" initial={false}>
            {!activeGroup ? (
              // MAIN MENU
              <motion.div
                key="main-menu"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="space-y-1"
              >
                {filteredGroups.map(group => {
                  const isSingle = group.children.filter(c => hasRole(c.roles)).length === 1;
                  const isGroupActive = group.children.some(c => c.to === '/' ? location.pathname === '/' : location.pathname.startsWith(c.to));

                  if (isSingle) {
                    const child = group.children.filter(c => hasRole(c.roles))[0];
                    return (
                      <NavLink key={group.id} to={child.to} end={child.to === '/'} onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                            isActive ? 'glass-accent nav-link-active' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                          }`
                        }
                        style={({ isActive }) => isActive ? { color: 'var(--color-primary)', boxShadow: 'inset -2px 0 12px -4px rgba(0,255,136,0.15)' } : {}}>
                        <group.icon className="w-5 h-5 flex-shrink-0" />
                        <span className={`text-sm flex-1 ${true ? 'font-medium' : ''}`}>{group.label}</span>
                      </NavLink>
                    );
                  }

                  return (
                    <button key={group.id} onClick={() => handleGroupClick(group)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isGroupActive ? 'text-gray-200 bg-white/5' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }`}>
                      <group.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium flex-1 text-left">{group.label}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  );
                })}
              </motion.div>
            ) : (
              // SUB MENU
              <motion.div
                key={`sub-${activeGroup}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="space-y-1"
              >
                <button onClick={() => setActiveGroup(null)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all mb-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-mono">НАЗАД</span>
                </button>
                <div className="px-4 py-2 mb-1">
                  <span className="text-xs font-mono text-gray-500 uppercase">{currentGroup?.label}</span>
                </div>
                {filteredChildren.map((child, i) => (
                  <motion.div
                    key={child.to}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.12, delay: i * 0.03 }}
                  >
                    <NavLink to={child.to} end={child.to === '/'} onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                          isActive ? 'glass-accent nav-link-active' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        }`
                      }
                      style={({ isActive }) => isActive ? { color: 'var(--color-primary)', boxShadow: 'inset -2px 0 12px -4px rgba(0,255,136,0.15)' } : {}}>
                      <span className="text-sm font-medium">{child.label}</span>
                    </NavLink>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </nav>

        {/* User Info */}
        <div className={`${collapsed ? 'p-2' : 'p-3 md:p-4'} border-t border-white/5`}>
          <button onClick={logout}
            className={`${collapsed ? 'flex items-center justify-center w-full h-10' : 'w-full flex items-center gap-3 px-4 py-2.5'} rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors`}
            title="Выйти">
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="text-sm font-mono">ВЫЙТИ</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
