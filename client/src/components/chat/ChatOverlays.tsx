import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Reply, Forward, Pin, Edit3, Copy, Trash2, ArrowLeft, MessageCircle } from 'lucide-react';
import { ChatMessage, ChatConversation, User } from '../../types';
import { chatApi, kanbanApi } from '../../services/api';
import { showToast } from '../ui/NexusModal';
import { REACTION_EMOJI, GLASS_BORDER } from './chatConstants';
import { url } from './chatUtils';
import { Avatar } from './chatShared';

// ── Context Menu ──
export function ContextMenuOverlay({ contextMenu, onClose, onReply, onForward, onPin, onEdit, onDelete, onReaction, user }: {
  contextMenu: { x: number; y: number; msg: ChatMessage } | null;
  onClose: () => void;
  onReply: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onPin: (msgId: string) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  onReaction: (msgId: string, emoji: string) => void;
  user: any;
}) {
  if (!contextMenu) return null;
  const { msg } = contextMenu;
  const isMine = msg.senderId === user?.id;

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.9, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute rounded-2xl overflow-hidden py-1.5"
        style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 350), background: 'linear-gradient(135deg, rgba(20,20,35,0.95) 0%, rgba(15,15,25,0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)', minWidth: 190 }}
        onClick={e => e.stopPropagation()}>
        <button onClick={() => { onReply(msg); onClose(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Reply className="w-3.5 h-3.5" /> Ответить</button>
        <button onClick={() => { onForward(msg); onClose(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Forward className="w-3.5 h-3.5" /> Переслать</button>
        <button onClick={() => { onPin(msg.id); onClose(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Pin className="w-3.5 h-3.5" /> Закрепить</button>
        {isMine && msg.type === 'text' && <button onClick={() => { onEdit(msg); onClose(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Edit3 className="w-3.5 h-3.5" /> Редактировать</button>}
        <button onClick={() => { navigator.clipboard.writeText(msg.content); showToast('Скопировано', 'success'); onClose(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}><Copy className="w-3.5 h-3.5" /> Копировать</button>
        <button onClick={async () => { try { await chatApi.addFavorite(msg.id); showToast('Добавлено в избранное', 'success'); } catch {} onClose(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#eab308' }}>⭐ В избранное</button>
        <div className="mx-3 my-1.5 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="px-4 py-2 flex gap-1.5 flex-wrap">
          {REACTION_EMOJI.map(e => <motion.button key={e} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => { onReaction(msg.id, e); onClose(); }} className="text-base hover:bg-white/10 rounded-lg p-1 transition-colors">{e}</motion.button>)}
        </div>
        <div className="mx-3 my-1.5 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <button onClick={async () => {
          try {
            const title = msg.content.slice(0, 80) || 'Задача из чата';
            const res = await kanbanApi.create({ title, description: `Из чата: ${msg.content}` });
            if (res.success) showToast('Задача создана', 'success');
          } catch { showToast('Ошибка', 'error'); }
          onClose();
        }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors" style={{ color: '#c0c0d0' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
          Создать задачу
        </button>
        {(isMine || user?.role === 'super_admin') && <><div className="mx-3 my-1.5 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} /><button onClick={() => { onDelete(msg); onClose(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors" style={{ color: '#ff6b6b' }}><Trash2 className="w-3.5 h-3.5" /> Удалить</button></>}
      </motion.div>
    </div>
  );
}

// ── Forward Overlay ──
export function ForwardOverlay({ forwardMsg, conversations, onClose, onForward }: {
  forwardMsg: ChatMessage | null;
  conversations: ChatConversation[];
  onClose: () => void;
  onForward: (conv: ChatConversation) => void;
}) {
  if (!forwardMsg) return null;
  return (
    <div className="absolute inset-0 flex flex-col z-20" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: GLASS_BORDER }}>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5"><ArrowLeft className="w-4 h-4" style={{ color: '#8a8aa0' }} /></button>
        <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 10px rgba(0,255,136,0.3)' }}>ПЕРЕСЛАТЬ</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map(conv => (
          <button key={conv.id} onClick={() => onForward(conv)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left">
            <Avatar name={conv.otherName} avatar={conv.otherAvatar} size="sm" />
            <span className="text-sm" style={{ color: '#c0c0d0' }}>{conv.otherName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Profile Modal ──
export function ProfileModalOverlay({ profileModal, onClose, onStartChat, user }: {
  profileModal: User | null;
  onClose: () => void;
  onStartChat: (user: User) => void;
  user: any;
}) {
  if (!profileModal) return null;
  const isMe = profileModal.id === user?.id;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98) 0%, rgba(10,10,20,0.99) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}
        onClick={e => e.stopPropagation()}>
        <div className="h-20 relative" style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.2) 0%, rgba(0,212,255,0.15) 50%, rgba(191,0,255,0.1) 100%)' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(10,10,20,0.8) 100%)' }} />
        </div>
        <div className="flex justify-center -mt-10 relative z-10">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden" style={{ border: '3px solid var(--color-bg)', boxShadow: '0 0 20px rgba(0,255,136,0.3)', background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))' }}>
            {profileModal.avatar ? <img loading="lazy" decoding="async" src={url(profileModal.avatar)} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl font-mono font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 12px rgba(0,255,136,0.5)' }}>{profileModal.fullName?.charAt(0) || '?'}</span>}
          </div>
        </div>
        <div className="px-5 py-4 text-center">
          <h3 className="text-lg font-bold font-mono" style={{ color: '#e0e0e0' }}>{profileModal.fullName}</h3>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-primary)', textShadow: '0 0 6px rgba(0,255,136,0.3)' }}>@{profileModal.username}</p>
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold mt-2" style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>{profileModal.role}</span>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          {!isMe && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { onClose(); onStartChat(profileModal); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000' }}>
              <MessageCircle className="w-3.5 h-3.5" /> НАПИСАТЬ
            </motion.button>
          )}
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-mono text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#8a8aa0', border: GLASS_BORDER }}>ЗАКРЫТЬ</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Poll Message ──
export function PollMessage({ msg }: { msg: ChatMessage }) {
  const [pd, setPd] = useState<any>(null);
  useEffect(() => { chatApi.getPollResults(msg.content).then(r => { if (r.success && r.data) setPd(r.data); }).catch(() => {}); }, [msg.content]);
  if (!pd) return <div className="text-[10px] font-mono text-gray-500 py-2">Загрузка...</div>;
  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center gap-2 mb-1"><span>📊</span><span className="font-mono text-sm font-bold text-gray-200">{pd.poll.question}</span></div>
      {pd.results.map((o: any) => { const pct = pd.totalVotes > 0 ? Math.round((o.count / pd.totalVotes) * 100) : 0; return (
        <button key={o.id} onClick={async () => { await chatApi.votePoll(pd.poll.id, o.id); const r = await chatApi.getPollResults(pd.poll.id); if (r.success && r.data) setPd(r.data); }} className="w-full text-left px-3 py-1.5 rounded-lg relative overflow-hidden hover:brightness-110" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="absolute inset-0 rounded-lg" style={{ width: `${pct}%`, background: 'rgba(0,255,136,0.08)' }} />
          <div className="relative flex justify-between"><span className="font-mono text-xs text-gray-300">{o.text}</span><span className="font-mono text-[10px]" style={{ color: '#5a5a70' }}>{pct}%</span></div>
        </button>); })}
      <span className="text-[9px] font-mono text-gray-500">{pd.totalVotes} голосов</span>
    </div>
  );
}