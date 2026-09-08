import { useState, useEffect } from 'react';
import { ContentComment } from '../../types';
import { contentApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../ui/NexusModal';
import { MessageSquare, Send, Trash2 } from 'lucide-react';

export default function PostComments({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    contentApi.getComments(postId).then(res => {
      if (res.success && res.data) setComments(res.data);
    }).catch(() => {});
  }, [postId]);

  const handleAdd = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const res = await contentApi.addComment(postId, newComment);
      if (res.success && res.data) {
        setComments(prev => [...prev, res.data!]);
        setNewComment('');
      }
    } catch { showToast('Ошибка', 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await contentApi.deleteComment(id);
      setComments(prev => prev.filter(c => c.id !== id));
    } catch { showToast('Ошибка', 'error'); }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-mono font-bold" style={{ color: 'var(--color-text-secondary)' }}>
        <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
        КОММЕНТАРИИ ({comments.length})
      </div>

      {/* Comment list */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {c.authorAvatar ? (
                <img loading="lazy" decoding="async" src={c.authorAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[8px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
                  {c.authorName?.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-gray-300">{c.authorName}</span>
                <span className="text-[9px] font-mono text-gray-600">{formatTime(c.createdAt)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap">{c.content}</p>
            </div>
            {(c.authorId === user?.id || user?.role === 'super_admin') && (
              <button onClick={() => handleDelete(c.id)} className="p-1 rounded hover:bg-white/5 text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-[10px] font-mono text-gray-600 text-center py-2">Нет комментариев</p>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input value={newComment} onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Написать комментарий..." className="flex-1 px-3 py-2 rounded-lg nx-input text-xs" />
        <button onClick={handleAdd} disabled={loading || !newComment.trim()}
          className="p-2 rounded-lg transition-all disabled:opacity-30"
          style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
