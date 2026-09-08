import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Link2, Unlink, Send, Paperclip, FileText, Image as ImageIcon, File, Download, ZoomIn } from 'lucide-react';
import { Idea, IdeaLink, IdeaType, IDEA_TYPE_CONFIG } from '../../types';
import { ideasApi } from '../../services/api';

interface Comment { id: string; ideaId: string; content: string; authorId: string; authorName?: string; createdAt: string; }
interface Attachment { id: string; ideaId: string; filename: string; url: string; mimeType?: string; size: number; createdAt: string; }

export interface IdeaSidebarProps {
  idea: Idea | null;
  allIdeas: Idea[];
  connectedIdeas: Idea[];
  links: IdeaLink[];
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onUnlink: (linkId: string) => void;
  onNavigateToIdea: (id: string) => void;
  breadcrumb: { id: string; title: string }[];
  onBreadcrumbClick: (id: string | null) => void;
  isFullscreen?: boolean;
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return <File className="w-4 h-4" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

function IdeaSidebarContent({
  idea, connectedIdeas, links,
  onClose, onUpdate, onUnlink, onNavigateToIdea,
}: {
  idea: Idea;
  connectedIdeas: Idea[];
  links: IdeaLink[];
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Idea>) => void;
  onUnlink: (linkId: string) => void;
  onNavigateToIdea: (id: string) => void;
}) {
  const [type, setType] = useState<IdeaType>(idea.type);
  const [color, setColor] = useState(idea.color);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setType(idea.type);
    setColor(idea.color);
    loadComments(idea.id);
    loadAttachments(idea.id);
  }, [idea?.id]);

  const loadComments = async (id: string) => {
    try { const r = await ideasApi.getComments(id); if (r.success && r.data) setComments(r.data); } catch (e) {}
  };
  const loadAttachments = async (id: string) => {
    try { const r = await ideasApi.getAttachments(id); if (r.success && r.data) setAttachments(r.data); } catch (e) {}
  };
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try { const r = await ideasApi.addComment(idea.id, newComment); if (r.success && r.data) { setComments(p => [...p, r.data]); setNewComment(''); } } catch (e) {}
  };
  const handleDeleteComment = async (id: string) => {
    try { await ideasApi.deleteComment(id); setComments(p => p.filter(c => c.id !== id)); } catch (e) {}
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const r = await ideasApi.uploadAttachment(idea.id, file); if (r.success && r.data) setAttachments(p => [r.data, ...p]); } catch (e) {}
    finally { setUploading(false); e.target.value = ''; }
  };
  const handleDeleteAttachment = async (id: string) => {
    try { await ideasApi.deleteAttachment(id); setAttachments(p => p.filter(a => a.id !== id)); } catch (e) {}
  };
  const handleTypeChange = (newType: IdeaType) => {
    setType(newType); setColor(IDEA_TYPE_CONFIG[newType].color);
    onUpdate(idea.id, { type: newType, color: IDEA_TYPE_CONFIG[newType].color });
  };
  const handleNavigate = (id: string) => { onClose(); onNavigateToIdea(id); };

  // Find nearest connected idea
  const nearestIdea = connectedIdeas.length > 0 ? connectedIdeas[0] : null;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: idea.color, boxShadow: `0 0 6px ${idea.color}60` }} />
          <h2 className="text-sm font-bold font-mono text-gray-200 truncate">{idea.title}</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick actions bar */}
      <div className="flex gap-2 px-4 py-2 border-b border-white/5">
        {nearestIdea && (
          <button onClick={() => handleNavigate(nearestIdea.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all hover:scale-105"
            style={{ background: `${nearestIdea.color}20`, color: nearestIdea.color, border: `1px solid ${nearestIdea.color}30` }}>
            → {nearestIdea.title}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Type + Color */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono mb-1" style={{ color: 'var(--color-primary)' }}>// ТИП</label>
            <select value={type} onChange={(e) => handleTypeChange(e.target.value as IdeaType)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-200">
              {(Object.entries(IDEA_TYPE_CONFIG) as [IdeaType, { label: string; color: string }][]).map(([t, c]) => (
                <option key={t} value={t}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono mb-1" style={{ color: 'var(--color-primary)' }}>// ЦВЕТ</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => { setColor(e.target.value); onUpdate(idea.id, { color: e.target.value }); }}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-none" />
              <span className="text-xs font-mono text-gray-400">{color}</span>
            </div>
          </div>
        </div>

        {/* Connected nodes */}
        {connectedIdeas.length > 0 && (
          <div>
            <label className="block text-xs font-mono mb-2 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
              <Link2 className="w-3 h-3" />// СВЯЗИ ({connectedIdeas.length})
            </label>
            <div className="space-y-1.5">
              {connectedIdeas.map(connected => {
                const link = links.find(l => (l.sourceId === idea.id && l.targetId === connected.id) || (l.sourceId === connected.id && l.targetId === idea.id));
                return (
                  <div key={connected.id} onClick={() => handleNavigate(connected.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                    style={{ borderLeft: `3px solid ${connected.color}` }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: connected.color }} />
                    <span className="text-xs text-gray-200 truncate flex-1">{connected.title}</span>
                    <span className="text-[10px] font-mono" style={{ color: connected.color }}>{IDEA_TYPE_CONFIG[connected.type]?.label}</span>
                    {link && (
                      <button onClick={(e) => { e.stopPropagation(); onUnlink(link.id); }}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all">
                        <Unlink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attachments */}
        <div>
          <label className="block text-xs font-mono mb-2 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
            <Paperclip className="w-3 h-3" />// ВЛОЖЕНИЯ ({attachments.length})
          </label>
          <div className="space-y-1.5">
            {attachments.map(att => {
              const isImage = att.mimeType?.startsWith('image/');
              return (
                <div key={att.id} className="rounded-lg bg-white/5 overflow-hidden group">
                  {/* Image preview */}
                  {isImage && (
                    <div className="relative cursor-pointer" onClick={() => setZoomedImage(att.url)}>
                      <img loading="lazy" decoding="async" src={att.url} alt={att.filename}
                        className="w-full h-32 object-cover transition-opacity hover:opacity-80" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  )}
                  {/* File info */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    {getFileIcon(att.mimeType)}
                    <span className="text-xs text-gray-200 truncate flex-1">{att.filename}</span>
                    <a href={att.url} download className="p-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-all">
                      <Download className="w-3 h-3" />
                    </a>
                    <button onClick={() => handleDeleteAttachment(att.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg glass font-mono text-xs text-gray-400 hover:text-gray-200 transition-colors">
            <Plus className="w-3.5 h-3.5" />{uploading ? 'ЗАГРУЗКА...' : 'ДОБАВИТЬ ФАЙЛ'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.csv"
            onChange={handleFileUpload} className="hidden" />
        </div>

        {/* Zoomed image overlay */}
        <AnimatePresence>
          {zoomedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }}
              onClick={() => setZoomedImage(null)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative max-w-[90vw] max-h-[90vh]"
                onClick={e => e.stopPropagation()}
              >
                <img loading="lazy" decoding="async" src={zoomedImage} alt=""
                  className="max-w-full max-h-[85vh] rounded-xl object-contain"
                  style={{ boxShadow: '0 0 40px rgba(0,0,0,0.5)' }} />
                <div className="absolute top-3 right-3 flex gap-2">
                  <a href={zoomedImage} download className="p-2 rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                    <Download className="w-5 h-5 text-white" />
                  </a>
                  <button onClick={() => setZoomedImage(null)} className="p-2 rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comments */}
        <div>
          <label className="block text-xs font-mono mb-2 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
            <Send className="w-3 h-3 rotate-45" />// КОММЕНТАРИИ ({comments.length})
          </label>
          <div className="space-y-2 max-h-[150px] overflow-y-auto">
            {comments.map(c => (
              <div key={c.id} className="px-3 py-2 rounded-lg bg-white/5 group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-gray-400">{c.authorName || 'Аноним'}</span>
                  <button onClick={() => handleDeleteComment(c.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-sm text-gray-200">{c.content}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              placeholder="// КОММЕНТАРИЙ..."
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-200" />
            <button onClick={handleAddComment} disabled={!newComment.trim()}
              className="px-3 py-2 rounded-lg font-mono text-xs font-bold transition-all disabled:opacity-30"
              style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Main component — renders as sidebar or fullscreen modal via portal
export default function IdeaSidebar(props: IdeaSidebarProps) {
  const { idea, onClose, isFullscreen = false } = props;

  if (!idea) return null;

  // Fullscreen: centered modal via portal to body
  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-frost rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          style={{ border: `1px solid ${idea.color}30` }}
          onClick={(e) => e.stopPropagation()}>
          <IdeaSidebarContent {...props} idea={idea} />
        </motion.div>
      </div>,
      document.body
    );
  }

  // Default: sidebar panel
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-sm glass-frost z-40 flex flex-col"
      style={{ borderLeft: '1px solid var(--color-border)' }}>
      <IdeaSidebarContent {...props} idea={idea} />
    </motion.div>
  );
}
