import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Paperclip, Smile, Mic, ArrowLeft, Reply, File as FileIcon, Square, Maximize2, Minimize2, Users, Image as ImageIcon, FileText, UserPlus, Volume2, VolumeX, Check, Search, Pin, Forward, Trash2, Edit3, Copy, Info, MoreHorizontal, Download, ZoomIn, Upload } from 'lucide-react';
import { chatApi, usersApi } from '../../services/api';
import { ChatConversation, ChatMessage, ChatGroupMember, ChatReaction, ChatPinnedMessage, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, getSocket } from '../../services/socket';
import { showToast } from '../ui/NexusModal';
import { useNavigate } from 'react-router-dom';
import { REACTION_EMOJI, SOUNDS, GLASS_BG, GLASS_BORDER, GLASS_BLUR, GLOW_GREEN } from './chatConstants';
import { playSound, url, extractMentions, renderMentions, fmtMsgTime, fmtTime } from './chatUtils';
import GifPicker from './GifPicker';
import EmojiPicker from './EmojiPicker';
import StickerPicker from './StickerPicker';
import { formatLastSeenKR, isTodayKR, isYesterdayKR, formatDateKR } from '../../utils/timezone';

export default function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [chatTheme, setChatTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('nexus_chat_theme') as 'dark' | 'light') || 'dark');
  const [profileModal, setProfileModal] = useState<User | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unreadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);
  const activeConvRef = useRef<ChatConversation | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const prevUnreadRef = useRef(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [soundPrivate, setSoundPrivate] = useState(() => localStorage.getItem('nexus_chat_sound_private') || 'icq');
  const [soundGroup, setSoundGroup] = useState(() => localStorage.getItem('nexus_chat_sound_group') || 'ding');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('nexus_chat_sound') !== 'off');

  useEffect(() => { localStorage.setItem('nexus_chat_sound_private', soundPrivate); }, [soundPrivate]);
  useEffect(() => { localStorage.setItem('nexus_chat_sound_group', soundGroup); }, [soundGroup]);
  useEffect(() => { localStorage.setItem('nexus_chat_sound', soundEnabled ? 'on' : 'off'); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('nexus_chat_theme', chatTheme); }, [chatTheme]);

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

  useEffect(() => { fetchUnreadCount(); unreadPollRef.current = setInterval(fetchUnreadCount, 30000); return () => { if (unreadPollRef.current) clearInterval(unreadPollRef.current); }; }, [fetchUnreadCount]);
  const fetchConversations = useCallback(async () => { try { const res = await chatApi.getConversations(); if (res.success && res.data) setConversations(res.data); } catch {} }, []);
  useEffect(() => { if (isOpen) fetchConversations(); }, [isOpen, fetchConversations]);

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
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (showUserSearch || showGroupCreate) usersApi.getAll().then(res => { if (res.success && res.data) setUsers(res.data); }).catch(() => {}); }, [showUserSearch, showGroupCreate]);
  // Typing indicator — throttle to once per 2s
  useEffect(() => {
    if (!activeConv || !newMessage.trim()) return;
    const now = Date.now();
    if (now - lastTypingRef.current < 2000) return;
    lastTypingRef.current = now;
    chatApi.setTyping(activeConv.id).catch(() => {});
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
        if (soundEnabled && isOpen) {
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
    setActiveConv(conv); activeConvRef.current = conv; setMessages([]); setReplyTo(null); setShowMedia(false); setShowMembers(false); setShowPinned(false); setShowGroupInfo(false); setEditingMsg(null); setForwardMsg(null); setShowMessageSearch(false); setMessageSearch(''); setAttachedFiles([]);
    try { const res = await chatApi.getMessages(conv.id, { limit: 50 }); if (res.success && res.data) setMessages(res.data); } catch {}
    if (conv.isGroup) { try { const res = await chatApi.getGroupMembers(conv.id); if (res.success && res.data) setGroupMembers(res.data); } catch {} }
  };

  const startConversation = async (targetUser: User) => { try { const res = await chatApi.getOrCreateConversation(targetUser.id); if (res.success && res.data) { setShowUserSearch(false); setSearchQuery(''); await fetchConversations(); openConversation(res.data); } } catch { showToast('Ошибка', 'error'); } };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { showToast('Введите название', 'error'); return; }
    if (groupMembersIds.length < 1) { showToast('Добавьте участников', 'error'); return; }
    try { const res = await chatApi.createGroup({ name: groupName, memberIds: groupMembersIds }); if (res.success && res.data) { setShowGroupCreate(false); setGroupName(''); setGroupMembersIds([]); await fetchConversations(); openConversation(res.data); showToast('Группа создана', 'success'); } } catch { showToast('Ошибка', 'error'); }
  };

  const handleSend = async () => {
    if (!activeConv) return;
    if (editingMsg) {
      if (!newMessage.trim()) return;
      try { await chatApi.editMessage(editingMsg.id, newMessage); setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, content: newMessage, editedAt: new Date().toISOString() } : m)); setEditingMsg(null); setNewMessage(''); } catch { showToast('Ошибка', 'error'); }
      return;
    }

    const hasText = newMessage.trim().length > 0;
    const hasFiles = attachedFiles.length > 0;
    if (!hasText && !hasFiles) return;

    const mentionedIds = extractMentions(newMessage, users);
    const baseOpts = { replyToId: replyTo?.id, mentionedUserIds: mentionedIds.length > 0 ? mentionedIds.join(',') : undefined };

    try {
      // Send each file with caption on the last one (or the only one)
      if (hasFiles) {
        for (let i = 0; i < attachedFiles.length; i++) {
          const f = attachedFiles[i];
          const isLast = i === attachedFiles.length - 1;
          const caption = isLast && hasText ? newMessage.trim() : undefined;
          await chatApi.sendMessage(activeConv.id, { content: f.url, type: f.type, ...baseOpts, caption });
        }
      } else if (hasText) {
        // Text only, no files
        await chatApi.sendMessage(activeConv.id, { content: newMessage, type: 'text', ...baseOpts });
      }
      // Message will be added via socket 'chat:message' event
      setNewMessage('');
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

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`Файл слишком большой: ${file.name}`, 'error');
        continue;
      }
      await handleFileUpload(file);
    }
  }, [activeConv, handleFileUpload]);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Запись аудио требует HTTPS или localhost', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];
      let mimeType = ''; for (const mt of mimeTypes) { if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; } }
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const ext = mimeType.split('/')[1] || 'webm';
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' }); const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType || 'audio/webm' }); const conv = activeConvRef.current; if (!conv) return; try { const u = await chatApi.uploadFile(conv.id, file); if (u.success && u.data) { const m = await chatApi.sendMessage(conv.id, { content: u.data.url, type: 'audio' }); if (m.success && m.data) setMessages(p => [...p, m.data!]); } } catch { showToast('Ошибка аудио', 'error'); } };
      mediaRecorderRef.current = recorder; recorder.start(); setIsRecording(true); setRecordTime(0); recordIntervalRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') showToast('Разрешите доступ к микрофону в настройках браузера', 'error');
      else if (err?.name === 'NotFoundError') showToast('Микрофон не найден', 'error');
      else showToast('Ошибка записи: ' + (err?.message || 'Неизвестная'), 'error');
    }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); if (recordIntervalRef.current) clearInterval(recordIntervalRef.current); } };
  const cancelRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.ondataavailable = null; mediaRecorderRef.current.onstop = null; mediaRecorderRef.current.stop(); setIsRecording(false); if (recordIntervalRef.current) clearInterval(recordIntervalRef.current); } };


  const filteredUsers = users.filter(u => u.id !== user?.id && (u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || u.username.toLowerCase().includes(searchQuery.toLowerCase())));
  const filteredConvs = conversations.filter(c => (c.otherName || '').toLowerCase().includes(convFilter.toLowerCase()));
  const filteredMessages = messageSearch ? messages.filter(m => m.type === 'text' && m.content.toLowerCase().includes(messageSearch.toLowerCase())) : messages;
  const mediaPhotos = messages.filter(m => m.type === 'image');
  const mediaFiles = messages.filter(m => m.type === 'file');
  const mediaAudio = messages.filter(m => m.type === 'audio');

  // ─── STYLE ALIASES ──────────────────────────────────────────
  const glassBg = GLASS_BG;
  const glassBorder = GLASS_BORDER;
  const glassBlur = GLASS_BLUR;
  const glowGreen = GLOW_GREEN;

  // ─── SUB-COMPONENTS ──────────────────────────────────────────

  const Avatar = ({ name, avatar, size = 'md', onClick, glow, lastSeen }: { name?: string; avatar?: string; size?: 'sm' | 'md' | 'lg'; onClick?: () => void; glow?: boolean; lastSeen?: string }) => {
    const sz = size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-sm';
    return (
      <div className="relative inline-flex">
        <div onClick={onClick} className={`${sz} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-105' : ''} ${glow ? 'ring-2 ring-offset-1 ring-[var(--color-primary)] ring-offset-[var(--color-bg)]' : ''}`}
          style={{ border: '1.5px solid rgba(255,255,255,0.1)', background: glassBg, backdropFilter: glassBlur, boxShadow: glow ? glowGreen : 'none' }}>
          {avatar ? <img loading="lazy" decoding="async" src={url(avatar)} alt="" className="w-full h-full object-cover" /> : <span className="font-mono font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 8px rgba(0,255,136,0.4)' }}>{name?.charAt(0) || '?'}</span>}
        </div>
        {lastSeen !== undefined && <OnlineBadge lastSeen={lastSeen} size={size === 'sm' ? 'sm' : 'md'} />}
      </div>
    );
  };

  const ConversationItem = ({ conv, active }: { conv: ChatConversation; active: boolean }) => (
    <button onClick={() => openConversation(conv)} className={`w-full flex items-center gap-3 px-4 py-3.5 transition-all duration-200 text-left relative overflow-hidden ${active ? '' : 'hover:bg-white/[0.03]'}`}
      style={active ? { background: 'linear-gradient(135deg, rgba(0,255,136,0.08) 0%, rgba(0,212,255,0.04) 100%)', borderLeft: '2px solid var(--color-primary)' } : { borderLeft: '2px solid transparent' }}>
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
    </button>
  );

  // ─── Online status helper ─────────────────────────────────────
  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 2 * 60 * 1000; // 2 minutes
  };

  const formatLastSeen = (lastSeen?: string) => formatLastSeenKR(lastSeen);

  const OnlineBadge = ({ lastSeen, size = 'sm' }: { lastSeen?: string; size?: 'sm' | 'md' }) => {
    const online = isOnline(lastSeen);
    const sz = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
    return (
      <div className={`${sz} rounded-full absolute -bottom-0.5 -right-0.5`}
        style={{
          background: online ? '#00ff88' : '#4a4a60',
          border: '2px solid var(--color-bg)',
          boxShadow: online ? '0 0 6px rgba(0,255,136,0.5)' : 'none',
        }}
        title={online ? 'В сети' : `Был(а) ${formatLastSeen(lastSeen)}`}
      />
    );
  };

  // ─── Date separator ───────────────────────────────────────────
  const DateSeparator = ({ date }: { date: string }) => {
    let label: string;
    if (isTodayKR(date)) label = 'Сегодня';
    else if (isYesterdayKR(date)) label = 'Вчера';
    else label = formatDateKR(date, { day: 'numeric', month: 'long' });

    return (
      <div className="flex items-center gap-3 py-3">
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <span className="text-[10px] font-mono px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: '#5a5a70', border: '1px solid rgba(255,255,255,0.06)' }}>{label}</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
    );
  };

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
            {!isMine && !isDeleted && msg.type !== 'image' && !isGrouped && <span className="text-[9px] font-mono font-bold block mb-1" style={{ color: '#00d4ff', textShadow: '0 0 6px rgba(0,212,255,0.3)' }}>{msg.senderName}</span>}
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
                {msg.type === 'audio' && <audio controls src={url(msg.content)} className="max-w-[200px] h-8 mb-1" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />}
                {msg.type === 'text' && (
                  // Check if it's a sticker (single emoji or short emoji-only message)
                  /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]{1,4}$/u.test(msg.content.trim()) ? (
                    <div className="sticker-sent text-5xl py-1">{msg.content.trim()}</div>
                  ) : (
                    <p className="text-[14px] whitespace-pre-wrap leading-relaxed" style={{ color: '#d0d0e0' }}>{renderMentions(msg.content, msg.mentionedUserIds || '', users)}</p>
                  )
                )}
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
      return (
        <div key={msg.id}>
          {showDate && <DateSeparator date={msg.createdAt} />}
          <MessageBubble msg={msg} isGrouped={isGrouped} />
        </div>
      );
    })
  ), [filteredMessages, user?.id]);

  const messagesAreaContent = (
    <>
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 relative"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 100%)' }}
        onDragOver={handleChatDragOver} onDragLeave={handleChatDragLeave} onDrop={handleChatDrop}>
        {chatDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,255,136,0.05)', backdropFilter: 'blur(2px)' }}>
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-10 h-10" style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>ПЕРЕТАЩИТЕ ФАЙЛЫ</span>
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
            <EmojiPicker onSelect={(emoji: any) => { setNewMessage(p => p + (emoji.native || emoji)); setShowEmoji(false); }} />
          </motion.div>
        )}
        <AnimatePresence>
          {showGif && (
            <div className="relative mb-3">
              <GifPicker
                onSelect={(gifUrl) => {
                  if (gifUrl.startsWith('http')) {
                    // It's a GIF URL - send as image
                    handleSend();
                    // For now, add to message as text (proper implementation would upload)
                    setNewMessage(gifUrl);
                  } else {
                    // It's an emoji sticker
                    setNewMessage(p => p + gifUrl);
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
                  setNewMessage(emoji);
                  handleSend();
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
        <div className="flex items-center gap-1.5 md:gap-2">
          <input id="chat-file-input" type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
          <button onClick={() => { const el = document.getElementById('chat-file-input'); if (el) el.click(); }} className="p-2 rounded-xl transition-all hover:bg-white/5 flex-shrink-0" style={{ border: glassBorder }}>
            <Paperclip className="w-4 h-4" style={{ color: '#6a6a80' }} />
          </button>
          {/* Desktop: show all buttons. Mobile: hide in More menu */}
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => setShowEmoji(!showEmoji)} className="p-2 rounded-xl transition-all hover:bg-white/5" style={{ border: glassBorder }}><Smile className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
            <button onClick={() => { setShowSticker(!showSticker); setShowEmoji(false); setShowGif(false); }} className="p-2 rounded-xl transition-all hover:bg-white/5" style={{ border: glassBorder }}>
              <span className="text-xs font-bold" style={{ color: showSticker ? 'var(--color-primary)' : '#6a6a80' }}>🎭</span>
            </button>
            <button onClick={() => { setShowGif(!showGif); setShowEmoji(false); setShowSticker(false); }} className="p-2 rounded-xl transition-all hover:bg-white/5" style={{ border: glassBorder }}>
              <span className="text-xs font-bold" style={{ color: showGif ? 'var(--color-primary)' : '#6a6a80' }}>GIF</span>
            </button>
            {!isRecording && <button onClick={startRecording} className="p-2 rounded-xl transition-all hover:bg-white/5" style={{ border: glassBorder }}><Mic className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>}
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
              </motion.div>
            )}
          </div>
          <div className="flex-1 relative min-w-0">
            <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Сообщение..." className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#e0e0e0', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }} />
          </div>
          <button onClick={handleSend} disabled={!newMessage.trim() && attachedFiles.length === 0}
            className="p-2.5 rounded-xl disabled:opacity-30 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000', boxShadow: '0 0 20px var(--color-glow)', opacity: (newMessage.trim() || attachedFiles.length > 0) ? 1 : 0.3 }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  const ContextMenuOverlay = () => {
    if (!contextMenu) return null;
    const { msg } = contextMenu;
    const isMine = msg.senderId === user?.id;
    return (
      <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)}>
        <motion.div initial={{ opacity: 0, scale: 0.9, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute rounded-2xl overflow-hidden py-1.5"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 350), background: 'linear-gradient(135deg, rgba(20,20,35,0.95) 0%, rgba(15,15,25,0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)', minWidth: 190 }}
          onClick={e => e.stopPropagation()}>
          <button onClick={() => { setReplyTo(msg); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Reply className="w-3.5 h-3.5" /> Ответить</button>
          <button onClick={() => { setForwardMsg(msg); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Forward className="w-3.5 h-3.5" /> Переслать</button>
          <button onClick={() => handlePin(msg.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Pin className="w-3.5 h-3.5" /> Закрепить</button>
          {isMine && msg.type === 'text' && <button onClick={() => { setEditingMsg(msg); setNewMessage(msg.content); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Edit3 className="w-3.5 h-3.5" /> Редактировать</button>}
          <button onClick={() => { navigator.clipboard.writeText(msg.content); showToast('Скопировано', 'success'); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Copy className="w-3.5 h-3.5" /> Копировать</button>
          <div className="mx-3 my-1.5 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="px-4 py-2 flex gap-1.5 flex-wrap">
            {REACTION_EMOJI.map(e => <motion.button key={e} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => { handleReaction(msg.id, e); setContextMenu(null); }} className="text-base hover:bg-white/10 rounded-lg p-1 transition-colors">{e}</motion.button>)}
          </div>
          {(isMine || user?.role === 'super_admin') && <><div className="mx-3 my-1.5 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} /><button onClick={() => handleDeleteMessage(msg)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors" style={{ color: '#ff6b6b' }}><Trash2 className="w-3.5 h-3.5" /> Удалить</button></>}
        </motion.div>
      </div>
    );
  };

  const ForwardOverlay = () => {
    if (!forwardMsg) return null;
    return (
      <div className="absolute inset-0 flex flex-col z-20" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: glassBorder }}>
          <button onClick={() => setForwardMsg(null)} className="p-1.5 rounded-xl hover:bg-white/5"><ArrowLeft className="w-4 h-4" style={{ color: '#8a8aa0' }} /></button>
          <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 10px rgba(0,255,136,0.3)' }}>ПЕРЕСЛАТЬ</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <button key={conv.id} onClick={() => handleForward(conv)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left">
              <Avatar name={conv.otherName} avatar={conv.otherAvatar} size="sm" />
              <span className="text-sm" style={{ color: '#c0c0d0' }}>{conv.otherName}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const SidePanel = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
    <div className="w-72 flex flex-col flex-shrink-0" style={{ background: glassBg, borderLeft: glassBorder, backdropFilter: glassBlur }}>
      <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: glassBorder }}>
        <span className="text-[10px] font-mono font-bold tracking-wider" style={{ color: 'var(--color-primary)', textShadow: '0 0 8px rgba(0,255,136,0.3)' }}>{title}</span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><X className="w-3.5 h-3.5" style={{ color: '#6a6a80' }} /></button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );

  const MediaPanel = () => (
    <SidePanel title="МЕДИА" onClose={() => setShowMedia(false)}>
      <div className="flex" style={{ borderBottom: glassBorder }}>
        {([['photos', ImageIcon, 'Фото'], ['files', FileText, 'Файлы'], ['audio', Mic, 'Аудио']] as const).map(([tab, Icon, label]) => (
          <button key={tab} onClick={() => setMediaTab(tab)} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-mono transition-all ${mediaTab === tab ? '' : 'hover:bg-white/[0.03]'}`}
            style={mediaTab === tab ? { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)', background: 'rgba(0,255,136,0.05)' } : { color: '#5a5a70' }}>
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
      </div>
      <div className="p-3">
        {mediaTab === 'photos' && (mediaPhotos.length === 0 ? <EmptyMedia text="Нет фото" /> : <div className="grid grid-cols-3 gap-1.5">{mediaPhotos.map(m => <motion.img key={m.id} whileHover={{ scale: 1.05 }} src={url(m.content)} alt="" className="w-full aspect-square object-cover rounded-xl cursor-pointer" style={{ border: glassBorder }} />)}</div>)}
        {mediaTab === 'files' && (mediaFiles.length === 0 ? <EmptyMedia text="Нет файлов" /> : <div className="space-y-1.5">{mediaFiles.map(m => <a key={m.id} href={url(m.content)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition-colors" style={{ border: glassBorder }}><FileIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#00d4ff' }} /><span className="text-xs truncate" style={{ color: '#c0c0d0' }}>{m.content.split('/').pop()}</span></a>)}</div>)}
        {mediaTab === 'audio' && (mediaAudio.length === 0 ? <EmptyMedia text="Нет аудио" /> : <div className="space-y-2">{mediaAudio.map(m => <div key={m.id} className="px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: glassBorder }}><audio controls src={url(m.content)} className="w-full h-8" style={{ filter: 'invert(1) hue-rotate(180deg)' }} /></div>)}</div>)}
      </div>
    </SidePanel>
  );

  const EmptyMedia = ({ text }: { text: string }) => <div className="flex flex-col items-center justify-center h-24 text-[10px] font-mono" style={{ color: '#4a4a60' }}><ImageIcon className="w-5 h-5 mb-1 opacity-30" />{text}</div>;

  const handleRemoveMember = async (userId: string) => {
    if (!activeConv) return;
    try { await chatApi.removeGroupMember(activeConv.id, userId); setGroupMembers(prev => prev.filter(m => m.userId !== userId)); showToast('Участник удалён', 'success'); } catch { showToast('Ошибка', 'error'); }
  };

  const handlePromoteAdmin = async (userId: string) => {
    if (!activeConv) return;
    try { await chatApi.addGroupMember(activeConv.id, userId); showToast('Назначен админом', 'success'); } catch { showToast('Ошибка', 'error'); }
  };

  const handleDeleteGroup = async () => {
    if (!activeConv) return;
    try {
      await chatApi.updateGroup(activeConv.id, { name: `[Удалено] ${activeConv.name}` });
      showToast('Группа удалена', 'success');
      setActiveConv(null); activeConvRef.current = null; setMessages([]);
      fetchConversations();
    } catch { showToast('Ошибка', 'error'); }
  };

  const MembersPanel = () => {
    const isAdmin = groupMembers.find(m => m.userId === user?.id)?.role === 'admin';
    return (
      <SidePanel title={`УЧАСТНИКИ (${groupMembers.length})`} onClose={() => setShowMembers(false)}>
        {groupMembers.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group">
            <Avatar name={m.fullName} avatar={m.avatar} size="sm" onClick={() => { const u = users.find(u => u.id === m.userId); if (u) setProfileModal(u); else setProfileModal({ id: m.userId, username: '', email: '', role: m.userRole as any, fullName: m.fullName || '', avatar: m.avatar, createdAt: '', updatedAt: '' } as User); }} />
            <div className="flex-1 min-w-0"><span className="text-sm truncate block" style={{ color: '#c0c0d0' }}>{m.fullName}</span><span className="text-[9px] font-mono" style={{ color: '#5a5a70' }}>{m.userRole}</span></div>
            <div className="flex items-center gap-1">
              {m.role === 'admin' && <span className="text-[8px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>admin</span>}
              {isAdmin && m.userId !== user?.id && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {m.role !== 'admin' && <button onClick={() => handlePromoteAdmin(m.userId)} className="p-1 rounded-lg hover:bg-white/5 transition-colors" title="Назначить админом"><UserPlus className="w-3.5 h-3.5" style={{ color: '#00d4ff' }} /></button>}
                  <button onClick={() => handleRemoveMember(m.userId)} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors" title="Удалить"><Trash2 className="w-3.5 h-3.5" style={{ color: '#ff6b6b' }} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </SidePanel>
    );
  };

  const PinnedPanel = () => (
    <SidePanel title={`ЗАКРЕПЛЁННЫЕ (${pinnedMessages.length})`} onClose={() => setShowPinned(false)}>
      <div className="p-3 space-y-2">
        {pinnedMessages.length === 0 ? <p className="text-[10px] font-mono text-center py-6" style={{ color: '#4a4a60' }}>Нет закреплённых</p> : pinnedMessages.map(p => (
          <div key={p.id} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: glassBorder }}>
            <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{p.senderName}</span>
            <p className="text-xs mt-1 truncate" style={{ color: '#c0c0d0' }}>{p.content}</p>
            <button onClick={async () => { await chatApi.unpinMessage(p.messageId); setPinnedMessages(prev => prev.filter(x => x.id !== p.id)); }} className="text-[9px] font-mono mt-2" style={{ color: '#ff6b6b' }}>открепить</button>
          </div>
        ))}
      </div>
    </SidePanel>
  );

  const GroupInfoPanel = () => {
    const [desc, setDesc] = useState(activeConv?.description || '');
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const handleSave = async () => { if (!activeConv) return; setSaving(true); try { await chatApi.updateGroup(activeConv.id, { description: desc }); showToast('Сохранено', 'success'); } catch { showToast('Ошибка', 'error'); } finally { setSaving(false); } };
    return (
      <SidePanel title="ИНФОРМАЦИЯ" onClose={() => setShowGroupInfo(false)}>
        <div className="p-4 space-y-5">
          <div>
            <label className="text-[9px] font-mono tracking-wider block mb-2" style={{ color: '#5a5a70' }}>ОПИСАНИЕ</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none transition-all" style={{ background: 'rgba(0,0,0,0.3)', border: glassBorder, color: '#c0c0d0', fontFamily: "'JetBrains Mono', monospace" }} placeholder="Описание группы..." />
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving} className="mt-2 px-4 py-2 rounded-xl font-mono text-[10px] font-bold" style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000' }}>СОХРАНИТЬ</motion.button>
          </div>
          {activeConv?.inviteLink && (
            <div>
              <label className="text-[9px] font-mono tracking-wider block mb-2" style={{ color: '#5a5a70' }}>ССЫЛКА-ПРИГЛАШЕНИЕ</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-xl text-[10px] font-mono truncate" style={{ background: 'rgba(0,0,0,0.3)', border: glassBorder, color: '#8a8aa0' }}>{window.location.origin}/chat/join/{activeConv.inviteLink}</code>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/chat/join/${activeConv.inviteLink}`); showToast('Скопировано', 'success'); }} className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: glassBorder }}><Copy className="w-3.5 h-3.5" style={{ color: '#6a6a80' }} /></motion.button>
              </div>
            </div>
          )}
          <div style={{ borderTop: glassBorder }} className="pt-4">
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all" style={{ background: 'rgba(255,59,48,0.08)', color: '#ff6b6b', border: '1px solid rgba(255,59,48,0.15)' }}>
                <Trash2 className="w-3.5 h-3.5" /> УДАЛИТЬ ГРУППУ
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-center" style={{ color: '#ff6b6b' }}>Вы уверены? Это действие необратимо.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-3 py-2 rounded-xl font-mono text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#8a8aa0', border: glassBorder }}>ОТМЕНА</button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDeleteGroup} className="flex-1 px-3 py-2 rounded-xl font-mono text-xs font-bold" style={{ background: 'linear-gradient(135deg, #ff3b30, #cc0000)', color: '#fff' }}>УДАЛИТЬ</motion.button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidePanel>
    );
  };

  const ProfileModalOverlay = () => {
    if (!profileModal) return null;
    const isMe = profileModal.id === user?.id;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setProfileModal(null)}>
        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98) 0%, rgba(10,10,20,0.99) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}
          onClick={e => e.stopPropagation()}>
          {/* Banner */}
          <div className="h-20 relative" style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.2) 0%, rgba(0,212,255,0.15) 50%, rgba(191,0,255,0.1) 100%)' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(10,10,20,0.8) 100%)' }} />
          </div>
          {/* Avatar */}
          <div className="flex justify-center -mt-10 relative z-10">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden" style={{ border: '3px solid var(--color-bg)', boxShadow: '0 0 20px rgba(0,255,136,0.3)', background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))' }}>
              {profileModal.avatar ? <img loading="lazy" decoding="async" src={url(profileModal.avatar)} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl font-mono font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 12px rgba(0,255,136,0.5)' }}>{profileModal.fullName?.charAt(0) || '?'}</span>}
            </div>
          </div>
          {/* Info */}
          <div className="px-5 py-4 text-center">
            <h3 className="text-lg font-bold font-mono" style={{ color: '#e0e0e0' }}>{profileModal.fullName}</h3>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-primary)', textShadow: '0 0 6px rgba(0,255,136,0.3)' }}>@{profileModal.username}</p>
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold mt-2" style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>{profileModal.role}</span>
          </div>
          {/* Actions */}
          <div className="px-5 pb-5 flex gap-2">
            {!isMe && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setProfileModal(null); startConversation(profileModal); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000' }}>
                <MessageCircle className="w-3.5 h-3.5" /> НАПИСАТЬ
              </motion.button>
            )}
            <button onClick={() => setProfileModal(null)} className="flex-1 px-4 py-2.5 rounded-xl font-mono text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#8a8aa0', border: glassBorder }}>ЗАКРЫТЬ</button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const SoundSettingsPanel = () => (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute bottom-16 right-0 w-60 rounded-2xl overflow-hidden py-2" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.95) 0%, rgba(15,15,25,0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9999 }}>
      <div className="px-4 py-2 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-wider" style={{ color: '#5a5a70' }}>ЗВУК</span>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg hover:bg-white/5">{soundEnabled ? <Volume2 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> : <VolumeX className="w-4 h-4" style={{ color: '#4a4a60' }} />}</button>
        </div>
        {soundEnabled && (<>
          <div><span className="text-[9px] font-mono block mb-1.5" style={{ color: '#4a4a60' }}>Личные</span><div className="flex flex-wrap gap-1">{SOUNDS.map(s => <button key={s.id} onClick={() => { setSoundPrivate(s.id); playSound(s.id); }} className="px-2.5 py-1 rounded-lg text-[9px] font-mono transition-all" style={soundPrivate === s.id ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' } : { color: '#5a5a70', border: '1px solid transparent' }}>{s.name}</button>)}</div></div>
          <div><span className="text-[9px] font-mono block mb-1.5" style={{ color: '#4a4a60' }}>Группы</span><div className="flex flex-wrap gap-1">{SOUNDS.map(s => <button key={s.id} onClick={() => { setSoundGroup(s.id); playSound(s.id); }} className="px-2.5 py-1 rounded-lg text-[9px] font-mono transition-all" style={soundGroup === s.id ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' } : { color: '#5a5a70', border: '1px solid transparent' }}>{s.name}</button>)}</div></div>
          <div><span className="text-[9px] font-mono block mb-1.5" style={{ color: '#4a4a60' }}>Тема</span><div className="flex gap-1">{(['dark', 'light'] as const).map(t => <button key={t} onClick={() => setChatTheme(t)} className="flex-1 px-2.5 py-1.5 rounded-lg text-[9px] font-mono transition-all" style={chatTheme === t ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' } : { color: '#5a5a70', border: '1px solid transparent' }}>{t === 'dark' ? 'Тёмная' : 'Светлая'}</button>)}</div></div>
        </>)}
      </div>
    </motion.div>
  );

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
        {typingUsers.length > 0 && <span className="text-[9px] font-mono" style={{ color: '#00d4ff' }}>{typingUsers.map(t => t.name).join(', ')} печатает...</span>}
      </div>
      <div className="flex items-center gap-1">
        {showMessageSearch ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="absolute top-full left-0 right-0 mt-1 mx-2 rounded-xl overflow-hidden z-50" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98) 0%, rgba(10,10,20,0.99) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: glassBorder }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
              <input value={messageSearch} onChange={e => setMessageSearch(e.target.value)} autoFocus placeholder="Поиск сообщений..." className="flex-1 bg-transparent text-sm outline-none font-mono" style={{ color: '#e0e0e0' }} />
              <button onClick={() => { setShowMessageSearch(false); setMessageSearch(''); }} className="p-1 rounded-lg hover:bg-white/5"><X className="w-3.5 h-3.5" style={{ color: '#6a6a80' }} /></button>
            </div>
            {messageSearch && filteredMessages.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                {filteredMessages.slice(0, 10).map(m => (
                  <button key={m.id} onClick={() => { setShowMessageSearch(false); setMessageSearch(''); messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="w-full flex items-start gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors text-left">
                    <span className="text-[9px] font-mono mt-0.5 flex-shrink-0" style={{ color: '#5a5a70' }}>{m.senderName}</span>
                    <span className="text-xs truncate" style={{ color: '#8a8aa0' }}>{m.content}</span>
                  </button>
                ))}
              </div>
            )}
            {messageSearch && filteredMessages.length === 0 && <div className="px-3 py-3 text-center text-[10px] font-mono" style={{ color: '#4a4a60' }}>Не найдено</div>}
          </motion.div>
        ) : <button onClick={() => setShowMessageSearch(true)} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Поиск"><Search className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>}
        {conv.isGroup && <button onClick={() => { setShowGroupInfo(!showGroupInfo); setShowMedia(false); setShowMembers(false); setShowPinned(false); }} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Информация"><Info className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>}
        <button onClick={() => { setShowPinned(!showPinned); setShowMedia(false); setShowMembers(false); setShowGroupInfo(false); if (!showPinned && activeConv) chatApi.getPinnedMessages(activeConv.id).then(r => { if (r.success && r.data) setPinnedMessages(r.data); }).catch(() => {}); }} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Закреплённые"><Pin className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
        <button onClick={() => { setShowMedia(!showMedia); setShowMembers(false); setShowPinned(false); setShowGroupInfo(false); }} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Медиа"><ImageIcon className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>
        {conv.isGroup && <button onClick={() => { setShowMembers(!showMembers); setShowMedia(false); setShowPinned(false); setShowGroupInfo(false); }} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Участники"><Users className="w-4 h-4" style={{ color: '#6a6a80' }} /></button>}
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
                <><ChatHeader conv={activeConv} /><div className="flex-1 flex min-h-0"><div className="flex-1 flex flex-col min-w-0">{messagesAreaContent}</div>{showMedia && <MediaPanel />}{showMembers && activeConv.isGroup && <MembersPanel />}{showPinned && <PinnedPanel />}{showGroupInfo && activeConv.isGroup && <GroupInfoPanel />}</div></>
              ) : <div className="flex-1 flex flex-col items-center justify-center"><MessageCircle className="w-20 h-20 mb-4 opacity-5" style={{ color: 'var(--color-primary)' }} /><p className="font-mono text-sm" style={{ color: '#4a4a60' }}>Выберите диалог или начните новый</p></div>}
            </div>
            {showUserSearch && <UserSearchOverlay onSelect={startConversation} title="Найти пользователя..." />}
            {forwardMsg && <ForwardOverlay />}
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
                    {showSoundSettings && <SoundSettingsPanel />}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-xs font-mono gap-4" style={{ color: '#4a4a60' }}>
                      <MessageCircle className="w-12 h-12 opacity-10" style={{ color: 'var(--color-primary)' }} /><span>Нет диалогов</span>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setShowUserSearch(true); setSearchQuery(''); }} className="px-5 py-2.5 rounded-xl font-mono text-xs font-bold" style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,255,136,0.08))', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>НАЧАТЬ ДИАЛОГ</motion.button>
                    </div>
                  ) : conversations.map(conv => <ConversationItem key={conv.id} conv={conv} active={false} />)}
                </div>
              </>
            ) : (
              <><ChatHeader conv={activeConv} />{messagesAreaContent}</>
            )}
            {showUserSearch && <UserSearchOverlay onSelect={startConversation} title="Найти пользователя..." />}
            {forwardMsg && <ForwardOverlay />}
          </motion.div>
        )}
      </AnimatePresence>

      {contextMenu && <ContextMenuOverlay />}
      <AnimatePresence>{profileModal && <ProfileModalOverlay />}</AnimatePresence>
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
