import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, LayoutDashboard, CheckSquare, Rocket, PartyPopper,
  Lightbulb, Users, Package, FolderOpen, BookOpen, FileText,
  Calendar, Image, Zap, ArrowRight, Plus, ClipboardList,
} from 'lucide-react';
import { searchApi } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

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
      // Multiple combos — browsers steal Ctrl+K (address bar)
      const key = e.key?.toLowerCase();
      const wantsPalette =
        ((e.ctrlKey || e.metaKey) && (key === 'k')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'p' || key === 'k')) ||
        (e.altKey && key === 'k') ||
        ((e.ctrlKey || e.metaKey) && key === 'p' && e.shiftKey);
      if (wantsPalette) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(prev => !prev);
        return;
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const openFromUi = () => setIsOpen(true);
    window.addEventListener('nexus-open-palette', openFromUi as EventListener);

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('nexus-open-palette', openFromUi as EventListener);
    };
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
  const { themeName } = useTheme();
  const isLight = themeName === 'office-light';

  const c = {
    overlay: isLight ? 'rgba(15,23,32,0.35)' : 'rgba(0,0,0,0.6)',
    panel: isLight
      ? 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(244,246,248,0.99))'
      : 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))',
    panelBorder: isLight ? 'rgba(15,118,110,0.15)' : 'rgba(255,255,255,0.08)',
    panelShadow: isLight
      ? '0 24px 64px rgba(15,23,32,0.18)'
      : '0 24px 64px rgba(0,0,0,0.6)',
    divider: isLight ? 'rgba(15,118,110,0.12)' : 'rgba(255,255,255,0.06)',
    text: isLight ? '#1a2332' : '#e0e0e0',
    textSoft: isLight ? '#4a5568' : '#c0c0d0',
    textMuted: isLight ? '#718096' : '#8a8aa0',
    textFaint: isLight ? '#94a3b8' : '#5a5a70',
    hoverBg: isLight ? 'rgba(15,118,110,0.10)' : 'rgba(0,255,136,0.08)',
    chipBg: isLight ? 'rgba(15,118,110,0.08)' : 'rgba(255,255,255,0.05)',
    chipBorder: isLight ? 'rgba(15,118,110,0.12)' : 'rgba(255,255,255,0.08)',
    accent: isLight ? '#0d9488' : '#00d4ff',
    iconBg: isLight ? 'rgba(15,118,110,0.12)' : 'rgba(255,255,255,0.03)',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
          style={{ background: c.overlay, backdropFilter: 'blur(4px)' }}
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: c.panel, border: `1px solid ${c.panelBorder}`, boxShadow: c.panelShadow }}
            onClick={e => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${c.divider}` }}>
              <Search className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Поиск по всему..."
                className="flex-1 bg-transparent text-sm outline-none font-mono"
                style={{ color: c.text }}
              />
              <kbd className="px-2 py-0.5 rounded text-[10px] font-mono" style={{ background: c.chipBg, color: c.textFaint, border: `1px solid ${c.chipBorder}` }}>ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto py-2">
              {showQuickActions ? (
                <>
                  {recent.length > 0 && (
                    <>
                      <div className="px-5 py-1.5">
                        <span className="text-[10px] font-mono tracking-wider" style={{ color: c.textFaint }}>НЕДАВНИЕ</span>
                      </div>
                      {recent.map((action, i) => (
                        <button
                          key={'r-' + action.link}
                          onClick={() => handleSelect(action)}
                          className="w-full flex items-center gap-3 px-5 py-2 transition-colors text-left"
                          style={selectedIndex === i ? { background: c.hoverBg } : {}}
                          onMouseEnter={() => setSelectedIndex(i)}
                        >
                          <action.icon className="w-3.5 h-3.5" style={{ color: selectedIndex === i ? 'var(--color-primary)' : c.textFaint }} />
                          <span className="text-xs flex-1 truncate" style={{ color: selectedIndex === i ? c.text : c.textMuted }}>{action.label}</span>
                        </button>
                      ))}
                    </>
                  )}
                  <div className="px-5 py-1.5">
                    <span className="text-[10px] font-mono tracking-wider" style={{ color: c.textFaint }}>БЫСТРЫЙ ДОСТУП</span>
                  </div>
                  {quickActions.map((action, i) => (
                    <button
                      key={action.link}
                      onClick={() => handleSelect(action)}
                      className="w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left"
                      style={selectedIndex === i ? { background: c.hoverBg } : {}}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <action.icon className="w-4 h-4" style={{ color: selectedIndex === i ? 'var(--color-primary)' : action.create ? c.accent : c.textFaint }} />
                      <span className="text-sm flex-1" style={{ color: selectedIndex === i ? c.text : action.create ? c.textSoft : c.textMuted }}>{action.label}</span>
                      {action.hint && (
                        <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: c.chipBg, color: c.textFaint }}>{action.hint}</kbd>
                      )}
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100" style={{ color: c.textFaint }} />
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
                    <span className="text-[10px] font-mono tracking-wider" style={{ color: c.textFaint }}>РЕЗУЛЬТАТЫ ({results.length})</span>
                  </div>
                  {results.slice(0, 15).map((r, i) => {
                    const Icon = typeIcons[r.type] || Search;
                    return (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={() => handleSelect(r)}
                        className="w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left"
                        style={selectedIndex === i ? { background: c.hoverBg } : {}}
                        onMouseEnter={() => setSelectedIndex(i)}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: selectedIndex === i ? c.hoverBg : c.iconBg }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: selectedIndex === i ? 'var(--color-primary)' : c.textFaint }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm truncate block" style={{ color: selectedIndex === i ? c.text : c.textSoft }}>{r.title}</span>
                          <span className="text-[10px] font-mono" style={{ color: c.textFaint }}>{typeLabels[r.type]}{r.subtitle ? ` · ${r.subtitle}` : ''}</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              ) : (
                <div className="px-5 py-8 text-center">
                  <p className="text-xs font-mono" style={{ color: c.textFaint }}>Ничего не найдено</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-5 py-2.5" style={{ borderTop: `1px solid ${c.divider}` }}>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: c.chipBg, color: c.textFaint }}>↑↓</kbd>
                <span className="text-[9px] font-mono" style={{ color: c.textFaint }}>навигация</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: c.chipBg, color: c.textFaint }}>Enter</kbd>
                <span className="text-[9px] font-mono" style={{ color: c.textFaint }}>выбрать</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: c.chipBg, color: c.textFaint }}>Ctrl+K</kbd>
                <span className="text-[9px] font-mono" style={{ color: c.textFaint }}>открыть</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
