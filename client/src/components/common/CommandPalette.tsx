import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, LayoutDashboard, CheckSquare, Rocket, PartyPopper,
  Lightbulb, Users, Package, FolderOpen, BookOpen, FileText,
  Calendar, Image, Zap, ArrowRight, Plus, ClipboardList,
} from 'lucide-react';
import { searchApi } from '../../services/api';

const typeIcons: Record<string, typeof Search> = {
  user: Users, task: CheckSquare, project: Rocket, event: PartyPopper,
  idea: Lightbulb, partner: Users, inventory: Package, material: FolderOpen,
  knowledge: BookOpen, content: FileText,
};

const typeLabels: Record<string, string> = {
  user: 'Пользователь', task: 'Задача', project: 'Проект', event: 'Мероприятие',
  idea: 'Идея', partner: 'Партнёр', inventory: 'Оборудование', material: 'Материал',
  knowledge: 'Знание', content: 'Контент',
};

interface PaletteItem {
  label: string;
  icon: typeof Search;
  link: string;
  hint?: string;
  create?: boolean;
}

const quickActions: PaletteItem[] = [
  { label: 'Дашборд', icon: LayoutDashboard, link: '/' },
  { label: 'Задачи', icon: CheckSquare, link: '/kanban' },
  { label: 'Контент-план', icon: Calendar, link: '/content' },
  { label: 'Проекты', icon: Rocket, link: '/projects' },
  { label: 'Мероприятия', icon: PartyPopper, link: '/events' },
  { label: 'Материалы', icon: FolderOpen, link: '/materials' },
  { label: 'Генератор изображений', icon: Image, link: '/images' },
  { label: 'AI Чат', icon: Zap, link: '/ai-chat' },
  { label: 'Опросы', icon: ClipboardList, link: '/surveys' },
  { label: 'Создать пост', icon: Plus, link: '/content?new=1', hint: 'Ctrl+N', create: true },
  { label: 'Новый опрос', icon: Plus, link: '/surveys?new=1', create: true },
  { label: 'Новая задача', icon: Plus, link: '/kanban?new=1', create: true },
  { label: 'Новая идея', icon: Plus, link: '/ideas?new=1', create: true },
];

const RECENT_KEY = 'nexus_cmd_recent';

function loadRecent(): PaletteItem[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function pushRecent(item: PaletteItem) {
  try {
    const list = loadRecent().filter((x) => x.link !== item.link);
    list.unshift({ ...item });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch { /* noop */ }
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<PaletteItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K / Ctrl+Shift+K — browser often steals Ctrl+K (address/search bar)
      const isPalette =
        (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      if (isPalette) {
        // capture-phase + preventDefault + stopPropagation beats Chrome/Firefox bar
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(prev => !prev);
        return;
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    // capture: true — fire before browser default (Ctrl+K address bar)
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setRecent(loadRecent());
    }
  }, [isOpen]);

  // Search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await searchApi.search(query);
        if (res.success && res.data) {
          setResults(res.data);
          setSelectedIndex(0);
        }
      } catch {} finally { setLoading(false); }
    }, 150);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = useCallback((item: PaletteItem | { link: string; label?: string; icon?: any }) => {
    const link = item.link;
    pushRecent({
      label: (item as PaletteItem).label || link,
      icon: (item as PaletteItem).icon || ArrowRight,
      link,
      create: (item as PaletteItem).create,
    });
    navigate(link);
    setIsOpen(false);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = query.length >= 2 ? results : quickActions;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.length >= 2 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else if (query.length < 2 && quickActions[selectedIndex]) {
        handleSelect(quickActions[selectedIndex]);
      }
    }
  };

  const showQuickActions = query.length < 2;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Search className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Поиск по всему..."
                className="flex-1 bg-transparent text-sm outline-none font-mono"
                style={{ color: '#e0e0e0' }}
              />
              <kbd className="px-2 py-0.5 rounded text-[10px] font-mono" style={{ background: 'rgba(255,255,255,0.05)', color: '#5a5a70', border: '1px solid rgba(255,255,255,0.08)' }}>ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto py-2">
              {showQuickActions ? (
                <>
                  {recent.length > 0 && (
                    <>
                      <div className="px-5 py-1.5">
                        <span className="text-[10px] font-mono tracking-wider" style={{ color: '#5a5a70' }}>НЕДАВНИЕ</span>
                      </div>
                      {recent.map((action, i) => (
                        <button
                          key={'r-' + action.link}
                          onClick={() => handleSelect(action)}
                          className="w-full flex items-center gap-3 px-5 py-2 transition-colors text-left"
                          style={selectedIndex === i ? { background: 'rgba(0,255,136,0.08)' } : {}}
                          onMouseEnter={() => setSelectedIndex(i)}
                        >
                          <action.icon className="w-3.5 h-3.5" style={{ color: selectedIndex === i ? 'var(--color-primary)' : '#5a5a70' }} />
                          <span className="text-xs flex-1 truncate" style={{ color: selectedIndex === i ? '#e0e0e0' : '#8a8aa0' }}>{action.label}</span>
                        </button>
                      ))}
                    </>
                  )}
                  <div className="px-5 py-1.5">
                    <span className="text-[10px] font-mono tracking-wider" style={{ color: '#5a5a70' }}>БЫСТРЫЙ ДОСТУП</span>
                  </div>
                  {quickActions.map((action, i) => (
                    <button
                      key={action.link}
                      onClick={() => handleSelect(action)}
                      className="w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left"
                      style={selectedIndex === i ? { background: 'rgba(0,255,136,0.08)' } : {}}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <action.icon className="w-4 h-4" style={{ color: selectedIndex === i ? 'var(--color-primary)' : action.create ? '#00d4ff' : '#5a5a70' }} />
                      <span className="text-sm flex-1" style={{ color: selectedIndex === i ? '#e0e0e0' : action.create ? '#c0c0d0' : '#8a8aa0' }}>{action.label}</span>
                      {action.hint && (
                        <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.05)', color: '#5a5a70' }}>{action.hint}</kbd>
                      )}
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100" style={{ color: '#5a5a70' }} />
                    </button>
                  ))}
                </>
              ) : loading ? (
                <div className="px-5 py-8 text-center">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
              ) : results.length > 0 ? (
                <>
                  <div className="px-5 py-1.5">
                    <span className="text-[10px] font-mono tracking-wider" style={{ color: '#5a5a70' }}>РЕЗУЛЬТАТЫ ({results.length})</span>
                  </div>
                  {results.slice(0, 15).map((r, i) => {
                    const Icon = typeIcons[r.type] || Search;
                    return (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={() => handleSelect(r)}
                        className="w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left"
                        style={selectedIndex === i ? { background: 'rgba(0,255,136,0.08)' } : {}}
                        onMouseEnter={() => setSelectedIndex(i)}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: selectedIndex === i ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.03)' }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: selectedIndex === i ? 'var(--color-primary)' : '#5a5a70' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm truncate block" style={{ color: selectedIndex === i ? '#e0e0e0' : '#c0c0d0' }}>{r.title}</span>
                          <span className="text-[10px] font-mono" style={{ color: '#5a5a70' }}>{typeLabels[r.type]}{r.subtitle ? ` · ${r.subtitle}` : ''}</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              ) : (
                <div className="px-5 py-8 text-center">
                  <p className="text-xs font-mono" style={{ color: '#5a5a70' }}>Ничего не найдено</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-5 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.05)', color: '#5a5a70' }}>↑↓</kbd>
                <span className="text-[9px] font-mono" style={{ color: '#3a3a50' }}>навигация</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.05)', color: '#5a5a70' }}>Enter</kbd>
                <span className="text-[9px] font-mono" style={{ color: '#3a3a50' }}>выбрать</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.05)', color: '#5a5a70' }}>Ctrl+K</kbd>
                <span className="text-[9px] font-mono" style={{ color: '#3a3a50' }}>открыть</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
