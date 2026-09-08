import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Calendar,
  Edit,
  Trash,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Clock,
  Zap,
  Globe,
  FileText,
  Timer,
  CheckCircle2,
  MoreVertical,
  Trash2,
  Copy,
  AlertTriangle,
  Shield,
  Send,
} from 'lucide-react';
import { ContentPost, SocialPlatform, ContentStatus, ContentApproval } from '../types';
import { contentApi } from '../services/api';
import { ConfirmModal, useNexusConfirm, NexusSpinner, showToast } from '../components/ui/NexusModal';
import ImageUpload from '../components/ui/ImageUpload';
import RichEditor from '../components/ui/RichEditor';
import ApprovalPipeline from '../components/content/ApprovalPipeline';
import ApprovalActions from '../components/content/ApprovalActions';
import ApprovalStatus from '../components/content/ApprovalStatus';
import PostComments from '../components/content/PostComments';
import { formatDateKR, formatTimeKR } from '../utils/timezone';
import FullCalendarView from '../components/content/FullCalendarView';
import { LayoutGrid, CalendarDays } from 'lucide-react';

// SVG icons for platforms
const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
  </svg>
);

const VkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.597-.189 1.362 1.26 2.174 1.817.613.42 1.079.328 1.079.328l2.172-.03s1.136-.07.598-.964c-.044-.073-.314-.659-1.618-1.866-1.365-1.266-1.182-1.06.462-3.246.999-1.328 1.398-2.143 1.272-2.492-.121-.336-.866-.248-.866-.248l-2.446.015s-.182-.025-.316.056c-.131.079-.216.263-.216.263s-.388 1.032-.905 1.91c-1.092 1.853-1.528 1.954-1.704 1.838-.415-.272-.312-1.093-.312-1.672 0-1.822.276-2.58-.538-2.775-.27-.065-.469-.108-1.157-.114-.884-.008-1.633.003-2.058.21-.284.139-.502.448-.368.467.162.024.531.1.728.364.254.342.245 1.112.245 1.112s.147 2.12-.341 2.388c-.334.184-.793-.19-1.782-1.905-.504-.876-.886-1.845-.886-1.845s-.073-.18-.204-.277c-.159-.117-.38-.154-.38-.154l-2.327.015s-.35.01-.479.162c-.115.135-.01.413-.01.413s1.82 4.257 3.877 6.405c1.888 1.966 4.033 1.84 4.033 1.84h.976z"/>
  </svg>
);

const MaxIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M3 5h4l3 7.5L13 5h4v14h-3.5V10.5L10 19H8.5L5 10.5V19H3V5z"/>
    <path d="M17 5h4l2 6 2-6h4v14h-3.5v-8L23 19h-2l-2.5-8v8H17V5z"/>
  </svg>
);

const platformConfig: Record<SocialPlatform, { icon: React.ReactNode; label: string; shortLabel: string; color: string; gradient: string }> = {
  telegram: { 
    icon: <TelegramIcon />, label: 'Telegram', shortLabel: 'ТГ', color: '#0088cc', 
    gradient: 'linear-gradient(135deg, #0088cc, #00aaff)' 
  },
  vk: { 
    icon: <VkIcon />, label: 'VK', shortLabel: 'VK', color: '#0077ff', 
    gradient: 'linear-gradient(135deg, #0077ff, #4499ff)' 
  },
  site: { 
    icon: <Globe className="w-4 h-4" />, label: 'Web', shortLabel: 'Web', color: '#00ff88', 
    gradient: 'linear-gradient(135deg, #00ff88, #00cc6a)' 
  },
  max: { 
    icon: <MaxIcon />, label: 'MAX', shortLabel: 'MAX', color: '#ff6600', 
    gradient: 'linear-gradient(135deg, #ff6600, #ff8833)' 
  },
};

const statusConfig: Record<ContentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  черновик: { label: 'Черновик', color: '#6b7280', icon: <FileText className="w-3 h-3" /> },
  запланирован: { label: 'На согласовании', color: '#eab308', icon: <Timer className="w-3 h-3" /> },
  на_доработку: { label: 'Доработка', color: '#ff3b30', icon: <AlertTriangle className="w-3 h-3" /> },
  согласован: { label: 'Согласован', color: '#00d4ff', icon: <CheckCircle2 className="w-3 h-3" /> },
  утверждён: { label: 'Утверждён', color: '#bf00ff', icon: <Shield className="w-3 h-3" /> },
  опубликован: { label: 'Опубликован', color: '#22c55e', icon: <Send className="w-3 h-3" /> },
};

const DAYS_OF_WEEK = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const MONTHS = [
  'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
  'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'
];

interface ContextMenu {
  x: number;
  y: number;
  date: Date;
  posts: ContentPost[];
}

export default function ContentPlan() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<SocialPlatform | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [editingPost, setEditingPost] = useState<ContentPost | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [postImages, setPostImages] = useState<string[]>([]);
  const [postImageFiles, setPostImageFiles] = useState<File[]>([]);
  const [approvals, setApprovals] = useState<ContentApproval[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<'grid' | 'full'>(() =>
    (localStorage.getItem('nexus_contentplan_view') as 'grid' | 'full') || 'grid'
  );
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    platforms: ['telegram'] as SocialPlatform[],
    status: 'черновик' as ContentStatus,
    scheduledDate: '',
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    localStorage.setItem('nexus_contentplan_view', calendarView);
  }, [calendarView]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await contentApi.getAll();
      if (response.success && response.data) {
        setPosts(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingPost) {
        // Update existing post with first selected platform
        const data = { ...formData, platform: formData.platforms[0] || 'telegram' };
        await contentApi.update(editingPost.id, data);
        if (postImageFiles.length > 0) {
          for (const file of postImageFiles) {
            await contentApi.uploadImage(editingPost.id, file);
          }
        }
      } else {
        // Create one post per selected platform
        for (const platform of formData.platforms) {
          const data = { ...formData, platform };
          const res = await contentApi.create(data);
          if (res.success && res.data && postImageFiles.length > 0) {
            for (const file of postImageFiles) {
              await contentApi.uploadImage(res.data.id, file);
            }
          }
        }
      }

      setShowModal(false);
      setEditingPost(null);
      setPostImages([]);
      setPostImageFiles([]);
      resetForm();
      fetchPosts();
    } catch (error) {
      console.error('Failed to save post:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    showConfirm(
      'УДАЛИТЬ ПОСТ?',
      'Это действие нельзя отменить.',
      async () => {
        try {
          await contentApi.delete(id);
          fetchPosts();
        } catch (error) {
          console.error('Failed to delete post:', error);
        }
      },
      'danger'
    );
  };

  const handleDeleteAllForDay = (date: Date) => {
    const dayPosts = getPostsForDate(date);
    if (dayPosts.length === 0) return;
    
    showConfirm(
      'УДАЛИТЬ ВСЕ ПОСТЫ?',
      `${dayPosts.length} постов за ${formatDateKR(date)} будут удалены безвозвратно.`,
      async () => {
        try {
          await Promise.all(dayPosts.map(post => contentApi.delete(post.id)));
          fetchPosts();
          setShowDayModal(false);
          setContextMenu(null);
        } catch (error) {
          console.error('Failed to delete posts:', error);
        }
      },
      'danger'
    );
  };

  const handleEdit = (post: ContentPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      content: post.content,
      platforms: [post.platform],
      status: post.status,
      scheduledDate: post.scheduledDate || '',
    });
    setPostImages(post.imageUrl ? [post.imageUrl] : (post.images || []));
    setApprovals([]);
    // Fetch approvals for this post
    contentApi.getApprovals(post.id).then(res => {
      if (res.success && res.data) setApprovals(res.data);
    }).catch(() => {});
    setShowModal(true);
    setShowDayModal(false);
    setContextMenu(null);
  };

  const handleDuplicate = (post: ContentPost) => {
    setEditingPost(null);
    setFormData({
      title: `${post.title} (копия)`,
      content: post.content,
      platforms: [post.platform],
      status: 'черновик',
      scheduledDate: post.scheduledDate || '',
    });
    setPostImages(post.imageUrl ? [post.imageUrl] : (post.images || []));
    setShowModal(true);
    setShowDayModal(false);
    setContextMenu(null);
  };

  const resetForm = () => {
    const dateStr = selectedDate ? formatLocalDate(selectedDate) : '';
    setFormData({
      title: '',
      content: '',
      platforms: ['telegram'],
      status: 'черновик',
      scheduledDate: dateStr,
    });
    setPostImages([]);
    setPostImageFiles([]);
  };

  // FullCalendar event handlers
  const handleFullCalendarDateClick = (date: Date) => {
    setSelectedDate(date);
    setEditingPost(null);
    resetForm();
    const dateStr = formatLocalDate(date);
    setFormData(prev => ({ ...prev, scheduledDate: dateStr }));
    setShowModal(true);
  };

  const handleFullCalendarEventClick = (post: ContentPost) => {
    handleEdit(post);
  };

  const handleFullCalendarEventDrop = async (postId: string, newDate: Date) => {
    try {
      const dateStr = formatLocalDate(newDate);
      await contentApi.update(postId, { scheduledDate: dateStr });
      showToast('Дата обновлена', 'success');
      fetchPosts();
    } catch {
      showToast('Ошибка обновления даты', 'error');
      fetchPosts();
    }
  };  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  };

  const parseLocalDate = (dateStr: string): Date => {
    // Parse as local time, not UTC
    if (!dateStr) return new Date();
    const parts = dateStr.split('T');
    if (parts.length === 2) {
      const [datePart, timePart] = parts;
      const [y, m, d] = datePart.split('-').map(Number);
      const [h, min] = timePart.split(':').map(Number);
      return new Date(y, m - 1, d, h || 0, min || 0);
    }
    return new Date(dateStr);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const getPostsForDate = (date: Date) => {
    return posts.filter((post) => {
      if (!post.scheduledDate && !post.createdAt) return false;
      const postDate = parseLocalDate(post.scheduledDate || post.createdAt);
      const matchesDate = postDate.getDate() === date.getDate() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getFullYear() === date.getFullYear();
      
      if (filterPlatform !== 'all') {
        return matchesDate && post.platform === filterPlatform;
      }
      return matchesDate;
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleContextMenu = (e: React.MouseEvent, date: Date) => {
    e.preventDefault();
    const dayPosts = getPostsForDate(date);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      date,
      posts: dayPosts,
    });
  };

  const openDayModal = (date: Date) => {
    setSelectedDate(date);
    setShowDayModal(true);
    setContextMenu(null);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 sm:h-20 md:h-24 lg:h-28" />);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayPosts = getPostsForDate(date);
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate?.toDateString() === date.toDateString();
      const dayOfWeek = (firstDay + day - 1) % 7;
      const isWeekend = dayOfWeek >= 5;

      days.push(
        <motion.div
          key={day}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: day * 0.02 }}
          whileHover={{ scale: 1.05, zIndex: 10 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => openDayModal(date)}
          onContextMenu={(e) => handleContextMenu(e, date)}
          className={`relative h-20 sm:h-20 md:h-24 lg:h-28 p-1.5 md:p-2 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden group ${
            isWeekend ? 'weekend-cell' : ''
          }`}
          style={{
            background: isSelected 
              ? 'linear-gradient(135deg, var(--color-glow), rgba(0,0,0,0.3))' 
              : isToday 
              ? 'linear-gradient(135deg, var(--color-glow), rgba(0,0,0,0.5))'
              : 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            border: isToday 
              ? '2px solid var(--color-primary)' 
              : isSelected
              ? '2px solid var(--color-accent)'
              : '1px solid rgba(255,255,255,0.06)',
            boxShadow: isToday 
              ? '0 0 20px var(--color-glow), inset 0 0 20px var(--color-glow)' 
              : isSelected
              ? '0 0 15px var(--color-glow)'
              : 'none',
          }}
        >
          {/* Glow effect on hover */}
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at center, var(--color-glow), transparent 70%)',
            }}
          />

          {/* Day number + actions */}
          <div className="relative z-10 flex items-center justify-between mb-1">
            <span
              className={`text-sm font-mono font-bold w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                isToday ? 'text-black' : isWeekend ? '' : 'text-gray-400'
              }`}
              style={isToday ? { 
                backgroundColor: 'var(--color-primary)',
                boxShadow: '0 0 10px var(--color-glow)'
              } : isWeekend ? { color: '#ff6b6b' } : {}}
            >
              {day}
            </span>
          </div>

          {/* Planned post indicator dot + count */}
          {dayPosts.length > 0 && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{
                background: dayPosts.some(p => p.status === 'опубликован') ? '#00ff88'
                  : dayPosts.some(p => p.status === 'утверждён') ? '#bf00ff'
                  : dayPosts.some(p => p.status === 'согласован') ? '#00d4ff'
                  : dayPosts.some(p => p.status === 'на_доработку') ? '#ff3b30'
                  : dayPosts.some(p => p.status === 'запланирован') ? '#eab308'
                  : '#6b7280',
                boxShadow: `0 0 6px ${
                  dayPosts.some(p => p.status === 'опубликован') ? 'rgba(0,255,136,0.5)'
                  : dayPosts.some(p => p.status === 'запланирован') ? 'rgba(234,179,8,0.5)'
                  : 'rgba(107,114,128,0.3)'
                }`
              }} />
              <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{dayPosts.length}</span>
            </div>
          )}

          {/* Today indicator line */}
          {isToday && (
            <div 
              className="absolute bottom-0 left-0 right-0 h-1"
              style={{ 
                background: 'var(--color-primary)',
                boxShadow: '0 0 10px var(--color-glow)'
              }}
            />
          )}
        </motion.div>
      );
    }

    return days;
  };

  const selectedDatePosts = selectedDate ? getPostsForDate(selectedDate) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Zap className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          </motion.div>
          <p className="neon-text text-xl font-mono" style={{ color: 'var(--color-primary)' }}>
            ЗАГРУЗКА КАЛЕНДАРЯ...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 cyber-grid">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <Calendar className="w-7 h-7 md:w-8 md:h-8" />
            КОНТЕНТ-ПЛАН
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// КАЛЕНДАРЬ ПУБЛИКАЦИЙ В СОЦСЕТЯХ</p>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          {/* Calendar view toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button onClick={() => setCalendarView('grid')}
              className={`p-2 transition-all ${calendarView === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setCalendarView('full')}
              className={`p-2 transition-all ${calendarView === 'full' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>

          {/* Platform filters */}
          <div className="flex gap-1 p-1 rounded-xl glass overflow-x-auto">
            <button
              onClick={() => setFilterPlatform('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                filterPlatform === 'all' ? 'glass-accent text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              ВСЕ
            </button>
            {(Object.keys(platformConfig) as SocialPlatform[]).map((platform) => (
              <button
                key={platform}
                onClick={() => setFilterPlatform(platform)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  filterPlatform === platform ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
                style={filterPlatform === platform ? { 
                  background: platformConfig[platform].gradient,
                  boxShadow: `0 0 10px ${platformConfig[platform].color}40`
                } : {}}
              >
                {platformConfig[platform].icon} {platformConfig[platform].shortLabel}
              </button>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditingPost(null);
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm transition-all neon-glow-pulse"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
          >
            <Plus className="w-4 h-4" />
            НОВЫЙ ПОСТ
          </motion.button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          {calendarView === 'full' ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-4 md:p-6 overflow-hidden"
            >
              <FullCalendarView
                posts={posts}
                filterPlatform={filterPlatform}
                onDateClick={handleFullCalendarDateClick}
                onEventClick={handleFullCalendarEventClick}
                onEventDrop={handleFullCalendarEventDrop}
              />
            </motion.div>
          ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4 md:p-6 overflow-hidden"
          >
            {/* Calendar Navigation */}
            <div className="flex items-center justify-between mb-6">
              <motion.button
                whileHover={{ scale: 1.1, x: -2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigateMonth('prev')}
                className="p-2 md:p-3 rounded-xl glass hover:glass-accent transition-all"
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--color-primary)' }} />
              </motion.button>
              
              <div className="flex items-center gap-2 md:gap-4">
                <h2 className="text-lg md:text-2xl font-bold font-mono text-gray-200">
                  {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={goToToday}
                  className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs font-mono glass hover:glass-accent transition-all"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <Clock className="w-3 h-3 inline mr-1" />
                  СЕГОДНЯ
                </motion.button>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.1, x: 2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigateMonth('next')}
                className="p-2 md:p-3 rounded-xl glass hover:glass-accent transition-all"
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--color-primary)' }} />
              </motion.button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-2 mb-3">
              {DAYS_OF_WEEK.map((day, index) => (
                <div 
                  key={day} 
                  className={`text-center text-xs font-mono font-bold py-2 rounded-lg ${
                    index >= 5 ? 'weekend-text bg-red-500/5' : 'text-gray-500'
                  }`}
                  style={index >= 5 ? { color: '#ff6b6b' } : {}}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">{renderCalendar()}</div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                <span className="text-xs font-mono text-gray-500">ПЛОЩАДКИ:</span>
              </div>
              {(Object.keys(platformConfig) as SocialPlatform[]).map((platform) => (
                <div key={platform} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      background: platformConfig[platform].gradient,
                      boxShadow: `0 0 6px ${platformConfig[platform].color}40`
                    }}
                  />
                  <span className="text-xs text-gray-400">{platformConfig[platform].shortLabel}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 ml-4">
                <div className="w-3 h-3 rounded weekend-cell border border-red-500/30" />
                <span className="text-xs text-gray-400">Выходные</span>
              </div>
              <div className="flex items-center gap-2 ml-4 text-xs text-gray-500">
                <MoreVertical className="w-3 h-3" />
                <span>ПКМ = меню</span>
              </div>
            </div>
          </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-2xl p-4 sticky top-6"
          >
            {/* Selected Date */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-mono text-gray-200">
                {selectedDate
                  ? selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).toUpperCase()
                  : 'ВЫБЕРИТЕ ДАТУ'}
              </h3>
              {selectedDate && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openDayModal(selectedDate)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
                    title="Управление днём"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Posts for selected date */}
            {selectedDate ? (
              <>
                {selectedDatePosts.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {selectedDatePosts.map((post, index) => {
                      const config = platformConfig[post.platform] || { icon: <Globe className="w-4 h-4" />, label: post.platform || 'Неизвестно', shortLabel: '??', color: '#6b7280', gradient: 'linear-gradient(135deg, #6b7280, #4a4a60)' };
                      const status = statusConfig[post.status] || statusConfig['черновик'];
                      return (
                        <motion.div
                          key={post.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="glass-card rounded-xl p-3 group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span 
                              className="px-2 py-0.5 rounded text-xs font-mono font-bold"
                              style={{ 
                                background: config.gradient,
                                color: '#fff'
                              }}
                            >
                              {config.icon} {config.label}
                            </span>
                            <span 
                              className="px-2 py-0.5 rounded text-xs"
                              style={{ 
                                backgroundColor: `${status.color}20`,
                                color: status.color
                              }}
                            >
                              {status.icon}
                            </span>
                          </div>
                          <h4 className="text-sm font-medium text-gray-200 mb-1">{post.title}</h4>
                          <p className="text-xs text-gray-400 line-clamp-2 mb-3">{post.content}</p>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(post)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg glass text-gray-400 hover:text-gray-200 text-xs transition-colors"
                            >
                              <Edit className="w-3 h-3" />
                              ИЗМЕНИТЬ
                            </button>
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="p-1.5 rounded-lg glass text-gray-400 hover:text-red-400 transition-colors"
                            >
                              <Trash className="w-3 h-3" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-mono text-sm">// НЕТ ПОСТОВ</p>
                    <button
                      onClick={() => {
                        resetForm();
                        setShowModal(true);
                      }}
                      className="mt-3 text-sm font-mono hover:underline transition-colors"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      + ДОБАВИТЬ
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="font-mono text-sm">// НАЖМИТЕ НА ДАТУ</p>
                <p className="text-xs mt-1">чтобы увидеть посты</p>
              </div>
            )}

            {/* Stats */}
            <div className="mt-6 pt-4 border-t border-white/5">
              <h4 className="text-xs font-mono mb-3" style={{ color: 'var(--color-primary)' }}>
                // СТАТИСТИКА
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                  <span className="text-xs text-gray-400">ВСЕГО</span>
                  <span className="text-sm font-mono font-bold text-gray-200">{posts.length}</span>
                </div>
                {(Object.keys(platformConfig) as SocialPlatform[]).map((platform) => (
                  <div key={platform} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <span className="text-xs text-gray-400">
                      {platformConfig[platform].icon} {platformConfig[platform].shortLabel}
                    </span>
                    <span 
                      className="text-sm font-mono font-bold"
                      style={{ color: platformConfig[platform].color }}
                    >
                      {posts.filter((p) => p.platform === platform).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-[100] glass-frost rounded-xl p-2 shadow-2xl min-w-[200px]"
            style={{ 
              left: contextMenu.x, 
              top: contextMenu.y,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="text-xs font-mono px-3 py-2 mb-1" style={{ color: 'var(--color-primary)' }}>
              // {contextMenu.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </div>
            
            <button
              onClick={() => {
                setSelectedDate(contextMenu.date);
                resetForm();
                setEditingPost(null);
                setShowModal(true);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
            >
              <Plus className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              ДОБАВИТЬ ПОСТ
            </button>

            {contextMenu.posts.length > 0 && (
              <>
                <button
                  onClick={() => openDayModal(contextMenu.date)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-blue-400" />
                  ВСЕ ПОСТЫ ({contextMenu.posts.length})
                </button>

                <div className="h-px bg-white/5 my-1" />

                <button
                  onClick={() => handleDeleteAllForDay(contextMenu.date)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  УДАЛИТЬ ВСЕ ({contextMenu.posts.length})
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Detail Modal */}
      <AnimatePresence>
        {showDayModal && selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[100] p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowDayModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-frost rounded-2xl p-4 md:p-6 w-full max-w-xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold font-mono text-gray-200 flex items-center gap-2">
                    <Calendar className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                    {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </h2>
                  <p className="text-xs font-mono text-gray-500 mt-1">
                    // {selectedDatePosts.length} {selectedDatePosts.length === 1 ? 'ПОСТ' : 'ПОСТОВ'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      resetForm();
                      setEditingPost(null);
                      setShowModal(true);
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
                    title="Добавить пост"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowDayModal(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Posts list */}
              {selectedDatePosts.length > 0 ? (
                <div className="space-y-2">
                  {selectedDatePosts.map((post, index) => {
                    const config = platformConfig[post.platform] || { icon: <Globe className="w-4 h-4" />, label: post.platform || 'Неизвестно', shortLabel: '??', color: '#6b7280', gradient: 'linear-gradient(135deg, #6b7280, #4a4a60)' };
                    const status = statusConfig[post.status] || statusConfig['черновик'];
                    const isExpanded = expandedPost === post.id;
                    return (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="glass-card rounded-xl overflow-hidden"
                      >
                        {/* Compact header — always visible */}
                        <button
                          onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                        >
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold flex-shrink-0"
                            style={{ background: config.gradient, color: '#fff' }}
                          >
                            {config.shortLabel}
                          </span>
                          <span className="text-sm font-medium text-gray-200 truncate flex-1">{post.title}</span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] flex-shrink-0"
                            style={{ backgroundColor: `${status.color}20`, color: status.color }}
                          >
                            {status.icon} {status.label}
                          </span>
                          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>

                        {/* Expanded content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-1 border-t border-white/5">
                                {post.imageUrl && (
                                  <img src={(post as any).thumbnailUrl || post.imageUrl} alt="" className="w-full max-h-40 object-cover rounded-lg mb-3" />
                                )}
                                <p className="text-xs text-gray-400 mb-3 whitespace-pre-wrap">{post.content}</p>
                                {post.scheduledDate && (
                                  <p className="text-xs font-mono text-gray-500 mb-3">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {formatTimeKR(parseLocalDate(post.scheduledDate))}
                                  </p>
                                )}
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleDuplicate(post)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
                                  >
                                    <Copy className="w-3 h-3" /> Копия
                                  </button>
                                  <button
                                    onClick={() => handleEdit(post)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
                                  >
                                    <Edit className="w-3 h-3" /> Изменить
                                  </button>
                                  <button
                                    onClick={() => handleDelete(post.id)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                  >
                                    <Trash className="w-3 h-3" /> Удалить
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="font-mono">// НЕТ ПОСТОВ</p>
                  <button
                    onClick={() => {
                      resetForm();
                      setEditingPost(null);
                      setShowModal(true);
                    }}
                    className="mt-4 px-4 py-2 rounded-xl font-mono text-sm transition-all"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
                  >
                    + ДОБАВИТЬ
                  </button>
                </div>
              )}

              {/* Delete all button */}
              {selectedDatePosts.length > 1 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <button
                    onClick={() => handleDeleteAllForDay(selectedDate)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    УДАЛИТЬ ВСЕ ПОСТЫ ЗА ДЕНЬ
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[100] p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-frost rounded-2xl p-4 md:p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold font-mono text-gray-200 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                {editingPost ? 'РЕДАКТИРОВАТЬ ПОСТ' : 'НОВЫЙ ПОСТ'}
              </h2>

              {/* Approval Pipeline (only when editing) */}
              {editingPost && (
                <div className="mb-4">
                  <ApprovalPipeline currentStatus={editingPost.status} />
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono mb-2" style={{ color: 'var(--color-primary)' }}>
                    // ЗАГОЛОВОК
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-200 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono mb-2" style={{ color: 'var(--color-primary)' }}>
                    // СОДЕРЖАНИЕ
                  </label>
                  <RichEditor
                    content={formData.content}
                    onChange={(html) => setFormData({ ...formData, content: html })}
                    placeholder="// ВВЕДИТЕ ТЕКСТ ПОСТА..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono mb-2" style={{ color: 'var(--color-primary)' }}>
                    // ПЛОЩАДКИ
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(platformConfig) as SocialPlatform[]).map((platform) => {
                      const cfg = platformConfig[platform];
                      const selected = formData.platforms.includes(platform);
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              platforms: selected
                                ? prev.platforms.filter(p => p !== platform)
                                : [...prev.platforms, platform],
                            }));
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all"
                          style={{
                            background: selected ? cfg.gradient : 'rgba(255,255,255,0.03)',
                            color: selected ? '#fff' : '#6b7280',
                            border: selected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                            boxShadow: selected ? `0 0 10px ${cfg.color}40` : 'none',
                          }}
                        >
                          {cfg.icon}
                          {cfg.label}
                          {selected && <span className="text-[10px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono mb-2" style={{ color: 'var(--color-primary)' }}>
                    // СТАТУС
                  </label>
                  {editingPost ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: statusConfig[editingPost.status]?.color }}>{statusConfig[editingPost.status]?.icon}</span>
                      <span className="font-mono text-sm" style={{ color: statusConfig[editingPost.status]?.color }}>{statusConfig[editingPost.status]?.label}</span>
                    </div>
                  ) : (
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as ContentStatus })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-200">
                      <option value="черновик">Черновик</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-mono mb-2" style={{ color: 'var(--color-primary)' }}>
                    // ДАТА И ВРЕМЯ
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-200"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-mono mb-2" style={{ color: 'var(--color-primary)' }}>
                    // ИЗОБРАЖЕНИЯ
                  </label>
                  <ImageUpload
                    images={postImages}
                    onImagesChange={setPostImages}
                    onFilesChange={setPostImageFiles}
                    maxImages={10}
                    maxSizeMB={5}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl glass text-gray-400 hover:text-gray-200 transition-colors font-mono">
                    ОТМЕНА
                  </button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit"
                    className="flex-1 py-3 px-4 rounded-xl font-mono font-bold transition-all"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                    {editingPost ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}
                  </motion.button>
                </div>
              </form>

              {/* Approval Actions + Status + Comments (only when editing existing post) */}
              {editingPost && (
                <div className="mt-4 pt-4 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <ApprovalActions post={editingPost} approvals={approvals} onUpdate={() => {
                    contentApi.getApprovals(editingPost.id).then(res => { if (res.success && res.data) setApprovals(res.data); }).catch(() => {});
                    fetchPosts();
                  }} />
                  <ApprovalStatus approvals={approvals} />
                  <PostComments postId={editingPost.id} />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
      />

      {/* Spinner */}
      <NexusSpinner isVisible={isSaving} text="СОХРАНЕНИЕ..." />
    </div>
  );
}
