import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Smartphone, Loader2 } from 'lucide-react';
import { qrAuthApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function QRConfirm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'noauth' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Токен не указан');
      setStatus('error');
      return;
    }

    // Wait for auth to finish loading
    if (authLoading) return;

    if (!user) {
      setStatus('noauth');
      return;
    }

    // User is logged in — auto-confirm
    handleAutoConfirm();
  }, [token, user, authLoading]);

  const handleAutoConfirm = async () => {
    if (!token) return;
    setStatus('loading');
    try {
      const res = await qrAuthApi.confirm(token);
      if (res.success) {
        setStatus('success');
        try { navigator.vibrate?.([100, 50, 100]); } catch {}
        setTimeout(() => navigate('/'), 2000);
      } else {
        setError(res.error || 'Ошибка подтверждения');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка');
      setStatus('error');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#ff3b30' }} />
          <p className="font-mono text-sm" style={{ color: '#ff6b6b' }}>Неверная ссылка</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
      >
        <div className="p-6 text-center">
          {/* Logo */}
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}>
            <Smartphone className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
          </div>

          <h1 className="text-lg font-bold font-mono mb-2" style={{ color: 'var(--color-primary)' }}>NEXUS CRM</h1>

          {status === 'loading' && (
            <div className="py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
              <p className="text-sm font-mono" style={{ color: '#8a8aa0' }}>
                {authLoading ? 'Проверка авторизации...' : 'Подтверждение входа...'}
              </p>
            </div>
          )}

          {status === 'noauth' && (
            <div className="py-6">
              <p className="text-sm font-mono mb-4" style={{ color: '#c0c0d0' }}>Для подтверждения входа нужно авторизоваться</p>
              <button onClick={() => navigate(`/login?returnTo=${encodeURIComponent(`/qr-confirm?token=${token}`)}`)}
                className="w-full py-3 rounded-xl font-mono text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#000' }}>
                ВОЙТИ
              </button>
            </div>
          )}

          {status === 'success' && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-8">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: '#00ff88' }} />
              <p className="text-sm font-mono" style={{ color: '#00ff88' }}>Вход подтверждён!</p>
              <p className="text-xs font-mono mt-1" style={{ color: '#5a5a70' }}>Десктоп авторизован</p>
            </motion.div>
          )}

          {status === 'error' && (
            <div className="py-6">
              <XCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#ff3b30' }} />
              <p className="text-sm font-mono" style={{ color: '#ff6b6b' }}>{error}</p>
              <button onClick={handleAutoConfirm}
                className="mt-4 px-4 py-2 rounded-xl font-mono text-xs"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#8a8aa0', border: '1px solid rgba(255,255,255,0.08)' }}>
                Попробовать снова
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
