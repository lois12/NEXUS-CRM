import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { qrAuthApi } from '../../services/api';

function playNotification(type: 'scan' | 'confirm') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'scan') {
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.frequency.value = 1320;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {}

  try { navigator.vibrate?.(type === 'scan' ? 100 : [100, 50, 100]); } catch {}
}

interface QRLoginProps {
  onLogin: (token: string, user: any) => void;
}

export default function QRLogin({ onLogin }: QRLoginProps) {
  const [qrData, setQrData] = useState<{ token: string; url: string; expiresAt: number } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'scanned' | 'confirmed' | 'expired' | 'error'>('idle');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<string>('idle');

  const generateQR = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const res = await qrAuthApi.generate();
      if (res.success && res.data) {
        setQrData(res.data);
        setStatus('ready');
        startPolling(res.data.token);
      }
    } catch {
      setError('Ошибка генерации QR-кода');
      setStatus('error');
    }
  }, []);

  const startPolling = useCallback((token: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    prevStatusRef.current = 'ready';
    pollRef.current = setInterval(async () => {
      try {
        const res = await qrAuthApi.status(token);
        if (res.success && res.data) {
          const { status: s, token: authToken, user } = res.data;
          if (s === 'scanned' && prevStatusRef.current !== 'scanned') {
            setStatus('scanned');
            playNotification('scan');
          } else if (s === 'confirmed' && authToken && user) {
            setStatus('confirmed');
            playNotification('confirm');
            clearInterval(pollRef.current!);
            setTimeout(() => onLogin(authToken, user), 500);
          } else if (s === 'expired') {
            setStatus('expired');
            clearInterval(pollRef.current!);
          }
          prevStatusRef.current = s;
        }
      } catch {}
    }, 2000);
  }, [onLogin]);

  useEffect(() => {
    generateQR();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [generateQR]);

  const handleRefresh = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    generateQR();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 mb-2">
        <Smartphone className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
        <span className="text-xs font-mono" style={{ color: '#8a8aa0' }}>ВХОД ЧЕРЕЗ ТЕЛЕФОН</span>
      </div>

      <AnimatePresence mode="wait">
        {status === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="w-48 h-48 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
          </motion.div>
        )}

        {status === 'ready' && qrData && (
          <motion.div key="ready" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="relative">
            <div className="p-4 rounded-2xl" style={{ background: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
              <QRCodeSVG value={qrData.url} size={180} level="M" fgColor="#000" bgColor="#fff" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--color-primary)', color: '#000' }}>
              <Smartphone className="w-3 h-3" />
            </div>
          </motion.div>
        )}

        {status === 'scanned' && (
          <motion.div key="scanned" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="w-48 h-48 rounded-2xl flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)' }}>
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <Smartphone className="w-10 h-10" style={{ color: '#00d4ff' }} />
            </motion.div>
            <span className="text-xs font-mono" style={{ color: '#00d4ff' }}>Подтвердите на телефоне</span>
          </motion.div>
        )}

        {status === 'confirmed' && (
          <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="w-48 h-48 rounded-2xl flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }}>
            <CheckCircle2 className="w-12 h-12" style={{ color: '#00ff88' }} />
            <span className="text-xs font-mono" style={{ color: '#00ff88' }}>Вход выполнен!</span>
          </motion.div>
        )}

        {(status === 'expired' || status === 'error') && (
          <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="w-48 h-48 rounded-2xl flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(255,59,48,0.05)', border: '1px solid rgba(255,59,48,0.15)' }}>
            <XCircle className="w-10 h-10" style={{ color: '#ff3b30' }} />
            <span className="text-xs font-mono" style={{ color: '#ff6b6b' }}>{error || 'QR-код истёк'}</span>
            <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono" style={{ background: 'rgba(255,255,255,0.05)', color: '#8a8aa0', border: '1px solid rgba(255,255,255,0.08)' }}>
              <RefreshCw className="w-3 h-3" /> Обновить
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {status === 'ready' && (
        <p className="text-[10px] font-mono text-center max-w-[200px]" style={{ color: '#4a4a60' }}>
          Отсканируйте камерой телефона и подтвердите вход
        </p>
      )}
    </div>
  );
}
