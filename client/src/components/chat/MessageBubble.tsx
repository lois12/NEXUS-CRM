import { Reply, File as FileIcon, Forward, MoreHorizontal, Download, ZoomIn } from 'lucide-react';
import { ChatMessage, User } from '../../types';
import { url, renderMentions, fmtMsgTime } from './chatUtils';
import { useAuth } from '../../context/AuthContext';

interface Props {
  msg: ChatMessage;
  isGrouped?: boolean;
  users: User[];
  onReply: (msg: ChatMessage) => void;
  onContextMenu: (msg: ChatMessage, x: number, y: number) => void;
  onZoom: (url: string) => void;
}

export default function MessageBubble({ msg, isGrouped, users, onReply, onContextMenu, onZoom }: Props) {
  const { user } = useAuth();
  const isMine = msg.senderId === user?.id;
  const isDeleted = msg.deleted === 1;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(msg, e.clientX, e.clientY);
  };

  // Check if content is a sticker (single emoji)
  const isSticker = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]{1,4}$/u.test(msg.content?.trim() || '');

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}
      onContextMenu={handleContextMenu}>
      <div className={msg.type === 'image' && !msg.caption ? 'max-w-[70%] overflow-hidden rounded-2xl' : 'max-w-[80%] max-sm:max-w-[90%]'}>
        {/* Forwarded */}
        {msg.forwardedFrom && (
          <div className="mb-1 px-3 py-1.5 rounded-xl text-[9px] font-mono flex items-center gap-1.5" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}>
            <Forward className="w-3 h-3" /> Переслано от {msg.forwardedFrom}
          </div>
        )}

        {/* Reply */}
        {msg.replyToContent && (
          <div className="mb-1 px-3 py-1.5 rounded-xl text-[9px] font-mono truncate" style={{ background: 'rgba(0,255,136,0.05)', borderLeft: '2.5px solid var(--color-primary)', color: '#8a8aa0' }}>
            <span style={{ color: 'var(--color-primary)' }}>{msg.replyToSenderName}</span>: {msg.replyToContent}
          </div>
        )}

        {/* Bubble */}
        <div className={`relative ${isMine ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md'} ${isDeleted ? 'opacity-40' : ''} ${msg.type === 'image' && !msg.caption ? 'p-1' : 'px-3.5 py-2.5'}`}
          style={{
            background: isMine ? 'linear-gradient(135deg, rgba(0,255,136,0.15) 0%, rgba(0,212,255,0.1) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
            border: `1px solid ${isMine ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.08)'}`,
            backdropFilter: 'blur(12px)',
            boxShadow: isMine ? '0 4px 16px rgba(0,255,136,0.1)' : '0 4px 12px rgba(0,0,0,0.15)',
          }}>
          {/* Sender name (group chats) */}
          {!isMine && !isDeleted && msg.type !== 'image' && !isGrouped && (
            <span className="text-[9px] font-mono font-bold block mb-1" style={{ color: '#00d4ff', textShadow: '0 0 6px rgba(0,212,255,0.3)' }}>{msg.senderName}</span>
          )}

          {isDeleted ? (
            <p className="text-xs italic" style={{ color: '#5a5a70' }}>Сообщение удалено</p>
          ) : (
            <>
              {/* Image */}
              {msg.type === 'image' && (
                <div className="relative group/img" style={{ display: 'inline-block' }}>
                  <img loading="lazy" decoding="async" src={url(msg.content)} alt="" onClick={() => onZoom(url(msg.content))}
                    className="rounded-xl cursor-pointer hover:opacity-90 transition-opacity" style={{ display: 'block', maxWidth: '100%', maxHeight: 300, width: 'auto', height: 'auto', objectFit: 'contain' }} />
                  {!isMine && <span className="absolute top-1.5 left-1.5 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)', color: '#00d4ff', backdropFilter: 'blur(4px)' }}>{msg.senderName}</span>}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                    <button onClick={() => onZoom(url(msg.content))} className="p-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}><ZoomIn className="w-3.5 h-3.5 text-white" /></button>
                    <a href={url(msg.content)} download className="p-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}><Download className="w-3.5 h-3.5 text-white" /></a>
                  </div>
                  {msg.caption && <div className="mx-3 mt-2 mb-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />}
                  {msg.caption && <div className="px-3 pb-1.5"><p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: '#d0d0e0' }}>{renderMentions(msg.caption, msg.mentionedUserIds || '', users)}</p></div>}
                  <div className="flex items-center justify-end gap-1 px-2 pb-1">
                    <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{fmtMsgTime(msg.createdAt)}</span>
                    {isMine && <span className="text-[11px] font-mono" style={{ color: msg.isRead ? '#00d4ff' : 'rgba(255,255,255,0.4)' }}>✓✓</span>}
                  </div>
                </div>
              )}

              {/* Non-image */}
              {msg.type !== 'image' && (
                <>
                  {msg.type === 'file' && (() => {
                    const fileName = msg.caption || msg.content.split('/').pop() || 'Файл';
                    return <a href={url(msg.content)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-mono mb-1 px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}><FileIcon className="w-4 h-4 flex-shrink-0" /> <span className="truncate max-w-[180px]">{fileName}</span></a>;
                  })()}
                  {msg.type === 'audio' && <audio controls src={url(msg.content)} className="max-w-[200px] h-8 mb-1" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />}
                  {msg.type === 'text' && (
                    isSticker ? (
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
                </>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {!isDeleted && (
          <div className={`flex items-center gap-2 mt-1.5 ${isMine ? 'justify-end' : ''}`}>
            <button onClick={() => onReply(msg)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all hover:bg-white/5" style={{ color: '#6a6a80' }}>
              <Reply className="w-3 h-3" /> ответить
            </button>
            <button onClick={(e) => { e.stopPropagation(); onContextMenu(msg, e.clientX, e.clientY); }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all hover:bg-white/5" style={{ color: '#6a6a80' }}>
              <MoreHorizontal className="w-3 h-3" /> ещё
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
