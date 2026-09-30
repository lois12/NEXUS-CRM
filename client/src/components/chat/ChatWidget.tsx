import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Paperclip, Smile, Mic, ArrowLeft, Reply, File as FileIcon, Square, Maximize2, Minimize2, Users, Image as ImageIcon, UserPlus, Volume2, VolumeX, Check, Search, Pin, Forward, Edit3, Info, MoreHorizontal, Download, ZoomIn, Upload } from 'lucide-react';
import { chatApi, usersApi } from '../../services/api';
import { ChatConversation, ChatMessage, ChatGroupMember, ChatReaction, ChatPinnedMessage, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, getSocket } from '../../services/socket';
import { showToast } from '../ui/NexusModal';
import { useNavigate } from 'react-router-dom';
import { GLASS_BG, GLASS_BORDER, GLASS_BLUR, GLOW_GREEN } from './chatConstants';
import { playSound, url, extractMentions, renderMentions, renderRichText, fmtMsgTime, fmtTime } from './chatUtils';
import GifPicker from './GifPicker';
import EmojiPicker from './EmojiPicker';
import StickerPicker from './StickerPicker';
import ReactMarkdown from 'react-markdown';
import { Avatar, DateSeparator, isOnline, formatLastSeen } from './chatShared';
import VoicePlayer from './VoicePlayer';
import { ContextMenuOverlay, ForwardOverlay, ProfileModalOverlay, PollMessage } from './ChatOverlays';
import { MediaPanel, MembersPanel, PinnedPanel, FavoritesPanel, GroupInfoPanel } from './ChatSidePanels';
import SoundSettingsPanel from './SoundSettingsPanel';
import { useChatSettings } from './useChatSettings';
import { useChatRecording } from './useChatRecording';

export default function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatTheme, setChatTheme, chatWallpaper, setChatWallpaper, dndEnabled, setDndEnabled, dndStart, setDndStart, dndEnd, setDndEnd, soundPrivate, setSoundPrivate, soundGroup, setSoundGroup, soundEnabled, setSoundEnabled, isDndActive } = useChatSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConv, setActiveConv] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [mediaTab, setMediaTab] = useState<'photos' | 'files' | 'audio'>('photos');
  const [showMembers, setShowMembers] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupMembers, setGroupMembers] = useState<ChatGroupMember[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatPinnedMessage[]>([]);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [convFilter, setConvFilter] = useState('');
  const [messageTypeFilter, setMessageTypeFilter] = useState<'all' | 'text' | 'image' | 'file' | 'audio'>('all');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showSticker, setShowSticker] = useState(false);
  const [chatDragOver, setChatDragOver] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ url: string; type: 'image' | 'file'; name: string }[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupMembersIds, setGroupMembersIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: ChatMessage } | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; name: string }[]>([]);
  const [profileModal, setProfileModal] = useState<User | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Favorites
  const [showFavorites, setShowFavorites] = useState(false);
  const [favoriteMessages, setFavoriteMessages] = useState<ChatMessage[]>([]);

  // Poll creation
  const [showPollCreate, setShowPollCreate] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Drafts — save/restore per conversation
  const draftsRef = useRef<Record<string, string>>({});

  // First unread message ID for divider
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (moreMenuRef.current?.contains(target)) return;
      if (moreMenuPortalRef.current?.contains(target)) return;
      setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);
  const activeConvRef = useRef<ChatConversation | null>(null);
  const { isRecording, recordTime, startRecording, stopRecording, cancelRecording } = useChatRecording(activeConvRef);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const prevUnreadRef = useRef(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await chatApi.getUnreadCount();
      if (res.success && res.data) {
        if (res.data.count > prevUnreadRef.current && soundEnabled && !isOpen && !isDndActive()) playSound(soundPrivate);
        prevUnreadRef.current = res.data.count;
        setUnreadTotal(res.data.count);
      }
    } catch {}
  }, [soundEnabled, soundPrivate, isOpen, isDndActive]);

  // WebSocket reconnect handler
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => { fetchUnreadCount(); unreadPollRef.current = setInterval(fetchUnreadCount, 30000); return () => { if (unreadPollRef.current) clearInterval(unreadPollRef.current); }; }, [fetchUnreadCount]);
  const fetchConversations = useCallback(async () => { try { const res = await chatApi.getConversations(); if (res.success && res.data) setConversations(res.data); } catch {} }, []);
  useEffect(() => { if (isOpen) fetchConversations(); }, [isOpen, fetchConversations]);

  // WebSocket reconnect — moved here after fetchConversations is defined
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onConnect = () => { setIsConnected(true); if (activeConvRef.current) { socket.emit('chat:join', activeConvRef.current.id); fetchConversations(); fetchUnreadCount(); } };
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setIsConnected(socket.connected);
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); };
  }, [fetchConversations, fetchUnreadCount]);

  // Listen for open-chat events from notifications
  useEffect(() => {
    const handler = async (e: Event) => {
      const convId = (e as CustomEvent).detail?.convId;
      if (!convId) return;
      setIsOpen(true);
      if (window.innerWidth < 768) setIsFullscreen(true);
      try {
        const res = await chatApi.getConversations();
        if (res.success && res.data) {
          setConversations(res.data);
          const conv = res.data.find((c: ChatConversation) => c.id === convId);
          if (conv) {
            setActiveConv(conv);
            activeConvRef.current = conv;
            setMessages([]);
            // Fetch messages for this conversation
            const msgRes = await chatApi.getMessages(convId, { limit: 50 });
            if (msgRes.success && msgRes.data) setMessages(msgRes.data);
            if (conv.isGroup) {
              const membersRes = await chatApi.getGroupMembers(convId);
              if (membersRes.success && membersRes.data) setGroupMembers(membersRes.data);
            }
          }
        }
      } catch {}
    };
    window.addEventListener('nexus:open-chat', handler);
    return () => window.removeEventListener('nexus:open-chat', handler);
  }, []);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingRef = useRef(0);

  useEffect(() => { if (activeConv && isOpen) chatApi.markRead(activeConv.id).then(() => fetchUnreadCount()).catch(() => {}); }, [activeConv, isOpen, fetchUnreadCount]);
  // Auto-scroll only when a new message is appended (not on edits/reactions/deletes)
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const container = messagesContainerRef.current;
      // Only auto-scroll if user is near bottom (within 200px)
      if (container && container.scrollHeight - container.scrollTop - container.clientHeight < 200) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);
  useEffect(() => { if (showUserSearch || showGroupCreate) usersApi.getAll().then(res => { if (res.success && res.data) setUsers(res.data); }).catch(() => {}); }, [showUserSearch, showGroupCreate]);
  // Typing indicator — debounce: emit once on first keystroke, then every 3s while typing
  useEffect(() => {
    if (!activeConv || !newMessage.trim()) return;
    const now = Date.now();
    // First keystroke or after 3s pause: emit immediately
    if (now - lastTypingRef.current > 3000) {
      lastTypingRef.current = now;
      chatApi.setTyping(activeConv.id).catch(() => {});
    }
  }, [newMessage, activeConv]);
  useEffect(() => { if (!contextMenu) return; const close = () => setContextMenu(null); document.addEventListener('click', close); return () => document.removeEventListener('click', close); }, [contextMenu]);

  // ─── Socket connection ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const socket = connectSocket(user.id);
    socketRef.current = socket;
    return () => { socketRef.current = null; };
  }, [user]);

  // ─── Socket message listener (replaces polling) ─────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleMessage = (msg: ChatMessage) => {
      const conv = activeConvRef.current;
      if (msg.conversationId === conv?.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      if (msg.senderId !== user?.id) {
        if (soundEnabled && isOpen && !isDndActive()) {
          playSound(conv?.isGroup || conv?.isGeneral ? soundGroup : soundPrivate);
        }
      }
      fetchUnreadCount();
      fetchConversations();
    };

    const handleEdit = (data: { id: string; content: string; editedAt: string }) => {
      setMessages(prev => prev.map(m => m.id === data.id ? { ...m, content: data.content, editedAt: data.editedAt } : m));
    };

    const handleDelete = (data: { id: string }) => {
      setMessages(prev => prev.map(m => m.id === data.id ? { ...m, deleted: 1, content: 'Сообщение удалено' } : m));
    };

    const handleReaction = (data: { messageId: string; reactions: ChatReaction[] }) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
    };

    const handleTyping = (data: { userId: string; name: string }) => {
      if (data.userId === user?.id) return;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingUsers(prev => {
        if (prev.some(t => t.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, name: data.name }];
      });
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers(prev => prev.filter(t => t.userId !== data.userId));
      }, 3000);
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:message-edit', handleEdit);
    socket.on('chat:message-delete', handleDelete);
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:typing', handleTyping);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:message-edit', handleEdit);
      socket.off('chat:message-delete', handleDelete);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:typing', handleTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [user?.id, soundEnabled, isOpen, soundPrivate, soundGroup, fetchUnreadCount, fetchConversations]);

  // ─── Socket room join/leave when switching conversations ────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConv) return;
    socket.emit('chat:join', activeConv.id);
    return () => { socket.emit('chat:leave', activeConv.id); };
  }, [activeConv?.id]);

  const openConversation = async (conv: ChatConversation) => {
    // Save current draft
    if (activeConv && newMessage.trim()) draftsRef.current[activeConv.id] = newMessage;
    else if (activeConv) delete draftsRef.current[activeConv.id];
    setActiveConv(conv); activeConvRef.current = conv; setMessages([]); setReplyTo(null); setShowMedia(false); setShowMembers(false); setShowPinned(false); setShowGroupInfo(false); setEditingMsg(null); setForwardMsg(null); setShowMessageSearch(false); setMessageSearch(''); setAttachedFiles([]);
    setFirstUnreadId(null);
    // Restore draft
    setNewMessage(draftsRef.current[conv.id] || '');
    // Find first unread for divider
    try { const res = await chatApi.getMessages(conv.id, { limit: 50 }); if (res.success && res.data) { setMessages(res.data); const firstUnread = res.data.find((m: ChatMessage) => !m.isRead && m.senderId !== user?.id); setFirstUnreadId(firstUnread?.id || null); } } catch {}
    if (conv.isGroup) { try { const res = await chatApi.getGroupMembers(conv.id); if (res.success && res.data) setGroupMembers(res.data); } catch {} }
  };

  // Lazy loading placeholder (requires backend 'before' param)
  const loadOlderMessages = useCallback(async () => {}, []);

  // Scroll-to-top handler for lazy loading
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || container.scrollTop > 50) return;
    loadOlderMessages();
  }, [loadOlderMessages]);

  const startConversation = async (targetUser: User) => { try { const res = await chatApi.getOrCreateConversation(targetUser.id); if (res.success && res.data) { setShowUserSearch(false); setSearchQuery(''); await fetchConversations(); openConversation(res.data); } } catch { showToast('Ошибка', 'error'); } };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { showToast('Введите название', 'error'); return; }
    if (groupMembersIds.length < 1) { showToast('Добавьте участников', 'error'); return; }
    try { const res = await chatApi.createGroup({ name: groupName, memberIds: groupMembersIds }); if (res.success && res.data) { setShowGroupCreate(false); setGroupName(''); setGroupMembersIds([]); await fetchConversations(); openConversation(res.data); showToast('Группа создана', 'success'); } } catch { showToast('Ошибка', 'error'); }
  };

  const handleSend = async (overrideContent?: string) => {
    if (!activeConv) return;
    const msgContent = overrideContent !== undefined ? overrideContent : newMessage;
    if (editingMsg) {
      if (!msgContent.trim()) return;
      try { await chatApi.editMessage(editingMsg.id, msgContent); setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: msgContent, editedAt: new Date().toISOString() } : m)); setEditingMsg(null); setNewMessage(''); } catch { showToast('Ошибка', 'error'); }
      return;
    }

    const hasText = msgContent.trim().length > 0;
    const hasFiles = attachedFiles.length > 0;
    if (!hasText && !hasFiles) return;

    const mentionedIds = extractMentions(msgContent, users);
    const baseOpts = { replyToId: replyTo?.id, mentionedUserIds: mentionedIds.length > 0 ? mentionedIds.join(',') : undefined };

    try {
      // Send each file with caption on the last one (or the only one)
      if (hasFiles) {
        for (let i = 0; i < attachedFiles.length; i++) {
          const f = attachedFiles[i];
          const isLast = i === attachedFiles.length - 1;
          const caption = isLast && hasText ? msgContent.trim() : undefined;
          await chatApi.sendMessage(activeConv.id, { content: f.url, type: f.type, ...baseOpts, caption });
        }
      } else if (hasText) {
        // Text only, no files
        await chatApi.sendMessage(activeConv.id, { content: msgContent, type: 'text', ...baseOpts });
      }
      // Message will be added via socket 'chat:message' event
      setNewMessage('');
      if (activeConv) delete draftsRef.current[activeConv.id];
      setReplyTo(null);
      setAttachedFiles([]);
    } catch { showToast('Ошибка отправки', 'error'); }
  };

  const handleDeleteMessage = async (msg: ChatMessage) => { try { await chatApi.deleteMessage(msg.id); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, deleted: 1, content: 'Сообщение удалено' } : m)); } catch { showToast('Ошибка', 'error'); } setContextMenu(null); };
  const handleForward = async (targetConv: ChatConversation) => { if (!forwardMsg) return; try { await chatApi.sendMessage(targetConv.id, { content: forwardMsg.content, type: forwardMsg.type, forwardedFrom: forwardMsg.senderName || 'Неизвестный' }); showToast('Переслано', 'success'); } catch { showToast('Ошибка', 'error'); } setForwardMsg(null); };
  const handleReaction = async (msgId: string, emoji: string) => { try { const res = await chatApi.addReaction(msgId, emoji); if (res.success && res.data) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: res.data } : m)); } catch {} };
  const handlePin = async (msgId: string) => { try { await chatApi.pinMessage(msgId); showToast('Закреплено', 'success'); if (activeConv) { const res = await chatApi.getPinnedMessages(activeConv.id); if (res.success && res.data) setPinnedMessages(res.data); } } catch { showToast('Ошибка', 'error'); } setContextMenu(null); };

  const handleFileUpload = async (file: File) => {
    if (!activeConv) { showToast('Откройте чат', 'error'); return; }
    if (attachedFiles.length >= 10) { showToast('Максимум 10 файлов', 'error'); return; }

    // Compress images > 1MB
    let uploadFile = file;
    if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
      try {
        const compressed = await compressImage(file, 1920, 0.8);
        if (compressed.size < file.size) uploadFile = compressed;
      } catch {}
    }

    if (uploadFile.size > 5 * 1024 * 1024) { showToast(`Файл слишком большой: ${(uploadFile.size / 1024 / 1024).toFixed(1)}MB (макс 5MB)`, 'error'); return; }
    try {
      const u = await chatApi.uploadFile(activeConv.id, uploadFile);
      if (u.success && u.data) {
        const fileType = file.type.startsWith('image/') ? 'image' as const : 'file' as const;
        setAttachedFiles(prev => [...prev, { url: u.data!.url, type: fileType, name: file.name }]);
      } else {
        showToast('Ошибка загрузки файла', 'error');
      }
    } catch (err: any) {
      showToast(`Ошибка: ${err?.message || 'Неизвестная'}`, 'error');
    }
  };

  const compressImage = (file: File, maxDim: number, quality: number): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  // Drag-and-drop file upload for chat
  const handleChatDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeConv) setChatDragOver(true);
  }, [activeConv]);

  const handleChatDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChatDragOver(false);
  }, []);

  const handleChatDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChatDragOver(false);
    if (!activeConv) return;

    // Check for material dragged from Materials page
    const materialData = e.dataTransfer.getData('application/x-nexus-material');
    if (materialData) {
      try {
        const mat = JSON.parse(materialData);
        if (attachedFiles.length >= 10) { showToast('Максимум 10 файлов', 'error'); return; }
        setAttachedFiles(prev => [...prev, { url: mat.url, type: mat.type, name: mat.name }]);
      } catch {}
      return;
    }

    // Otherwise handle OS files
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`Файл слишком большой: ${file.name}`, 'error');
        continue;
      }
      await handleFileUpload(file);
    }
  }, [activeConv, handleFileUpload, attachedFiles.length]);

  // Recording → imported from useChatRecording.ts

  const filteredUsers = users.filter(u => u.id !== user?.id && (u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || u.username.toLowerCase().includes(searchQuery.toLowerCase())));
  const filteredConvs = conversations
    .filter(c => !c.archived && (c.otherName || '').toLowerCase().includes(convFilter.toLowerCase()))
    .sort((a, b) => (b.pinned || 0) - (a.pinned || 0));
  const filteredMessages = useMemo(() => messages.filter(m => {
    if (messageTypeFilter !== 'all' && m.type !== messageTypeFilter) return false;
    if (messageSearch && m.type === 'text' && !m.content.toLowerCase().includes(messageSearch.toLowerCase())) return false;
    return true;
  }), [messages, messageTypeFilter, messageSearch]);
  const mediaPhotos = messages.filter(m => m.type === 'image');
  const mediaFiles = messages.filter(m => m.type === 'file');
  const mediaAudio = messages.filter(m => m.type === 'audio');

  // ─── STYLE ALIASES ──────────────────────────────────────────
  const glassBg = GLASS_BG;
  const glassBorder = GLASS_BORDER;
  const glassBlur = GLASS_BLUR;
  const glowGreen = GLOW_GREEN;

  // ─── SUB-COMPONENTS ──────────────────────────────────────────

  const ConversationItem = ({ conv, active }: { conv: ChatConversation; active: boolean }) => {
    const isPinned = conv.pinned === 1;
    return (
    <button onClick={() => openConversation(conv)} className={`w-full flex items-center gap-3 px-4 py-3.5 transition-all duration-200 text-left relative overflow-hidden ${active ? '' : 'hover:bg-white/[0.03]'}`}
      style={active ? { background: 'linear-gradient(135deg, rgba(0,255,136,0.08) 0%, rgba(0,212,255,0.04) 100%)', borderLeft: '2px solid var(--color-primary)' } : { borderLeft: '2px solid transparent' }}
      onContextMenu={async e => { e.preventDefault(); if (!conv.isGeneral) { try { if (isPinned) await chatApi.unpinConversation(conv.id); else await chatApi.pinConversation(conv.id); showToast(isPinned ? 'Чат откреплён' : 'Чат закреплён', 'success'); fetchConversations(); } catch { showToast('Ошибка', 'error'); } } }}>
      {conv.isGeneral ? (
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,212,255,0.1))', border: '1.5px solid rgba(0,255,136,0.3)', boxShadow: active ? '0 0 12px rgba(0,255,136,0.3)' : 'none' }}>
          <svg viewBox="0 0 120 120" width="24" height="24">
            <polygon points="60,8 108,32 108,88 60,112 12,88 12,32" fill="none" stroke="#00ff88" strokeWidth="4" opacity="0.6"/>
            <polygon points="60,20 96,38 96,82 60,100 24,82 24,38" fill="none" stroke="#00d4ff" strokeWidth="2" opacity="0.4"/>
            <path d="M48,40 L48,80 L56,80 L56,68 L68,68 L68,60 L56,60 L56,48 L72,48 L72,40 Z" fill="#00ff88" opacity="0.8"/>
            <path d="M76,40 L76,80 L84,80 L84,40 Z" fill="#00d4ff" opacity="0.6"/>
          </svg>
        </div>
      ) : (
        <Avatar name={conv.otherName} avatar={conv.otherAvatar} glow={active} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm truncate ${active ? 'font-bold' : 'font-medium'}`} style={{ color: active ? '#fff' : '#c0c0d0' }}>{conv.otherName}</span>
          {(conv.unreadCount || 0) > 0 && <span className="min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[9px] font-bold font-mono px-1" style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000', boxShadow: '0 0 10px rgba(0,255,136,0.4)' }}>{conv.unreadCount}</span>}
        </div>
        {conv.isGroup && <span className="text-[9px] font-mono" style={{ color: '#5a5a70' }}>{conv.memberCount} участников</span>}
        {conv.otherPosition && !conv.isGroup && <span className="text-[9px] font-mono" style={{ color: '#5a5a70' }}>{conv.otherPosition}</span>}
        <p className="text-xs truncate mt-0.5" style={{ color: '#6a6a80' }}>{conv.lastMessagePreview || 'Нет сообщений'}</p>
      </div>
      {isPinned && <span className="absolute top-1 right-1 text-[10px] opacity-50">📌</span>}
    </button>
  );
  };

  // ─── Online status, VoicePlayer, DateSeparator → imported from chatShared.tsx / VoicePlayer.tsx ──

  const MessageBubble = ({ msg, isGrouped }: { msg: ChatMessage; isGrouped?: boolean }) => {
    const isMine = msg.senderId === user?.id;
    const isDeleted = msg.deleted === 1;
    const myReaction = msg.reactions?.find(r => r.userId === user?.id);

    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}
        onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, msg }); }}>
        <div className={msg.type === 'image' && !msg.caption ? 'max-w-[70%] overflow-hidden rounded-2xl' : 'max-w-[80%] max-sm:max-w-[90%]'}>
          {msg.forwardedFrom && (
            <div className="mb-1 px-3 py-1.5 rounded-xl text-[9px] font-mono flex items-center gap-1.5" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}>
              <Forward className="w-3 h-3" /> Переслано от {msg.forwardedFrom}
            </div>
          )}
          {msg.replyToContent && (
            <div className="mb-1 px-3 py-1.5 rounded-xl text-[9px] font-mono truncate" style={{ background: 'rgba(0,255,136,0.05)', borderLeft: '2.5px solid var(--color-primary)', color: '#8a8aa0' }}>
              <span style={{ color: 'var(--color-primary)' }}>{msg.replyToSenderName}</span>: {msg.replyToContent}
            </div>
          )}
          <div className={`relative ${isMine ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md'} ${isDeleted ? 'opacity-40' : ''} ${msg.type === 'image' && !msg.caption ? 'p-1' : 'px-3.5 py-2.5'}`}
            style={{
              background: isMine ? 'linear-gradient(135deg, rgba(0,255,136,0.15) 0%, rgba(0,212,255,0.1) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
              border: `1px solid ${isMine ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.08)'}`,
              backdropFilter: 'blur(12px)',
              boxShadow: isMine ? '0 4px 16px rgba(0,255,136,0.1), 0 0 0 1px rgba(0,255,136,0.05)' : '0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.03)',
            }}>
            {!isMine && !isDeleted && msg.type !== 'image' && !isGrouped && (
              <span className="text-[9px] font-mono font-bold block mb-1 cursor-pointer relative group/name" style={{ color: '#00d4ff', textShadow: '0 0 6px rgba(0,212,255,0.3)' }}
                onClick={() => { const u = users.find(u => u.id === msg.senderId); if (u) setProfileModal(u); }}>
                {msg.senderName}
                {/* Mini-profile tooltip */}
                <div className="hidden group-hover/name:block absolute bottom-full left-0 mb-1 z-50 w-48 rounded-xl overflow-hidden pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <div className="p-3 text-center">
                    <Avatar name={msg.senderName} avatar={msg.senderAvatar} size="lg" />
                    <p className="font-mono text-xs font-bold text-gray-200 mt-2">{msg.senderName}</p>
                    {msg.senderPosition && <p className="font-mono text-[10px] text-gray-500">{msg.senderPosition}</p>}
                  </div>
                </div>
              </span>
            )}
            {isDeleted ? <p className="text-xs italic" style={{ color: '#5a5a70' }}>Сообщение удалено</p> : <>
              {msg.type === 'image' && (
                <div className="relative group/img" style={{ display: 'inline-block' }}>
                  <img loading="lazy" decoding="async" src={url(msg.content)} alt="" draggable="false" onClick={() => setZoomedImage(url(msg.content))}
                    className="rounded-xl cursor-pointer hover:opacity-90 transition-opacity select-none" style={{ display: 'block', maxWidth: '100%', maxHeight: 300, width: 'auto', height: 'auto', objectFit: 'contain' }} />
                  {!isMine && <span className="absolute top-1.5 left-1.5 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)', color: '#00d4ff', backdropFilter: 'blur(4px)' }}>{msg.senderName}</span>}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                    <button onClick={() => setZoomedImage(url(msg.content))} className="p-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} title="Увеличить">
                      <ZoomIn className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = url(msg.content); a.download = msg.content.split('/').pop() || 'image.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }} className="p-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} title="Скачать">
                      <Download className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  {msg.caption && <div className="mx-3 mt-2 mb-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />}
                  {msg.caption && <div className="px-3 pb-1.5"><p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: '#d0d0e0' }}>{renderMentions(msg.caption, msg.mentionedUserIds || '', users)}</p></div>}
                  <div className="flex items-center justify-end gap-1 px-2 pb-1">
                    <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{fmtMsgTime(msg.createdAt)}</span>
                    {isMine && <span className="text-[11px] font-mono" style={{ color: msg.isRead ? '#00d4ff' : 'rgba(255,255,255,0.4)' }}>✓✓</span>}
                  </div>
                </div>
              )}
              {msg.type !== 'image' && <>
                {msg.type === 'file' && (() => {
                  const fileName = msg.caption || msg.content.split('/').pop() || 'Файл';
                  return <a href={url(msg.content)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-mono mb-1 px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}><FileIcon className="w-4 h-4 flex-shrink-0" /> <span className="truncate max-w-[180px]">{fileName}</span></a>;
                })()}
                {msg.type === 'audio' && <VoicePlayer src={url(msg.content)} />}
                {msg.type === 'poll' && <PollMessage msg={msg} />}
                {msg.type === 'text' && (
                  // Check if it's a sticker (single emoji or short emoji-only message)
                  /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]{1,4}$/u.test(msg.content.trim()) ? (
                    <div className="sticker-sent text-5xl py-1">{msg.content.trim()}</div>
                  ) : (
                    <div className="text-[14px] leading-relaxed chat-markdown" style={{ color: '#d0d0e0' }}>
                      <ReactMarkdown components={{
                        p: ({children}) => <p className="whitespace-pre-wrap mb-1 last:mb-0">{renderRichText(children, msg.mentionedUserIds || '', users)}</p>,
                        strong: ({children}) => <strong className="font-bold text-gray-100">{children}</strong>,
                        em: ({children}) => <em className="italic text-gray-200">{children}</em>,
                        code: ({children, className}) => className?.includes('language-')
                          ? <pre className="bg-black/30 rounded-lg p-2 my-1 text-xs overflow-x-auto"><code>{children}</code></pre>
                          : <code className="bg-black/30 px-1.5 py-0.5 rounded text-[13px] font-mono" style={{ color: '#00d4ff' }}>{children}</code>,
                        del: ({children}) => <del className="line-through text-gray-500">{children}</del>,
                        a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#00d4ff' }}>{children}</a>,
                      }}>{msg.content}</ReactMarkdown>
                    </div>
                  )
                )}
                {/* Link preview */}
                {msg.type === 'text' && /https?:\/\/[^\s]+/.test(msg.content) && (() => {
                  const urls = msg.content.match(/https?:\/\/[^\s]+/g) || [];
                  return urls.slice(0, 2).map((u, idx) => {
                    try {
                      const parsed = new URL(u);
                      const domain = parsed.hostname.replace('www.', '');
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(parsed.pathname);
                      if (isImage) return null; // images are handled separately
                      return (
                        <a key={idx} href={u} target="_blank" rel="noopener noreferrer" className="block mt-1.5 rounded-xl overflow-hidden transition-all hover:border-[rgba(0,212,255,0.3)]" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div className="flex items-center gap-2 px-3 py-2">
                            <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" className="w-4 h-4 rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-mono block truncate" style={{ color: '#5a5a70' }}>{domain}</span>
                              <span className="text-[11px] block truncate" style={{ color: '#8a8aa0' }}>{parsed.pathname !== '/' ? parsed.pathname : u}</span>
                            </div>
                          </div>
                        </a>
                      );
                    } catch { return null; }
                  });
                })()}
                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                  {msg.editedAt && <span className="text-[7px] font-mono" style={{ color: '#5a5a70' }}>изм.</span>}
                  <span className="text-[11px] font-mono" style={{ color: '#6a6a80' }}>{fmtMsgTime(msg.createdAt)}</span>
                  {isMine && <span className="text-[11px] font-mono" style={{ color: msg.isRead ? '#00d4ff' : '#4a4a60' }}>✓✓</span>}
                </div>
              </>}
            </>}
          </div>
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1.5">
              {Object.entries(msg.reactions.reduce((acc: Record<string, ChatReaction[]>, r) => { (acc[r.emoji] = acc[r.emoji] || []).push(r); return acc; }, {})).map(([emoji, reactions]) => (
                <motion.button key={emoji} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => myReaction?.emoji === emoji ? chatApi.removeReaction(msg.id).then(r => { if (r.success) setMessages(p => p.map(m => m.id === msg.id ? { ...m, reactions: r.data } : m)); }).catch(() => {}) : handleReaction(msg.id, emoji)}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] transition-all"
                  style={{ background: myReaction?.emoji === emoji ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${myReaction?.emoji === emoji ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.06)'}`, backdropFilter: 'blur(8px)' }}>
                  {emoji} <span className="text-[8px] font-mono" style={{ color: '#6a6a80' }}>{reactions.length}</span>
                </motion.button>
              ))}
              <button onClick={e => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, msg }); }} className="px-1.5 py-0.5 rounded-full text-[11px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Smile className="w-3 h-3" style={{ color: '#5a5a70' }} />
              </button>
            </div>
          )}
          {!isDeleted && (
            <div className={`flex items-center gap-2 mt-1.5 ${isMine ? 'justify-end' : ''}`}>
              <button onClick={() => setReplyTo(msg)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all hover:bg-white/5" style={{ color: '#6a6a80' }}>
                <Reply className="w-3 h-3" /> ответить
              </button>
              <button onClick={e => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, msg }); }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all hover:bg-white/5" style={{ color: '#6a6a80' }}>
                <MoreHorizontal className="w-3 h-3" /> ещё
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderedMessages = useMemo(() => (
    filteredMessages.map((msg, i) => {
      const prevMsg = i > 0 ? filteredMessages[i - 1] : null;
      const showDate = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
      const isGrouped = !showDate && prevMsg && prevMsg.senderId === msg.senderId && prevMsg.type !== 'image' && msg.type !== 'image';
      const showUnreadDivider = firstUnreadId === msg.id;
      return (
        <div key={msg.id} id={`msg-${msg.id}`}>
          {showUnreadDivider && (
            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 h-px" style={{ background: 'rgba(0,255,136,0.3)' }} />
              <span className="text-[10px] font-mono px-3 py-1 rounded-full font-bold" style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>Новые сообщения</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(0,255,136,0.3)' }} />
            </div>
          )}
          {showDate && <DateSeparator date={msg.createdAt} />}
          <MessageBubble msg={msg} isGrouped={isGrouped} />
        </div>
      );
    })
  ), [filteredMessages, user?.id, firstUnreadId, users]);

  const messagesAreaContent = (
    <>
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 relative"
        style={{ background: chatWallpaper ? (chatWallpaper.startsWith('linear-gradient') ? chatWallpaper : `url(${chatWallpaper}) center/cover`) : 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 100%)' }}
        onScroll={handleScroll}
        onDragOver={handleChatDragOver} onDragLeave={handleChatDragLeave} onDrop={handleChatDrop}>
        {chatDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,255,136,0.05)', backdropFilter: 'blur(2px)' }}>
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-10 h-10" style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>ПЕРЕТАЩИТЕ ФАЙЛЫ</span>
              <span className="text-[10px] font-mono" style={{ color: '#5a5a70' }}>Файлы с диска или из Хранилища</span>
            </div>
          </div>
        )}
        {renderedMessages}
        {typingUsers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-2">
            <div className="flex gap-1">
              {[0, 0.2, 0.4].map((delay, i) => <motion.div key={i} className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)', boxShadow: '0 0 6px rgba(0,255,136,0.5)' }} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay }} />)}
            </div>
            <span className="text-[10px] font-mono" style={{ color: '#5a5a70' }}>{typingUsers.map(t => t.name).join(', ')} печатает...</span>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Message Input — inline to avoid re-mount on poll */}
      <div className="px-4 py-3" style={{ background: glassBg, borderTop: glassBorder, backdropFilter: glassBlur }}>
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedFiles.map((f, i) => (
              <div key={i} className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.15)' }}>
                {f.type === 'image' ? (
                  <img loading="lazy" decoding="async" src={url(f.url)} alt="" className="w-10 h-10 rounded-lg object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                ) : (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                    <FileIcon className="w-4 h-4" style={{ color: '#00d4ff' }} />
                  </div>
                )}
                <span className="text-[10px] font-mono truncate max-w-[80px]" style={{ color: '#c0c0d0' }}>{f.name}</span>
                <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 rounded hover:bg-white/10 transition-colors">
                  <X className="w-3 h-3" style={{ color: '#6a6a80' }} />
                </button>
              </div>
            ))}
          </div>
        )}
        {isRecording && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)' }}>
            <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#ff3b30', boxShadow: '0 0 8px rgba(255,59,48,0.5)' }} />
            <span className="text-[11px] font-mono" style={{ color: '#ff6b6b' }}>{fmtTime(recordTime)}</span>
            <div className="flex-1" />
            <button onClick={stopRecording} className="p-1.5 rounded-lg hover:bg-white/5"><Square className="w-4 h-4" style={{ color: '#ff6b6b' }} /></button>
            <button onClick={cancelRecording} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
          </div>
        )}
        {showEmoji && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-3 relative">
            <button onClick={() => setShowEmoji(false)} className="absolute top-1 right-1 z-10 p-1 rounded-full bg-black/60 hover:bg-black/80 transition-colors">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
            <EmojiPicker onSelect={(emoji: any) => { setNewMessage(p => p + (emoji.native || emoji)); setShowEmoji(false); }} />
          </motion.div>
        )}
        <AnimatePresence>
          {showGif && (
            <div className="relative mb-3">
              <GifPicker
                onSelect={(gifUrl) => {
                  if (gifUrl.startsWith('http')) {
                    handleSend(gifUrl);
                  } else {
                    handleSend(gifUrl);
                  }
                  setShowGif(false);
                }}
                onClose={() => setShowGif(false)}
              />
            </div>
          )}
          {showSticker && (
            <div className="relative mb-3">
              <StickerPicker
                onSelect={(emoji) => {
                  handleSend(emoji);
                  setShowSticker(false);
                }}
                onClose={() => setShowSticker(false)}
              />
            </div>
          )}
        </AnimatePresence>
        <div style={{ minHeight: (replyTo && !editingMsg) || editingMsg ? 'auto' : 0 }}>
          {replyTo && !editingMsg && (
            <div className="mb-2 px-3 py-2 flex items-center gap-2 rounded-xl" style={{ background: 'rgba(0,255,136,0.05)', borderLeft: '2.5px solid var(--color-primary)' }}>
              <Reply className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="text-[11px] font-mono truncate flex-1" style={{ color: '#8a8aa0' }}>{replyTo.senderName}: {replyTo.content?.substring(0, 60)}</span>
              <button onClick={() => setReplyTo(null)} className="p-0.5 rounded hover:bg-white/5"><X className="w-3.5 h-3.5" style={{ color: '#5a5a70' }} /></button>
            </div>
          )}
          {editingMsg && (
            <div className="mb-2 px-3 py-2 flex items-center gap-2 rounded-xl" style={{ background: 'rgba(0,212,255,0.05)', borderLeft: '2.5px solid #00d4ff' }}>
              <Edit3 className="w-4 h-4 flex-shrink-0" style={{ color: '#00d4ff' }} />
              <span className="text-[11px] font-mono truncate flex-1" style={{ color: '#8a8aa0' }}>Редактирование</span>
              <button onClick={() => { setEditingMsg(null); setNewMessage(''); }} className="p-0.5 rounded hover:bg-white/5"><X className="w-3.5 h-3.5" style={{ color: '#5a5a70' }} /></button>
            </div>
          )}
        </div>
        {/* Toolbar row — buttons on top */}
        <div className="flex items-center gap-1.5 md:gap-2 mb-2">
          <input id="chat-file-input" type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
          <button onClick={() => { const el = document.getElementById('chat-file-input'); if (el) el.click(); }} className="p-2 rounded-xl transition-all hover:bg-white/5 flex-shrink-0" style={{ border: glassBorder }}>
            <Paperclip className="w-4 h-4" style={{ color: '#6a6a80' }} />
          </button>
          <div className="hidden md:flex items-center gap-1.5">
            <button onClick={() => setShowEmoji(!showEmoji)} className="p-2 rounded-xl transition-all hover:bg-white/5" style={{ border: glassBorder }}><Smile className="w-4 h-4" style={{ color: showEmoji ? 'var(--color-primary)' : '#6a6a80' }} /></button>
            <button onClick={() => { setShowSticker(!showSticker); setShowEmoji(false); setShowGif(false); }} className="p-2 rounded-xl transition-all hover:bg-white/5" style={{ border: glassBorder }}>
              <span className="text-xs font-bold" style={{ color: showSticker ? 'var(--color-primary)' : '#6a6a80' }}>🎭</span>
            </button>
            <button onClick={() => { setShowGif(!showGif); setShowEmoji(false); setShowSticker(false); }} className="p-2 rounded-xl transition-all hover:bg-white/5" style={{ border: glassBorder }}>
              <span className="text-xs font-bold" style={{ color: showGif ? 'var(--color-primary)' : '#6a6a80' }}>GIF</span>
            </button>
            {!isRecording && <button onClick={startRecording} className="p-2 rounded-xl transition-all hover:bg-white/5" style={{ border: glassBorder }}><Mic className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>}
            <button onClick={() => setShowPollCreate(true)} className="p-2 rounded-xl transition-all hover:bg-white/5" style={{ border: glassBorder }} title="Опрос"><span className="text-xs font-bold" style={{ color: '#6a6a80' }}>📊</span></button>
          </div>
          {/* Mobile: More button */}
          <div className="md:hidden relative" ref={moreMenuRef as any}>
            <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="p-2 rounded-xl transition-all hover:bg-white/5 flex-shrink-0" style={{ border: glassBorder }}>
              <MoreHorizontal className="w-4 h-4" style={{ color: '#6a6a80' }} />
            </button>
            {showMoreMenu && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-12 left-0 rounded-xl p-2 flex gap-2 z-50"
                style={{ background: 'rgba(20,20,35,0.95)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}>
                <button onClick={() => { setShowEmoji(!showEmoji); setShowMoreMenu(false); }} className="p-2 rounded-lg hover:bg-white/10"><Smile className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
                <button onClick={() => { setShowSticker(!showSticker); setShowEmoji(false); setShowGif(false); setShowMoreMenu(false); }} className="p-2 rounded-lg hover:bg-white/10"><span className="text-xs">🎭</span></button>
                <button onClick={() => { setShowGif(!showGif); setShowEmoji(false); setShowSticker(false); setShowMoreMenu(false); }} className="p-2 rounded-lg hover:bg-white/10"><span className="text-xs font-bold" style={{ color: '#6a6a80' }}>GIF</span></button>
                <button onClick={() => { startRecording(); setShowMoreMenu(false); }} className="p-2 rounded-lg hover:bg-white/10"><Mic className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
                <button onClick={() => { setShowPollCreate(true); setShowMoreMenu(false); }} className="p-2 rounded-lg hover:bg-white/10"><span className="text-xs">📊</span></button>
              </motion.div>
            )}
          </div>
          <div className="flex-1" />
          <button onClick={() => handleSend()} disabled={!newMessage.trim() && attachedFiles.length === 0}
            className="p-2.5 rounded-xl disabled:opacity-30 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000', boxShadow: '0 0 20px var(--color-glow)', opacity: (newMessage.trim() || attachedFiles.length > 0) ? 1 : 0.3 }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
        {/* Input row — textarea below */}
        <div className="flex-1 min-w-0">
          <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Сообщение..." rows={isFullscreen ? 3 : 2}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#e0e0e0', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }} />
        </div>
      </div>
    </>
  );

  // ContextMenuOverlay, ForwardOverlay → imported from ChatOverlays.tsx

  // SidePanels + SoundSettings → imported from ChatSidePanels.tsx / SoundSettingsPanel.tsx
  // Handlers for group management
  const handleDeleteGroup = async () => {
    if (!activeConv) return;
    try {
      await chatApi.updateGroup(activeConv.id, { name: `[Удалено] ${activeConv.name}` });
      showToast('Группа удалена', 'success');
      setActiveConv(null); activeConvRef.current = null; setMessages([]);
      fetchConversations();
    } catch { showToast('Ошибка', 'error'); }
  };

  // All side panels + SoundSettings → imported from ChatSidePanels.tsx / SoundSettingsPanel.tsx

  const UserSearchOverlay = ({ onSelect, title }: { onSelect: (u: User) => void; title: string }) => (
    <div className="absolute inset-0 flex flex-col z-10" style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: glassBorder }}>
        <button onClick={() => { setShowUserSearch(false); setShowGroupCreate(false); setSearchQuery(''); }} className="p-1.5 rounded-xl hover:bg-white/5"><ArrowLeft className="w-4 h-4" style={{ color: '#8a8aa0' }} /></button>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus placeholder={title} className="flex-1 bg-transparent text-sm outline-none font-mono" style={{ color: '#e0e0e0' }} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredUsers.map(u => (
          <button key={u.id} onClick={() => onSelect(u)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left">
            <Avatar name={u.fullName} avatar={u.avatar} size="sm" />
            <div className="flex-1 min-w-0"><span className="text-sm truncate block" style={{ color: '#c0c0d0' }}>{u.fullName}</span><span className="text-[9px] font-mono" style={{ color: '#5a5a70' }}>{u.role}</span></div>
            {showGroupCreate && groupMembersIds.includes(u.id) && <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />}
          </button>
        ))}
        {filteredUsers.length === 0 && searchQuery && <div className="p-6 text-center text-xs font-mono" style={{ color: '#4a4a60' }}>Не найдено</div>}
      </div>
    </div>
  );

  const ChatHeader = ({ conv }: { conv: ChatConversation }) => (
    <div className="relative flex items-center gap-3 px-5 py-3.5" style={{ background: glassBg, borderBottom: glassBorder, backdropFilter: glassBlur }}>
      {(!isFullscreen || true) && <button onClick={() => {
        if (isFullscreen && window.innerWidth < 768) { navigate('/'); setIsFullscreen(false); setIsOpen(false); }
        else { setActiveConv(null); activeConvRef.current = null; setMessages([]); setReplyTo(null); }
      }} className={`p-1.5 rounded-xl hover:bg-white/5 transition-colors ${isFullscreen ? 'sm:hidden' : ''}`}><ArrowLeft className="w-4 h-4" style={{ color: '#8a8aa0' }} /></button>}
      <Avatar name={conv.otherName} avatar={conv.otherAvatar} size={isFullscreen ? undefined : 'sm'} glow
        lastSeen={!isConnected ? undefined : conv.otherLastSeen}
        onClick={() => {
          if (conv.isGroup) { setShowMembers(!showMembers); setShowMedia(false); setShowPinned(false); setShowGroupInfo(false); }
          else if (conv.otherId) {
            const u = users.find(u => u.id === conv.otherId);
            if (u) setProfileModal(u);
            else setProfileModal({ id: conv.otherId, username: '', email: '', role: '' as any, fullName: conv.otherName || '', avatar: conv.otherAvatar, createdAt: '', updatedAt: '' } as User);
          }
        }} />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { if (conv.isGroup) { setShowMembers(!showMembers); setShowMedia(false); setShowPinned(false); setShowGroupInfo(false); } }}>
        <span className="text-sm font-medium truncate block" style={{ color: '#e0e0e0' }}>{conv.otherName}</span>
        {conv.isGroup && <span className="text-[9px] font-mono" style={{ color: '#5a5a70' }}>{conv.memberCount} участников</span>}
        {conv.otherPosition && !conv.isGroup && <span className="text-[9px] font-mono" style={{ color: '#5a5a70' }}>{conv.otherPosition}</span>}
        {!conv.isGroup && !conv.otherPosition && conv.otherLastSeen && !isOnline(conv.otherLastSeen) && (
          <span className="text-[9px] font-mono" style={{ color: '#5a5a70' }}>Был(а) {formatLastSeen(conv.otherLastSeen)}</span>
        )}
        {!isConnected && <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>Переподключение...</span>}
        {typingUsers.length > 0 && <span className="text-[9px] font-mono" style={{ color: '#00d4ff' }}>{typingUsers.map(t => t.name).join(', ')} печатает...</span>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {showMessageSearch ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="absolute top-full left-0 right-0 mt-1 mx-2 rounded-xl overflow-hidden z-50" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98) 0%, rgba(10,10,20,0.99) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: glassBorder }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
              <input value={messageSearch} onChange={e => setMessageSearch(e.target.value)} autoFocus placeholder="Поиск сообщений..." className="flex-1 bg-transparent text-sm outline-none font-mono" style={{ color: '#e0e0e0' }} />
              <button onClick={() => { setShowMessageSearch(false); setMessageSearch(''); setMessageTypeFilter('all'); }} className="p-1 rounded-lg hover:bg-white/5"><X className="w-3.5 h-3.5" style={{ color: '#6a6a80' }} /></button>
            </div>
            <div className="flex gap-1 px-3 py-1.5" style={{ borderBottom: glassBorder }}>
              {([['all', 'Все'], ['text', '📝'], ['image', '🖼'], ['file', '📎'], ['audio', '🎤']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setMessageTypeFilter(key)} className="px-2 py-0.5 rounded text-[9px] font-mono transition-all"
                  style={messageTypeFilter === key ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)' } : { color: '#5a5a70' }}>{label}</button>
              ))}
            </div>
            {filteredMessages.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                {filteredMessages.slice(-10).map(m => (
                  <button key={m.id} onClick={() => {
                    setShowMessageSearch(false); setMessageSearch('');
                    const el = document.getElementById(`msg-${m.id}`);
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-[var(--color-primary)]'); setTimeout(() => el.classList.remove('ring-2', 'ring-[var(--color-primary)]'), 2000); }
                  }}
                    className="w-full flex items-start gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors text-left">
                    <span className="text-[9px] font-mono mt-0.5 flex-shrink-0" style={{ color: '#5a5a70' }}>{m.senderName}</span>
                    <span className="text-xs truncate" style={{ color: '#8a8aa0' }}>{m.type === 'text' ? m.content : `[${m.type === 'image' ? 'Фото' : m.type === 'audio' ? 'Голос' : 'Файл'}]`}</span>
                  </button>
                ))}
              </div>
            )}
            {messageSearch && filteredMessages.length === 0 && <div className="px-3 py-3 text-center text-[10px] font-mono" style={{ color: '#4a4a60' }}>Не найдено</div>}
          </motion.div>
        ) : <button onClick={() => setShowMessageSearch(true)} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Поиск"><Search className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>}
        {conv.isGroup && <button onClick={() => { setShowMembers(!showMembers); setShowMedia(false); setShowPinned(false); setShowGroupInfo(false); }} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Участники"><Users className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>}
        <div className="relative" ref={moreMenuRef}>
          <button onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setShowMoreMenu(!showMoreMenu);
            setTimeout(() => {
              const menu = document.getElementById('chat-more-menu');
              if (menu) { menu.style.top = `${rect.bottom + 4}px`; menu.style.right = `${window.innerWidth - rect.right}px`; }
            }, 0);
          }} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Ещё"><MoreHorizontal className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
        </div>
        {!isFullscreen && <button onClick={() => setIsFullscreen(true)} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="На весь экран"><Maximize2 className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>}
        {isFullscreen && <button onClick={() => setIsFullscreen(false)} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Свернуть"><Minimize2 className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>}
      </div>
    </div>
  );

  // ─── RENDER ──────────────────────────────────────────────────

  return (
    <>
      {!isFullscreen && (
        <motion.button whileHover={{ scale: 1.1, boxShadow: '0 0 30px rgba(0,255,136,0.4)' }} whileTap={{ scale: 0.9 }} onClick={() => {
          const isMobile = window.innerWidth < 768;
          if (isMobile && !isOpen) { setIsFullscreen(true); setIsOpen(true); }
          else { setIsOpen(!isOpen); }
        }}
          className="fixed right-6 w-14 h-14 rounded-full flex items-center justify-center z-[50]"
          style={{ bottom: 'calc(1.5rem + 25px)', background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`, color: '#000', boxShadow: `0 0 20px var(--color-glow), 0 4px 16px rgba(0,0,0,0.3)` }}>
          {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          {!isOpen && isDndActive() && <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px]" style={{ background: '#4a4a60', border: '2px solid var(--color-bg)' }}>🔇</span>}
          {!isOpen && unreadTotal > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold font-mono px-1"
            style={{ background: 'linear-gradient(135deg, #ff3b30, #cc0000)', color: '#fff', boxShadow: '0 0 12px rgba(255,59,48,0.5)' }}>{unreadTotal > 99 ? '99+' : unreadTotal}</span>}
        </motion.button>
      )}

      {/* FULLSCREEN */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex" style={{ background: 'var(--color-bg)' }}>
            <div className={`${activeConv ? 'max-sm:hidden' : ''} w-80 max-md:w-56 max-sm:w-full flex flex-col flex-shrink-0`} style={{ background: glassBg, borderRight: glassBorder, backdropFilter: glassBlur }}>
              <button onClick={() => { navigate('/profile'); setIsFullscreen(false); }} className="p-5 hover:bg-white/[0.03] transition-colors text-left" style={{ borderBottom: glassBorder }}>
                <div className="flex items-center gap-3">
                  <Avatar name={user?.fullName} avatar={user?.avatar} size="lg" glow />
                  <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate" style={{ color: '#e0e0e0' }}>{user?.fullName}</p><p className="text-[10px] font-mono" style={{ color: 'var(--color-primary)', textShadow: '0 0 6px rgba(0,255,136,0.3)' }}>{user?.role}</p></div>
                  <button onClick={e => { e.stopPropagation(); setIsFullscreen(false); }} className="p-2 rounded-xl hover:bg-white/5"><Minimize2 className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
                </div>
              </button>
              <div className="px-4 py-3"><input value={convFilter} onChange={e => setConvFilter(e.target.value)} placeholder="Поиск чатов..." className="w-full px-4 py-2.5 rounded-xl nx-input text-xs" /></div>
              <div className="px-4 pb-3 flex gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setShowUserSearch(true); setSearchQuery(''); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-mono text-xs font-bold" style={{ background: 'rgba(0,255,136,0.08)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.15)' }}><UserPlus className="w-3.5 h-3.5" /> ДИАЛОГ</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setShowGroupCreate(true); setSearchQuery(''); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-mono text-xs font-bold" style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}><Users className="w-3.5 h-3.5" /> ГРУППА</motion.button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredConvs.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-xs font-mono" style={{ color: '#4a4a60' }}><MessageCircle className="w-6 h-6 mb-1 opacity-20" /> Нет чатов</div> : filteredConvs.map(conv => <ConversationItem key={conv.id} conv={conv} active={activeConv?.id === conv.id} />)}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              {activeConv ? (
                <><ChatHeader conv={activeConv} /><div className="flex-1 flex min-h-0"><div className="flex-1 flex flex-col min-w-0">{messagesAreaContent}</div>{showMedia && <MediaPanel mediaTab={mediaTab} setMediaTab={setMediaTab} mediaPhotos={mediaPhotos} mediaFiles={mediaFiles} mediaAudio={mediaAudio} onClose={() => setShowMedia(false)} />}{showMembers && activeConv.isGroup && <MembersPanel groupMembers={groupMembers} users={users} user={user} activeConv={activeConv} onClose={() => setShowMembers(false)} onProfileClick={setProfileModal} />}{showPinned && <PinnedPanel pinnedMessages={pinnedMessages} onClose={() => setShowPinned(false)} />}{showFavorites && <FavoritesPanel favoriteMessages={favoriteMessages} onClose={() => setShowFavorites(false)} />}{showGroupInfo && activeConv.isGroup && <GroupInfoPanel activeConv={activeConv} onClose={() => setShowGroupInfo(false)} onDelete={handleDeleteGroup} />}</div></>
              ) : <div className="flex-1 flex flex-col items-center justify-center"><MessageCircle className="w-20 h-20 mb-4 opacity-5" style={{ color: 'var(--color-primary)' }} /><p className="font-mono text-sm" style={{ color: '#4a4a60' }}>Выберите диалог или начните новый</p></div>}
            </div>
            {showUserSearch && <UserSearchOverlay onSelect={startConversation} title="Найти пользователя..." />}
            {forwardMsg && <ForwardOverlay forwardMsg={forwardMsg} conversations={conversations} onClose={() => setForwardMsg(null)} onForward={handleForward} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* WIDGET */}
      <AnimatePresence>
        {isOpen && !isFullscreen && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed right-4 w-[420px] max-w-[calc(100vw-32px)] h-[600px] max-h-[calc(100vh-140px)] rounded-2xl overflow-hidden z-[50] flex flex-col max-sm:inset-x-2 max-sm:w-auto max-sm:h-[calc(100vh-100px)] max-sm:rounded-xl"
            style={{ bottom: 'calc(6rem + 25px)', background: 'linear-gradient(135deg, rgba(15,15,25,0.95) 0%, rgba(10,10,20,0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}>
            {!activeConv ? (
              <>
                <div className="flex items-center justify-between px-5 py-3.5" style={{ background: glassBg, borderBottom: glassBorder }}>
                  <span className="text-sm font-mono font-bold tracking-wider" style={{ color: 'var(--color-primary)', textShadow: '0 0 10px rgba(0,255,136,0.3)' }}>// ЧАТ</span>
                  <div className="flex items-center gap-1 relative">
                    <button onClick={() => { setShowUserSearch(true); setSearchQuery(''); }} className="p-2 rounded-xl hover:bg-white/5 transition-colors"><Search className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
                    <button onClick={() => setShowSoundSettings(!showSoundSettings)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">{soundEnabled ? <Volume2 className="w-4 h-4" style={{ color: '#6a6a80' }} /> : <VolumeX className="w-4 h-4" style={{ color: '#4a4a60' }} />}</button>
                    <button onClick={() => setIsFullscreen(true)} className="p-2 rounded-xl hover:bg-white/5 transition-colors"><Maximize2 className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
                    {showSoundSettings && <SoundSettingsPanel soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} soundPrivate={soundPrivate} setSoundPrivate={setSoundPrivate} soundGroup={soundGroup} setSoundGroup={setSoundGroup} chatTheme={chatTheme} setChatTheme={setChatTheme} dndEnabled={dndEnabled} setDndEnabled={setDndEnabled} dndStart={dndStart} setDndStart={setDndStart} dndEnd={dndEnd} setDndEnd={setDndEnd} chatWallpaper={chatWallpaper} setChatWallpaper={setChatWallpaper} />}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-xs font-mono gap-4" style={{ color: '#4a4a60' }}>
                      <MessageCircle className="w-12 h-12 opacity-10" style={{ color: 'var(--color-primary)' }} /><span>Нет диалогов</span>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setShowUserSearch(true); setSearchQuery(''); }} className="px-5 py-2.5 rounded-xl font-mono text-xs font-bold" style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,255,136,0.08))', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>НАЧАТЬ ДИАЛОГ</motion.button>
                    </div>
                  ) : filteredConvs.map(conv => <ConversationItem key={conv.id} conv={conv} active={false} />)}
                </div>
              </>
            ) : (
              <><ChatHeader conv={activeConv} />{messagesAreaContent}</>
            )}
            {showUserSearch && <UserSearchOverlay onSelect={startConversation} title="Найти пользователя..." />}
            {forwardMsg && <ForwardOverlay forwardMsg={forwardMsg} conversations={conversations} onClose={() => setForwardMsg(null)} onForward={handleForward} />}
          </motion.div>
        )}
      </AnimatePresence>

      {contextMenu && <ContextMenuOverlay contextMenu={contextMenu} onClose={() => setContextMenu(null)} onReply={msg => { setReplyTo(msg); setContextMenu(null); }} onForward={msg => { setForwardMsg(msg); setContextMenu(null); }} onPin={handlePin} onEdit={msg => { setEditingMsg(msg); setNewMessage(msg.content); setContextMenu(null); }} onDelete={handleDeleteMessage} onReaction={(id, e) => { handleReaction(id, e); setContextMenu(null); }} user={user} />}
      {showPollCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-[200]" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => setShowPollCreate(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-80 rounded-2xl p-5 space-y-3" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><span className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>📊 ОПРОС</span><button onClick={() => setShowPollCreate(false)} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button></div>
            <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Вопрос..." className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" autoFocus />
            {pollOptions.map((opt, i) => (<div key={i} className="flex gap-2"><input value={opt} onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} placeholder={`Вариант ${i + 1}`} className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />{pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="p-2 text-red-400"><X className="w-3 h-3" /></button>}</div>))}
            {pollOptions.length < 6 && <button onClick={() => setPollOptions([...pollOptions, ''])} className="w-full py-1.5 rounded-lg font-mono text-[10px] text-gray-500 hover:bg-white/5 border border-dashed border-gray-700">+ вариант</button>}
            <button onClick={async () => {
              if (!activeConv || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) { showToast('Нужен вопрос и минимум 2 варианта', 'error'); return; }
              try { await chatApi.createPoll(activeConv.id, { question: pollQuestion.trim(), options: pollOptions.filter(o => o.trim()) }); showToast('Опрос создан', 'success'); setShowPollCreate(false); setPollQuestion(''); setPollOptions(['', '']); } catch { showToast('Ошибка', 'error'); }
            }} className="w-full py-2.5 rounded-lg font-mono text-sm font-bold" style={{ background: 'var(--color-primary)', color: '#000' }}>СОЗДАТЬ</button>
          </motion.div>
        </div>
      )}
      {/* More menu portal — outside overflow-hidden container */}
      {showMoreMenu && (
        <motion.div id="chat-more-menu" ref={moreMenuPortalRef} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
          className="fixed rounded-xl p-1.5 w-48"
          style={{ zIndex: 99999, background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          {activeConv?.isGroup && <button onClick={() => { setShowGroupInfo(!showGroupInfo); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/5" style={{ color: '#c0c0d0' }}><Info className="w-3.5 h-3.5" /> Инфо</button>}
          <button onClick={() => { setShowPinned(!showPinned); setShowMedia(false); setShowMembers(false); setShowGroupInfo(false); setShowFavorites(false); setShowMoreMenu(false); if (!showPinned && activeConv) chatApi.getPinnedMessages(activeConv.id).then(r => { if (r.success && r.data) setPinnedMessages(r.data); }).catch(() => {}); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/5" style={{ color: '#c0c0d0' }}><Pin className="w-3.5 h-3.5" /> Закреплённые</button>
          <button onClick={() => { setShowFavorites(!showFavorites); setShowMedia(false); setShowMembers(false); setShowPinned(false); setShowGroupInfo(false); setShowMoreMenu(false); if (!showFavorites && activeConv) chatApi.getFavorites(activeConv.id).then(r => { if (r.success && r.data) setFavoriteMessages(r.data); }).catch(() => {}); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/5" style={{ color: '#c0c0d0' }}>⭐ Избранное</button>
          <button onClick={() => { setShowMedia(!showMedia); setShowMembers(false); setShowPinned(false); setShowGroupInfo(false); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/5" style={{ color: '#c0c0d0' }}><ImageIcon className="w-3.5 h-3.5" /> Медиа</button>
          <button onClick={async () => { setShowMoreMenu(false); if (!activeConv) return; const muted = (activeConv as any).isMuted; try { if (muted) { await chatApi.unmuteConversation(activeConv.id); (activeConv as any).isMuted = 0; showToast('Уведомления включены', 'success'); } else { await chatApi.muteConversation(activeConv.id); (activeConv as any).isMuted = 1; showToast('Чат заглушён', 'success'); } fetchConversations(); } catch { showToast('Ошибка', 'error'); } }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/5" style={{ color: '#c0c0d0' }}>{(activeConv as any)?.isMuted ? <><Volume2 className="w-3.5 h-3.5" /> Включить уведомления</> : <><VolumeX className="w-3.5 h-3.5" /> Заглушить</>}</button>
        </motion.div>
      )}
      <AnimatePresence>{profileModal && <ProfileModalOverlay profileModal={profileModal} onClose={() => setProfileModal(null)} onStartChat={startConversation} user={user} />}</AnimatePresence>
      <AnimatePresence>{showGroupCreate && (
        <motion.div key="group-create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => { setShowGroupCreate(false); setGroupName(''); setGroupMembersIds([]); setSearchQuery(''); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-md max-h-[80vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}
            style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98) 0%, rgba(10,10,20,0.99) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: glassBorder }}>
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 10px rgba(0,255,136,0.3)' }}>НОВАЯ ГРУППА</span>
              <button onClick={() => { setShowGroupCreate(false); setGroupName(''); setGroupMembersIds([]); setSearchQuery(''); }} className="p-1.5 rounded-xl hover:bg-white/5"><X className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
            </div>
            <div className="p-5 space-y-4 flex-shrink-0">
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Название группы..." className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all" style={{ background: 'rgba(0,0,0,0.3)', border: glassBorder, color: '#e0e0e0', fontFamily: "'JetBrains Mono', monospace" }} />
              {groupMembersIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {groupMembersIds.map(id => { const u = users.find(u => u.id === id); return u ? (
                    <motion.span key={id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono" style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>
                      {u.fullName} <button onClick={() => setGroupMembersIds(p => p.filter(x => x !== id))}><X className="w-3 h-3" /></button>
                    </motion.span>
                  ) : null; })}
                </div>
              )}
              <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4a4a60' }} /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Найти участников..." className="w-full pl-10 pr-4 py-2.5 rounded-xl nx-input text-xs" /></div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 min-h-0">
              {filteredUsers.map(u => (
                <button key={u.id} onClick={() => setGroupMembersIds(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id])} className="w-full flex items-center gap-3 py-3 hover:bg-white/[0.03] transition-colors text-left">
                  <Avatar name={u.fullName} avatar={u.avatar} size="sm" />
                  <span className="text-sm flex-1 truncate" style={{ color: '#c0c0d0' }}>{u.fullName}</span>
                  {groupMembersIds.includes(u.id) ? <Check className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> : <UserPlus className="w-4 h-4" style={{ color: '#4a4a60' }} />}
                </button>
              ))}
            </div>
            <div className="p-5 flex-shrink-0" style={{ borderTop: glassBorder }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCreateGroup} disabled={!groupName.trim() || groupMembersIds.length < 1}
                className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-30"
                style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000', boxShadow: groupName.trim() && groupMembersIds.length >= 1 ? glowGreen : 'none' }}>СОЗДАТЬ ГРУППУ ({groupMembersIds.length})</motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      {/* Image zoom overlay */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }} onClick={() => setZoomedImage(null)}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <img loading="lazy" decoding="async" src={zoomedImage} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" style={{ boxShadow: '0 0 40px rgba(0,0,0,0.5)' }} />
              <div className="absolute top-3 right-3 flex gap-2">
                <button onClick={() => { const a = document.createElement('a'); a.href = zoomedImage; a.download = zoomedImage.split('/').pop() || 'image.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }} className="p-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} title="Скачать">
                  <Download className="w-5 h-5 text-white" />
                </button>
                <button onClick={() => setZoomedImage(null)} className="p-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
