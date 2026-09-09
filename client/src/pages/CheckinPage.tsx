import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, Clock } from 'lucide-react';
import { publicRegApi } from '../services/api';

export default function CheckinPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'info' | 'confirmed' | 'already' | 'error'>('loading');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setError('Токен не указан'); return; }
    const fetch = async () => {
      try {
        const res = await publicRegApi.checkinGet(token);
        if (res.success && res.data) {
          setData(res.data);
          if (res.data.status === 'confirmed') {
            setState('already');
          } else {
            setState('info');
          }
        }
      } catch (e: any) {
        setError(e?.response?.data?.error || 'QR-код не найден');
        setState('error');
      }
    };
    fetch();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    try {
      const res = await publicRegApi.checkinPost(token);
      if (res.success && res.data) {
        setData((prev: any) => ({ ...prev, status: 'confirmed' }));
        if (res.data.alreadyCheckedIn) {
          setState('already');
        } else {
          setState('confirmed');
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка подтверждения');
      setState('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 text-center max-w-md w-full space-y-4">

        {state === 'loading' && (
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        )}

        {state === 'error' && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-red-400" />
            <h2 className="font-mono text-lg font-bold text-gray-200">ОШИБКА</h2>
            <p className="font-mono text-sm text-gray-400">{error}</p>
          </>
        )}

        {state === 'info' && data && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.1)', border: '2px solid rgba(0,212,255,0.3)' }}>
              <span className="font-mono text-2xl font-bold" style={{ color: '#00d4ff' }}>?</span>
            </div>
            <h2 className="font-mono text-lg font-bold text-gray-200">{data.contactName || 'Участник'}</h2>
            <div className="space-y-1 text-sm font-mono text-gray-400">
              <p>Email: {data.contactEmail || '—'}</p>
              <p>Телефон: {data.contactPhone || '—'}</p>
            </div>
            <div className="rounded-xl p-3 text-left" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}>
              <p className="font-mono text-xs text-gray-500 mb-1">Мероприятие:</p>
              <p className="font-mono text-sm font-bold text-gray-200">{data.regTitle}</p>
              {data.eventDate && <p className="font-mono text-xs text-gray-400">{data.eventDate} {data.eventTime}</p>}
              {data.location && <p className="font-mono text-xs text-gray-400">{data.location}</p>}
            </div>
            <button onClick={handleConfirm}
              className="w-full py-3 rounded-xl font-mono text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#000' }}>
              ПОДТВЕРДИТЬ ПРИСУТСТВИЕ
            </button>
          </>
        )}

        {state === 'confirmed' && data && (
          <>
            <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 mx-auto flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(0,255,136,0.08)', border: '2px solid rgba(0,255,136,0.3)', boxShadow: '0 0 30px rgba(0,255,136,0.2), inset 0 0 20px rgba(0,255,136,0.05)' }}>
              <svg viewBox="0 0 120 120" width="40" height="40">
                <polygon points="60,8 108,32 108,88 60,112 12,88 12,32" fill="none" stroke="#00ff88" strokeWidth="3" opacity="0.6"/>
                <polygon points="60,20 96,38 96,82 60,100 24,82 24,38" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.3"/>
                <path d="M48,50 L56,70 L72,45 L60,65 L52,55 Z" fill="#00ff88" opacity="0.8"/>
                <circle cx="60" cy="58" r="3" fill="#00ff88"/>
              </svg>
            </motion.div>
            <h2 className="font-mono text-xl font-bold" style={{ color: 'var(--color-primary)', textShadow: '0 0 20px rgba(0,255,136,0.4)' }}>ПОДТВЕРЖДЕНО</h2>
            <p className="font-mono text-sm text-gray-200">{data.contactName}</p>
            <p className="font-mono text-xs text-gray-400">{data.regTitle}</p>
          </>
        )}

        {state === 'already' && data && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.08)', border: '2px solid rgba(234,179,8,0.3)' }}>
              <Clock className="w-8 h-8" style={{ color: '#eab308' }} />
            </div>
            <h2 className="font-mono text-lg font-bold" style={{ color: '#eab308' }}>УЖЕ ПОДТВЕРЖДЕНО</h2>
            <p className="font-mono text-sm text-gray-200">{data.contactName}</p>
            {data.updatedAt && <p className="font-mono text-xs text-gray-400">Время: {new Date(data.updatedAt).toLocaleString('ru-RU')}</p>}
          </>
        )}
      </motion.div>
    </div>
  );
}
