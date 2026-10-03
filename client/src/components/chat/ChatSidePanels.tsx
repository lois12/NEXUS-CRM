import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ImageIcon, FileText, Mic, File as FileIcon, UserPlus, Trash2, Copy } from 'lucide-react';
import { ChatGroupMember, ChatPinnedMessage, ChatMessage, ChatConversation, User } from '../../types';
import { chatApi } from '../../services/api';
import { showToast } from '../ui/NexusModal';
import { GLASS_BG, GLASS_BORDER, GLASS_BLUR } from './chatConstants';
import { url } from './chatUtils';
import { Avatar } from './chatShared';

// ── SidePanel (container) ──
export function SidePanel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="w-full sm:w-72 flex flex-col flex-shrink-0 absolute sm:relative inset-0 sm:inset-auto z-10 sm:z-auto" style={{ background: GLASS_BG, borderLeft: GLASS_BORDER, backdropFilter: GLASS_BLUR }}>
      <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: GLASS_BORDER }}>
        <span className="text-[10px] font-mono font-bold tracking-wider" style={{ color: 'var(--color-primary)', textShadow: '0 0 8px rgba(0,255,136,0.3)' }}>{title}</span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><X className="w-3.5 h-3.5" style={{ color: '#6a6a80' }} /></button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function EmptyMedia({ text }: { text: string }) {
  return <div className="flex flex-col items-center justify-center h-24 text-[10px] font-mono" style={{ color: '#4a4a60' }}><ImageIcon className="w-5 h-5 mb-1 opacity-30" />{text}</div>;
}

// ── MediaPanel ──
export function MediaPanel({ mediaTab, setMediaTab, mediaPhotos, mediaFiles, mediaAudio, onClose }: {
  mediaTab: 'photos' | 'files' | 'audio'; setMediaTab: (t: 'photos' | 'files' | 'audio') => void;
  mediaPhotos: ChatMessage[]; mediaFiles: ChatMessage[]; mediaAudio: ChatMessage[]; onClose: () => void;
}) {
  return (
    <SidePanel title="МЕДИА" onClose={onClose}>
      <div className="flex" style={{ borderBottom: GLASS_BORDER }}>
        {([['photos', ImageIcon, 'Фото'], ['files', FileText, 'Файлы'], ['audio', Mic, 'Аудио']] as const).map(([tab, Icon, label]) => (
          <button key={tab} onClick={() => setMediaTab(tab)} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-mono transition-all ${mediaTab === tab ? '' : 'hover:bg-white/[0.03]'}`}
            style={mediaTab === tab ? { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)', background: 'rgba(0,255,136,0.05)' } : { color: '#5a5a70' }}>
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
      </div>
      <div className="p-3">
        {mediaTab === 'photos' && (mediaPhotos.length === 0 ? <EmptyMedia text="Нет фото" /> : <div className="grid grid-cols-3 gap-1.5">{mediaPhotos.map(m => <motion.img key={m.id} whileHover={{ scale: 1.05 }} src={url(m.content)} alt="" className="w-full aspect-square object-cover rounded-xl cursor-pointer" style={{ border: GLASS_BORDER }} />)}</div>)}
        {mediaTab === 'files' && (mediaFiles.length === 0 ? <EmptyMedia text="Нет файлов" /> : <div className="space-y-1.5">{mediaFiles.map(m => <a key={m.id} href={url(m.content)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition-colors" style={{ border: GLASS_BORDER }}><FileIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#00d4ff' }} /><span className="text-xs truncate" style={{ color: '#c0c0d0' }}>{m.content.split('/').pop()}</span></a>)}</div>)}
        {mediaTab === 'audio' && (mediaAudio.length === 0 ? <EmptyMedia text="Нет аудио" /> : <div className="space-y-2">{mediaAudio.map(m => <div key={m.id} className="px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: GLASS_BORDER }}><audio controls src={url(m.content)} className="w-full h-8" style={{ filter: 'invert(1) hue-rotate(180deg)' }} /></div>)}</div>)}
      </div>
    </SidePanel>
  );
}

// ── MembersPanel ──
export function MembersPanel({ groupMembers, users, user, activeConv, onClose, onProfileClick }: {
  groupMembers: ChatGroupMember[]; users: User[]; user: any; activeConv: ChatConversation;
  onClose: () => void; onProfileClick: (u: User) => void;
}) {
  const [members, setMembers] = useState(groupMembers);
  const isAdmin = members.find(m => m.userId === user?.id)?.role === 'admin';

  const handleRemove = async (userId: string) => {
    try { await chatApi.removeGroupMember(activeConv.id, userId); setMembers(prev => prev.filter(m => m.userId !== userId)); showToast('Участник удалён', 'success'); } catch { showToast('Ошибка', 'error'); }
  };
  const handlePromote = async (userId: string) => {
    try { await chatApi.addGroupMember(activeConv.id, userId); showToast('Назначен админом', 'success'); } catch { showToast('Ошибка', 'error'); }
  };

  return (
    <SidePanel title={`УЧАСТНИКИ (${members.length})`} onClose={onClose}>
      {members.map(m => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group">
          <Avatar name={m.fullName} avatar={m.avatar} size="sm" onClick={() => { const u = users.find(u => u.id === m.userId); if (u) onProfileClick(u); else onProfileClick({ id: m.userId, username: '', email: '', role: m.userRole as any, fullName: m.fullName || '', avatar: m.avatar, createdAt: '', updatedAt: '' } as User); }} />
          <div className="flex-1 min-w-0"><span className="text-sm truncate block" style={{ color: '#c0c0d0' }}>{m.fullName}</span><span className="text-[9px] font-mono" style={{ color: '#5a5a70' }}>{m.userRole}</span></div>
          <div className="flex items-center gap-1">
            {m.role === 'admin' && <span className="text-[8px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>admin</span>}
            {isAdmin && m.userId !== user?.id && (
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {m.role !== 'admin' && <button onClick={() => handlePromote(m.userId)} className="p-1 rounded-lg hover:bg-white/5 transition-colors" title="Назначить админом"><UserPlus className="w-3.5 h-3.5" style={{ color: '#00d4ff' }} /></button>}
                <button onClick={async () => { try { await chatApi.muteMember(activeConv.id, m.userId); showToast(`${m.fullName} замучен`, 'success'); } catch { showToast('Ошибка', 'error'); } }} className="p-1 rounded-lg hover:bg-white/5 transition-colors" title="Замутить">🔇</button>
                <button onClick={() => handleRemove(m.userId)} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors" title="Удалить"><Trash2 className="w-3.5 h-3.5" style={{ color: '#ff6b6b' }} /></button>
              </div>
            )}
          </div>
        </div>
      ))}
    </SidePanel>
  );
}

// ── PinnedPanel ──
export function PinnedPanel({ pinnedMessages, onClose }: { pinnedMessages: ChatPinnedMessage[]; onClose: () => void }) {
  const [pinned, setPinned] = useState(pinnedMessages);
  return (
    <SidePanel title={`ЗАКРЕПЛЁННЫЕ (${pinned.length})`} onClose={onClose}>
      <div className="p-3 space-y-2">
        {pinned.length === 0 ? <p className="text-[10px] font-mono text-center py-6" style={{ color: '#4a4a60' }}>Нет закреплённых</p> : pinned.map(p => (
          <div key={p.id} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: GLASS_BORDER }}>
            <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{p.senderName}</span>
            <p className="text-xs mt-1 truncate" style={{ color: '#c0c0d0' }}>{p.content}</p>
            <button onClick={async () => { await chatApi.unpinMessage(p.messageId); setPinned(prev => prev.filter(x => x.id !== p.id)); }} className="text-[9px] font-mono mt-2" style={{ color: '#ff6b6b' }}>открепить</button>
          </div>
        ))}
      </div>
    </SidePanel>
  );
}

// ── FavoritesPanel ──
export function FavoritesPanel({ favoriteMessages, onClose }: { favoriteMessages: ChatMessage[]; onClose: () => void }) {
  const [favs, setFavs] = useState(favoriteMessages);
  return (
    <SidePanel title={`ИЗБРАННОЕ (${favs.length})`} onClose={onClose}>
      <div className="p-3 space-y-2">
        {favs.length === 0 ? <p className="text-[10px] font-mono text-center py-6" style={{ color: '#4a4a60' }}>Нет избранных</p> : favs.map(m => (
          <div key={m.id} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: GLASS_BORDER }}>
            <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{m.senderName}</span>
            <p className="text-xs mt-1 truncate" style={{ color: '#c0c0d0' }}>{m.type === 'text' ? m.content : `[${m.type}]`}</p>
            <button onClick={async () => { await chatApi.removeFavorite(m.id); setFavs(prev => prev.filter(x => x.id !== m.id)); }} className="text-[9px] font-mono mt-2" style={{ color: '#ff6b6b' }}>убрать</button>
          </div>
        ))}
      </div>
    </SidePanel>
  );
}

// ── GroupInfoPanel ──
export function GroupInfoPanel({ activeConv, onClose, onDelete, onLeave, isAdmin }: {
  activeConv: ChatConversation; onClose: () => void; onDelete: () => void; onLeave: () => void; isAdmin: boolean;
}) {
  const [desc, setDesc] = useState(activeConv?.description || '');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleSave = async () => { if (!activeConv) return; setSaving(true); try { await chatApi.updateGroup(activeConv.id, { description: desc }); showToast('Сохранено', 'success'); } catch { showToast('Ошибка', 'error'); } finally { setSaving(false); } };

  return (
    <SidePanel title="ИНФОРМАЦИЯ" onClose={onClose}>
      <div className="p-4 space-y-5">
        <div>
          <label className="text-[9px] font-mono tracking-wider block mb-2" style={{ color: '#5a5a70' }}>ОПИСАНИЕ</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none transition-all" style={{ background: 'rgba(0,0,0,0.3)', border: GLASS_BORDER, color: '#c0c0d0', fontFamily: "'JetBrains Mono', monospace" }} placeholder="Описание группы..." />
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving} className="mt-2 px-4 py-2 rounded-xl font-mono text-[10px] font-bold" style={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000' }}>СОХРАНИТЬ</motion.button>
        </div>
        {activeConv?.inviteLink && (
          <div>
            <label className="text-[9px] font-mono tracking-wider block mb-2" style={{ color: '#5a5a70' }}>ССЫЛКА-ПРИГЛАШЕНИЕ</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-xl text-[10px] font-mono truncate" style={{ background: 'rgba(0,0,0,0.3)', border: GLASS_BORDER, color: '#8a8aa0' }}>{window.location.origin}/chat/join/{activeConv.inviteLink}</code>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/chat/join/${activeConv.inviteLink}`); showToast('Скопировано', 'success'); }} className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: GLASS_BORDER }}><Copy className="w-3.5 h-3.5" style={{ color: '#6a6a80' }} /></motion.button>
            </div>
          </div>
        )}
        <div style={{ borderTop: GLASS_BORDER }} className="pt-4 space-y-2">
          {isAdmin ? (
            !showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all" style={{ background: 'rgba(255,59,48,0.08)', color: '#ff6b6b', border: '1px solid rgba(255,59,48,0.15)' }}>
                <Trash2 className="w-3.5 h-3.5" /> УДАЛИТЬ ГРУППУ
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-center" style={{ color: '#ff6b6b' }}>Вы уверены? Это действие необратимо.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-3 py-2 rounded-xl font-mono text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#8a8aa0', border: GLASS_BORDER }}>ОТМЕНА</button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onDelete} className="flex-1 px-3 py-2 rounded-xl font-mono text-xs font-bold" style={{ background: 'linear-gradient(135deg, #ff3b30, #cc0000)', color: '#fff' }}>УДАЛИТЬ</motion.button>
                </div>
              </div>
            )
          ) : (
            <button onClick={onLeave} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all" style={{ background: 'rgba(234,179,8,0.08)', color: '#eab308', border: '1px solid rgba(234,179,8,0.15)' }}>
              ВЫЙТИ ИЗ ГРУППЫ
            </button>
          )}
        </div>
      </div>
    </SidePanel>
  );
}