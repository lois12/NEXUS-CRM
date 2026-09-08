import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Link2, Maximize2, Search, X } from 'lucide-react';
import { Idea, IdeaType, IDEA_TYPE_CONFIG } from '../../types';

interface IdeaToolbarProps {
  onAdd: () => void;
  linkMode: boolean;
  onToggleLinkMode: () => void;
  onZoomAll: () => void;
  filterTypes: string[];
  onToggleFilter: (type: IdeaType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  allIdeas: Idea[];
  onSearchSelect: (id: string) => void;
}

export default function IdeaToolbar({
  onAdd,
  linkMode,
  onToggleLinkMode,
  onZoomAll,
  filterTypes,
  onToggleFilter,
  searchQuery,
  onSearchChange,
  allIdeas,
  onSearchSelect,
}: IdeaToolbarProps) {
  const [showResults, setShowResults] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Filter search results
  const searchResults = searchQuery.trim().length > 0
    ? allIdeas
        .filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  // Show/hide results dropdown
  useEffect(() => {
    setShowResults(searchResults.length > 0 && searchQuery.trim().length > 0);
    setFocusedIndex(-1);
  }, [searchQuery, searchResults.length]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      const idea = searchResults[focusedIndex];
      if (idea) {
        onSearchSelect(idea.id);
        setShowResults(false);
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  };

  const handleSelect = (id: string) => {
    onSearchSelect(id);
    setShowResults(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Add */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onAdd}
        className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs transition-all neon-glow-pulse"
        style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">ИДЕЯ</span>
      </motion.button>

      {/* Link mode */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggleLinkMode}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs transition-all ${
          linkMode ? 'text-white' : 'glass text-gray-400 hover:text-gray-200'
        }`}
        style={linkMode ? { backgroundColor: 'var(--color-primary)', color: '#000' } : {}}
      >
        <Link2 className="w-4 h-4" />
        <span className="hidden sm:inline">{linkMode ? 'СВЯЗАТЬ...' : 'СВЯЗЬ'}</span>
      </motion.button>

      {/* Zoom all */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onZoomAll}
        className="flex items-center gap-2 px-3 py-2 rounded-xl glass font-mono text-xs text-gray-400 hover:text-gray-200 transition-all"
      >
        <Maximize2 className="w-4 h-4" />
        <span className="hidden sm:inline">ВСЕ ИДЕИ</span>
      </motion.button>

      {/* Search with dropdown */}
      <div className="relative flex-1 min-w-[180px] max-w-[280px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 z-10" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
          onKeyDown={handleKeyDown}
          placeholder="// ПОИСК ИДЕЙ..."
          className="w-full pl-8 pr-7 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-gray-200 focus:border-[var(--color-border)] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => { onSearchChange(''); setShowResults(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 z-10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Search results dropdown */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              ref={resultsRef}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute top-full left-0 right-0 mt-2 glass-frost rounded-xl overflow-hidden shadow-2xl z-50"
              style={{ border: '1px solid var(--color-border)' }}
            >
              {searchResults.map((idea, idx) => {
                const config = IDEA_TYPE_CONFIG[idea.type];
                return (
                  <button
                    key={idea.id}
                    onClick={() => handleSelect(idea.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      focusedIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: idea.color, boxShadow: `0 0 6px ${idea.color}60` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-200 truncate">{idea.title}</div>
                      <div className="text-[10px] font-mono" style={{ color: config?.color || '#6b7280' }}>
                        {config?.label || 'Без типа'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Type filters */}
      <div className="flex gap-1 flex-wrap">
        {(Object.entries(IDEA_TYPE_CONFIG) as [IdeaType, { label: string; color: string }][]).map(([type, config]) => (
          <button
            key={type}
            onClick={() => onToggleFilter(type)}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-mono transition-all ${
              filterTypes.includes(type) || filterTypes.length === 0
                ? 'opacity-100'
                : 'opacity-30'
            }`}
            style={{
              backgroundColor: filterTypes.includes(type) || filterTypes.length === 0
                ? `${config.color}20`
                : 'transparent',
              color: config.color,
              border: `1px solid ${config.color}30`,
            }}
          >
            {config.label}
          </button>
        ))}
      </div>
    </div>
  );
}
