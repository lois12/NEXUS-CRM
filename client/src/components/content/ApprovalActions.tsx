import { useState } from 'react';
import { ContentPost, ContentApproval } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { contentApi } from '../../services/api';
import { showToast } from '../ui/NexusModal';
import { Send, CheckCircle2, AlertTriangle, Shield, Upload } from 'lucide-react';

interface Props {
  post: ContentPost;
  approvals: ContentApproval[];
  onUpdate: () => void;
}

export default function ApprovalActions({ post, approvals, onUpdate }: Props) {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  if (!user) return null;

  const isAuthor = post.authorId === user.id;
  const isManager = user.role === 'super_admin' || user.role === 'руководитель';
  const myApproval = approvals.find(a => a.approverId === user.id);

  const handleAction = async (action: () => Promise<any>, successMsg: string) => {
    setLoading(true);
    try {
      await action();
      showToast(successMsg, 'success');
      onUpdate();
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Author: submit for approval */}
      {post.status === 'черновик' && isAuthor && (
        <button onClick={() => handleAction(() => contentApi.submitForApproval(post.id), 'Отправлено на согласование')}
          disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all"
          style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>
          <Send className="w-3.5 h-3.5" /> НА СОГЛАСОВАНИЕ
        </button>
      )}

      {/* Author: resubmit after revision */}
      {post.status === 'на_доработку' && isAuthor && (
        <button onClick={() => handleAction(() => contentApi.submitForApproval(post.id), 'Отправлено на согласование')}
          disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all"
          style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>
          <Upload className="w-3.5 h-3.5" /> ОТПРАВИТЬ ПОВТОРНО
        </button>
      )}

      {/* Manager: approve / request revision */}
      {post.status === 'запланирован' && isManager && myApproval?.action === 'pending' && (
        <>
          <button onClick={() => handleAction(() => contentApi.approve(post.id, comment), 'Пост согласован')}
            disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all"
            style={{ backgroundColor: 'rgba(0,255,136,0.15)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }}>
            <CheckCircle2 className="w-3.5 h-3.5" /> СОГЛАСОВАТЬ
          </button>
          <button onClick={() => setShowRevisionForm(!showRevisionForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all"
            style={{ backgroundColor: 'rgba(255,59,48,0.15)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.3)' }}>
            <AlertTriangle className="w-3.5 h-3.5" /> НА ДОРАБОТКУ
          </button>
        </>
      )}

      {/* Already approved by this user */}
      {post.status === 'запланирован' && myApproval?.action === 'approved' && (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
          style={{ backgroundColor: 'rgba(0,255,136,0.08)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.15)' }}>
          <CheckCircle2 className="w-3.5 h-3.5" /> ВЫ СОГЛАСОВАЛИ
        </span>
      )}

      {/* Manager: finalize (all approved) */}
      {post.status === 'согласован' && isManager && (
        <button onClick={() => handleAction(() => contentApi.finalize(post.id), 'Пост утверждён')}
          disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all"
          style={{ backgroundColor: 'rgba(191,0,255,0.15)', color: '#bf00ff', border: '1px solid rgba(191,0,255,0.3)' }}>
          <Shield className="w-3.5 h-3.5" /> УТВЕРДИТЬ
        </button>
      )}

      {/* Author or manager: publish */}
      {post.status === 'утверждён' && (isAuthor || isManager) && (
        <button onClick={() => handleAction(() => contentApi.publish(post.id), 'Пост опубликован')}
          disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all"
          style={{ backgroundColor: 'rgba(0,255,136,0.15)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }}>
          <Send className="w-3.5 h-3.5" /> ОПУБЛИКОВАТЬ
        </button>
      )}

      {/* Revision form */}
      {showRevisionForm && (
        <div className="w-full flex gap-2 mt-2">
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Причина доработки..."
            className="flex-1 px-3 py-1.5 rounded-lg nx-input text-xs" />
          <button onClick={() => {
            if (!comment.trim()) { showToast('Укажите причину', 'error'); return; }
            handleAction(() => contentApi.requestRevision(post.id, comment), 'Отправлено на доработку');
            setComment('');
            setShowRevisionForm(false);
          }} disabled={loading} className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
            style={{ backgroundColor: '#ff3b30', color: '#fff' }}>
            ОТПРАВИТЬ
          </button>
        </div>
      )}

      {/* Comment input (for approval comment) */}
      {post.status === 'запланирован' && isManager && myApproval?.action === 'pending' && !showRevisionForm && (
        <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Комментарий (необязательно)..."
          className="flex-1 min-w-[150px] px-3 py-1.5 rounded-lg nx-input text-xs" />
      )}
    </div>
  );
}
