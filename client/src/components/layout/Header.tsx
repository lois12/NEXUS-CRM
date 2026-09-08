import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeName } from '../../types';
import { Search, Palette, Check, Menu, X, User, CheckSquare, Rocket, PartyPopper, Lightbulb, Users, Package, FolderOpen, BookOpen, FileText } from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import OnlineUsers from '../common/OnlineUsers';
import { searchApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const themeColors: Record<ThemeName, string> = {
  'cyber-green': '#00ff88',
  'cyber-pink': '#ff00ff',
  'cyber-blue': '#00d4ff',
  'cyber-purple': '#bf00ff',
  'cyber-orange': '#ff6600',
};

const typeIcons: Record<string, typeof User> = {
  user: User,
  task: CheckSquare,
  project: Rocket,
  event: PartyPopper,
  idea: Lightbulb,
  partner: Users,
  inventory: Package,
  material: FolderOpen,
  knowledge: BookOpen,
  content: FileText,
};

const typeLabels: Record<string, string> = {
  user: 'Пользователь',
  task: 'Задача',
  project: 'Проект',
  event: 'Мероприятие',
  idea: 'Идея',
  partner: 'Партнёр',
  inventory: 'Оборудование',
  material: 'Материал',
  knowledge: 'Знание',
  content: 'Контент',
};

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { user } = useAuth();
  const { themeName, setTheme, themes } = useTheme();
  const navigate = useNavigate();
  const [showThemes, setShowThemes] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; subtitle: string; type: string; link: string; avatar?: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowThemes(false);
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const res = await searchApi.search(searchQuery);
        if (res.success && res.data) setSearchResults(res.data);
      } catch {}
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  return (
    <header className="h-14 md:h-16 glass-frost flex items-center justify-between px-3 md:px-6 border-b border-white/5 relative z-40">
      {/* Left: hamburger + search */}
      <div className="flex items-center gap-2 flex-1">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors md:hidden"
        >
          <Menu className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex-1 max-w-md hidden sm:block relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
              placeholder="Поиск..."
              className="w-full pl-10 pr-8 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 focus:border-white/20 transition-colors placeholder:text-gray-600"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setShowSearch(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />
              </button>
            )}
          </div>
          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 glass-frost rounded-xl overflow-hidden shadow-2xl max-h-80 overflow-y-auto" style={{ border: '1px solid rgba(255,255,255,0.1)', zIndex: 9999 }}>
              {searchResults.slice(0, 15).map(r => {
                const Icon = typeIcons[r.type] || Search;
                return (
                  <button key={`${r.type}-${r.id}`} onClick={() => { navigate(r.link); setShowSearch(false); setSearchQuery(''); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                      {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover rounded-lg" />
                      : <Icon className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-200 truncate block">{r.title}</span>
                      <span className="text-[9px] font-mono text-gray-500">{typeLabels[r.type]}{r.subtitle ? ` · ${r.subtitle}` : ''}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {showSearch && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 glass-frost rounded-xl p-4 text-center shadow-2xl" style={{ border: '1px solid rgba(255,255,255,0.1)', zIndex: 9999 }}>
              <span className="text-xs font-mono text-gray-500">Не найдено</span>
            </div>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Theme Switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowThemes(!showThemes)}
            className="relative p-2 md:p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
            title="Сменить тему"
          >
            <Palette className="w-5 h-5 text-gray-400 group-hover:text-gray-200 transition-colors" />
            <div
              className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ring-2 ring-gray-800"
              style={{ backgroundColor: themeColors[themeName] }}
            />
          </button>

          {showThemes && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-12 w-56 md:w-64 glass-frost rounded-2xl p-3 shadow-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.1)', zIndex: 9999 }}
            >
              <div className="text-xs font-mono mb-2 px-2" style={{ color: 'var(--color-primary)' }}>
                // ВЫБОР ТЕМЫ
              </div>
              <div className="space-y-1">
                {(Object.keys(themes) as ThemeName[]).map((themeKey) => (
                  <button
                    key={themeKey}
                    onClick={() => {
                      setTheme(themeKey);
                      setShowThemes(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      themeName === themeKey ? 'glass-accent' : 'hover:bg-white/5'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 md:w-8 md:h-8 rounded-lg transition-all ${
                        themeName === themeKey ? 'ring-2 ring-white/50 scale-110' : ''
                      }`}
                      style={{
                        backgroundColor: themeColors[themeKey],
                        boxShadow: themeName === themeKey ? `0 0 12px ${themeColors[themeKey]}` : 'none'
                      }}
                    />
                    <div className="text-left flex-1">
                      <div className="text-sm font-bold font-mono text-gray-200">{themes[themeKey].label}</div>
                      <div className="text-xs text-gray-500">{themes[themeKey].description}</div>
                    </div>
                    {themeName === themeKey && (
                      <Check className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <NotificationBell />
        <OnlineUsers />

        <div className="h-8 w-px bg-white/10 mx-1 hidden md:block"></div>

        <a href="/profile" className="flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-xl hover:bg-white/5 transition-colors">
          <div className="relative">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center overflow-hidden"
              style={{ border: '2px solid var(--color-primary)', boxShadow: '0 0 12px var(--color-glow)' }}>
              {user?.avatar ? (
                <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
                  {user?.fullName?.charAt(0) || 'U'}
                </span>
              )}
            </div>
            {/* Status dot */}
            {(user as any)?.status && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                style={{
                  borderColor: 'var(--color-bg)',
                  backgroundColor: (user as any).status === 'online' ? '#00ff88' :
                    (user as any).status === 'busy' ? '#ff3b30' :
                    (user as any).status === 'away' ? '#eab308' :
                    (user as any).status === 'dnd' ? '#ff3b30' : '#6b7280'
                }} />
            )}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-200 leading-tight">{user?.fullName}</p>
            <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>@{user?.username}</p>
          </div>
        </a>
      </div>
    </header>
  );
}
