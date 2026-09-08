import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, MessageSquare, FileText, AtSign } from 'lucide-react';
import { notificationsApi } from '../../services/api';
import { Notification as NotificationType } from '../../types';
import { useNavigate } from 'react-router-dom';

const typeIcons: Record<string, typeof Bell> = {
  content_status: FileText,
  content_comment: MessageSquare,
  chat_message: MessageSquare,
  mention: AtSign,
};

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      if (res.success && res.data) setUnreadCount(res.data.count);
    } catch {}
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await notificationsApi.getAll({ limit: 30, unread: '1' });
      if (res.success && res.data) setNotifications(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const baseTitle = 'NEXUS CRM';
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
  }, [unreadCount]);

  useEffect(() => {
    if (showDropdown) fetchUnread();
  }, [showDropdown, fetchUnread]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (n: NotificationType) => {
    try {
      await notificationsApi.markAsRead(n.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.filter(item => item.id !== n.id));
    } catch {}
    setShowDropdown(false);
    if (n.link) {
      if (n.type === 'chat_message' || n.type === 'mention') {
        const convMatch = n.link.match(/conv=([^&]+)/);
        if (convMatch) {
          window.dispatchEvent(new CustomEvent('nexus:open-chat', { detail: { convId: convMatch[1] } }));
          return;
        }
      }
      navigate(n.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setUnreadCount(0);
      setNotifications([]);
    } catch {}
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'сейчас';
    if (diffMin < 60) return `${diffMin}м`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}ч`;
    return `${Math.floor(diffHours / 24)}д`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 md:p-2.5 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold font-mono px-1"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000', boxShadow: '0 0 8px var(--color-glow)' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed md:absolute left-2 right-2 md:left-auto md:right-0 top-14 md:top-12 w-auto md:w-80 glass-frost rounded-2xl shadow-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.1)', zIndex: 9999 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-primary)' }}>// УВЕДОМЛЕНИЯ</span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
                  <Check className="w-3 h-3" /> Все прочитано
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500 font-mono">Нет новых уведомлений</div>
              ) : (
                notifications.map(n => {
                  const Icon = typeIcons[n.type] || Bell;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 bg-white/[0.02]"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate text-gray-200">{n.title}</p>
                        {n.body && <p className="text-[10px] text-gray-500 truncate mt-0.5">{n.body}</p>}
                      </div>
                      <span className="text-[9px] text-gray-600 font-mono flex-shrink-0 mt-1">{formatTime(n.createdAt)}</span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
