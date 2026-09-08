import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { publicRegApi } from '../services/api';

export default function CancelRegistration() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'confirm' | 'loading' | 'success' | 'error'>('confirm');
  const [error, setError] = useState('');

  const handleCancel = async () => {
    if (!token) { setError('Токен не указан'); setState('error'); return; }
    setState('loading');
    try {
      const res = await publicRegApi.cancelByToken(token);
      if (res.success) setState('success');
      else { setError(res.error || 'Ошибка'); setState('error'); }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Регистрация не найдена');
      setState('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 text-center max-w-md w-full space-y-4">

        {state === 'confirm' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: 'rgba(255,59,48,0.1)', border: '2px solid rgba(255,59,48,0.3)' }}>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="font-mono text-lg font-bold text-gray-200">ОТМЕНИТЬ РЕГИСТРАЦИЮ?</h2>
            <p className="font-mono text-sm text-gray-400">Вы уверены, что хотите отменить свою регистрацию? Это действие нельзя отменить.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => window.history.back()}
                className="flex-1 py-3 rounded-xl font-mono text-sm glass text-gray-400 hover:text-gray-200 transition-colors">
                НЕТ, ОСТАВИТЬ
              </button>
              <button onClick={handleCancel}
                className="flex-1 py-3 rounded-xl font-mono text-sm font-bold transition-all"
                style={{ background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.3)', color: '#ff3b30' }}>
                ДА, ОТМЕНИТЬ
              </button>
            </div>
          </>
        )}

        {state === 'loading' && (
          <div className="w-12 h-12 mx-auto rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        )}

        {state === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto" style={{ color: 'var(--color-primary)' }} />
            <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>РЕГИСТРАЦИЯ ОТМЕНЕНА</h2>
            <p className="font-mono text-sm text-gray-400">Ваша регистрация успешно отменена.</p>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-red-400" />
            <h2 className="font-mono text-lg font-bold text-gray-200">ОШИБКА</h2>
            <p className="font-mono text-sm text-gray-400">{error}</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
