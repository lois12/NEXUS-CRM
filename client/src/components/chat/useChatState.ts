import { useState, useEffect, useRef, useCallback } from 'react';
import { chatApi, usersApi } from '../../services/api';
import { ChatConversation, ChatMessage, ChatGroupMember, ChatPinnedMessage, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, getSocket } from '../../services/socket';
import { showToast } from '../ui/NexusModal';
import { playSound } from './chatUtils';

export function useChatState() {
  const { user } = useAuth();
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
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showSticker, setShowSticker] = useState(false);
  const [chatDragOver, setChatDragOver] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ url: string; type: 'image' | 'file'; name: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [groupMembersIds, setGroupMembersIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: ChatMessage } | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; name: string }[]>([]);
  const [profileModal, setProfileModal] = useState<User | null>(null);
  const [soundPrivate, setSoundPrivate] = useState(() => localStorage.getItem('nexus_chat_sound_private') || 'icq');
  const [soundGroup, setSoundGroup] = useState(() => localStorage.getItem('nexus_chat_sound_group') || 'ding');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('nexus_chat_sound') !== 'off');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<ChatConversation | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const prevUnreadRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unreadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist settings
  useEffect(() => { localStorage.setItem('nexus_chat_sound_private', soundPrivate); }, [soundPrivate]);
  useEffect(() => { localStorage.setItem('nexus_chat_sound_group', soundGroup); }, [soundGroup]);
  useEffect(() => { localStorage.setItem('nexus_chat_sound', soundEnabled ? 'on' : 'off'); }, [soundEnabled]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await chatApi.getUnreadCount();
      if (res.success && res.data) {
        if (res.data.count > prevUnreadRef.current && soundEnabled && !isOpen) playSound(soundPrivate);
        prevUnreadRef.current = res.data.count;
        setUnreadTotal(res.data.count);
      }
    } catch {}
  }, [soundEnabled, soundPrivate, isOpen]);

  useEffect(() => {
    fetchUnreadCount();
    unreadPollRef.current = setInterval(fetchUnreadCount, 30000);
    return () => { if (unreadPollRef.current) clearInterval(unreadPollRef.current); };
  }, [fetchUnreadCount]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try { const res = await chatApi.getConversations(); if (res.success && res.data) setConversations(res.data); } catch {}
  }, []);

  useEffect(() => { if (isOpen) fetchConversations(); }, [isOpen, fetchConversations]);

  // Mark read
  useEffect(() => {
    if (activeConv && isOpen) chatApi.markRead(activeConv.id).then(() => fetchUnreadCount()).catch(() => {});
  }, [activeConv, isOpen, fetchUnreadCount]);

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Fetch users for search/group
  useEffect(() => {
    if (showUserSearch || showGroupCreate) usersApi.getAll().then(res => { if (res.success && res.data) setUsers(res.data); }).catch(() => {});
  }, [showUserSearch, showGroupCreate]);

  // Typing indicator
  useEffect(() => {
    if (!activeConv || !newMessage.trim()) return;
    const now = Date.now();
    if (now - lastTypingRef.current < 2000) return;
    lastTypingRef.current = now;
    chatApi.setTyping(activeConv.id).catch(() => {});
  }, [newMessage, activeConv]);

  // Socket
  useEffect(() => {
    if (!user) return;
    const socket = connectSocket(user.id);
    socketRef.current = socket;
    return () => { socketRef.current = null; };
  }, [user]);

  // Socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleMessage = (msg: ChatMessage) => {
      const conv = activeConvRef.current;
      if (msg.conversationId === conv?.id) {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
      if (msg.senderId !== user?.id) {
        if (soundEnabled && isOpen) playSound(conv?.isGroup || conv?.isGeneral ? soundGroup : soundPrivate);
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

    const handleReaction = (data: { messageId: string; reactions: any[] }) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
    };

    const handleTyping = (data: { userId: string; name: string }) => {
      if (data.userId === user?.id) return;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingUsers(prev => prev.some(t => t.userId === data.userId) ? prev : [...prev, { userId: data.userId, name: data.name }]);
      typingTimeoutRef.current = setTimeout(() => setTypingUsers(prev => prev.filter(t => t.userId !== data.userId)), 3000);
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

  // Socket room join/leave
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConv) return;
    socket.emit('chat:join', activeConv.id);
    return () => { socket.emit('chat:leave', activeConv.id); };
  }, [activeConv?.id]);

  // Open conversation
  const openConversation = async (conv: ChatConversation) => {
    setActiveConv(conv);
    activeConvRef.current = conv;
    setMessages([]);
    setReplyTo(null);
    setShowMedia(false);
    setShowMembers(false);
    setShowPinned(false);
    setShowGroupInfo(false);
    setEditingMsg(null);
    setForwardMsg(null);
    setShowMessageSearch(false);
    setMessageSearch('');
    setAttachedFiles([]);
    try {
      const res = await chatApi.getMessages(conv.id, { limit: 50 });
      if (res.success && res.data) setMessages(res.data);
    } catch {}
    if (conv.isGroup) {
      try { const res = await chatApi.getGroupMembers(conv.id); if (res.success && res.data) setGroupMembers(res.data); } catch {}
    }
  };

  // Start conversation
  const startConversation = async (targetUser: User) => {
    try {
      const res = await chatApi.getOrCreateConversation(targetUser.id);
      if (res.success && res.data) {
        setShowUserSearch(false);
        setSearchQuery('');
        await fetchConversations();
        openConversation(res.data);
      }
    } catch { showToast('Ошибка', 'error'); }
  };

  // Send message
  const handleSend = async () => {
    if (!activeConv) return;
    if (editingMsg) {
      if (!newMessage.trim()) return;
      try {
        await chatApi.editMessage(editingMsg.id, newMessage);
        setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: newMessage, editedAt: new Date().toISOString() } : m));
        setEditingMsg(null);
        setNewMessage('');
      } catch { showToast('Ошибка', 'error'); }
      return;
    }

    const hasText = newMessage.trim().length > 0;
    const hasFiles = attachedFiles.length > 0;
    if (!hasText && !hasFiles) return;

    const mentionedIds = extractMentionsSimple(newMessage, users);
    const baseOpts = { replyToId: replyTo?.id, mentionedUserIds: mentionedIds.length > 0 ? mentionedIds.join(',') : undefined };

    try {
      if (hasFiles) {
        for (let i = 0; i < attachedFiles.length; i++) {
          const f = attachedFiles[i];
          const isLast = i === attachedFiles.length - 1;
          const caption = isLast && hasText ? newMessage.trim() : undefined;
          await chatApi.sendMessage(activeConv.id, { content: f.url, type: f.type === 'image' ? 'image' : 'file', ...baseOpts, caption });
        }
      } else if (hasText) {
        await chatApi.sendMessage(activeConv.id, { content: newMessage, type: 'text', ...baseOpts });
      }
      setNewMessage('');
      setReplyTo(null);
      setAttachedFiles([]);
    } catch { showToast('Ошибка отправки', 'error'); }
  };

  // File upload
  const handleFileUpload = async (file: File) => {
    if (!activeConv) { showToast('Откройте чат', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast(`Файл слишком большой: ${(file.size / 1024 / 1024).toFixed(1)}MB (макс 5MB)`, 'error'); return; }
    if (attachedFiles.length >= 10) { showToast('Максимум 10 файлов', 'error'); return; }
    try {
      const u = await chatApi.uploadFile(activeConv.id, file);
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

  // Drag-and-drop
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
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { showToast(`Файл слишком большой: ${file.name}`, 'error'); continue; }
      await handleFileUpload(file);
    }
  }, [activeConv, handleFileUpload]);

  // Helpers
  const extractMentionsSimple = (text: string, users: User[]): string[] => {
    const r: string[] = [];
    const re = /@(\w+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const u = users.find(u => u.username.toLowerCase() === m![1].toLowerCase() || u.fullName.toLowerCase().includes(m![1].toLowerCase()));
      if (u) r.push(u.id);
    }
    return r;
  };

  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return '';
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return new Date(lastSeen).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return {
    // State
    user, isOpen, setIsOpen, isFullscreen, setIsFullscreen,
    conversations, activeConv, setActiveConv, messages, setMessages,
    newMessage, setNewMessage, unreadTotal,
    showUserSearch, setShowUserSearch, showGroupCreate, setShowGroupCreate,
    showMedia, setShowMedia, mediaTab, setMediaTab,
    showMembers, setShowMembers, showPinned, setShowPinned,
    showGroupInfo, setShowGroupInfo, groupMembers, pinnedMessages, setPinnedMessages,
    showSoundSettings, setShowSoundSettings, users,
    searchQuery, setSearchQuery, messageSearch, setMessageSearch,
    showMessageSearch, setShowMessageSearch, convFilter, setConvFilter,
    replyTo, setReplyTo, editingMsg, setEditingMsg,
    forwardMsg, setForwardMsg, showEmoji, setShowEmoji,
    showGif, setShowGif, showSticker, setShowSticker,
    chatDragOver, zoomedImage, setZoomedImage,
    attachedFiles, setAttachedFiles, isRecording, setIsRecording,
    recordTime, setRecordTime, groupName, setGroupName,
    groupMembersIds, setGroupMembersIds, contextMenu, setContextMenu,
    typingUsers, profileModal, setProfileModal,
    soundPrivate, setSoundPrivate, soundGroup, setSoundGroup,
    soundEnabled, setSoundEnabled,

    // Refs
    messagesEndRef, messagesContainerRef, activeConvRef, socketRef,
    mediaRecorderRef, audioChunksRef, recordIntervalRef,

    // Functions
    fetchConversations, openConversation, startConversation,
    handleSend, handleFileUpload, handleChatDragOver,
    handleChatDragLeave, handleChatDrop, isOnline, formatLastSeen,
    fetchUnreadCount,
  };
}
