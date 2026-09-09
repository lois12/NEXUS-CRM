import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, CheckCircle, Clock, XCircle, Users, Type, Upload } from 'lucide-react';
import { registrationsApi, publicRegApi } from '../services/api';
import { Registration } from '../types';

type ScanResult = { type: 'confirmed' | 'already' | 'error'; data?: any; message: string } | null;

export default function CheckinScanner() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [result, setResult] = useState<ScanResult>(null);
  const [fullscreen, setFullscreen] = useState<ScanResult>(null);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registrationsApi.getAll().then(res => {
      if (res.success && res.data) setRegistrations(res.data.filter((r: any) => r.status === 'active'));
    });
  }, []);

  // Auto-dismiss fullscreen after 3 seconds
  useEffect(() => {
    if (fullscreen) {
      const timer = setTimeout(() => setFullscreen(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [fullscreen]);

  const startScanner = async () => {
    if (!containerRef.current) return;
    setScanning(true);
    setResult(null);
    setCameraError('');

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      await new Promise(r => setTimeout(r, 200));

      // Check if element exists in DOM
      const el = document.getElementById('checkin-scanner');
      if (!el) {
        setCameraError('Элемент сканера не найден');
        setScanning(false);
        return;
      }

      const scanner = new Html5Qrcode('checkin-scanner');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        async (decodedText: string) => {
          try { await scanner.stop(); } catch {}
          scannerRef.current = null;
          setScanning(false);
          await handleScan(decodedText);
        },
        () => {} // ignore scan errors
      );
    } catch (err: any) {
      setScanning(false);
      scannerRef.current = null;
      const msg = String(err?.message || err || '');
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Доступ к камере запрещён. Разрешите в настройках.');
      } else if (msg.includes('NotFoundError') || msg.includes('not found') || msg.includes('No camera')) {
        setCameraError('Камера не найдена. Используйте загрузку фото или ручной ввод.');
      } else if (msg.includes('insecure') || msg.includes('HTTPS')) {
        setCameraError('Камера требует HTTPS. Используйте ручной ввод.');
      } else {
        setCameraError('Камера недоступна. Используйте загрузку фото или ручной ввод.');
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // File-based QR scanning fallback
  const handleFileScan = async (file: File) => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('checkin-scanner-temp');
      const result = await scanner.scanFile(file, true);
      await handleScan(result);
    } catch {
      setResult({ type: 'error', message: 'QR-код не найден на изображении' });
      setFullscreen({ type: 'error', message: 'QR-код не найден на изображении' });
    }
  };

  const handleScan = async (token: string) => {
    try {
      const match = token.match(/\/reg\/checkin\/([a-f0-9-]+)/);
      const checkinToken = match ? match[1] : token;

      const getRes = await publicRegApi.checkinGet(checkinToken);
      if (!getRes.success || !getRes.data) {
        const errResult: ScanResult = { type: 'error', message: 'НЕВЕРНЫЙ QR-КОД ДОСТУПА' };
        setResult(errResult);
        setFullscreen(errResult);
        return;
      }

      const sub = getRes.data;
      if (sub.status === 'cancelled') {
        const errResult: ScanResult = { type: 'error', message: 'Заявка отменена' };
        setResult(errResult);
        setFullscreen(errResult);
        return;
      }

      if (sub.status === 'waitlist') {
        const errResult: ScanResult = { type: 'error', message: `${sub.contactName} — в листе ожидания` };
        setResult(errResult);
        setFullscreen(errResult);
        return;
      }

      if (sub.status === 'confirmed') {
        const alreadyResult: ScanResult = { type: 'already', data: sub, message: `${sub.contactName} — уже подтверждён` };
        setResult(alreadyResult);
        setFullscreen(alreadyResult);
        return;
      }

      const postRes = await publicRegApi.checkinPost(checkinToken);
      if (postRes.success && postRes.data) {
        const successResult: ScanResult = { type: 'confirmed', data: { ...sub, ...postRes.data }, message: `${sub.contactName} — ПОДТВЕРЖДЁН` };
        setResult(successResult);
        setFullscreen(successResult);
      }
    } catch (e: any) {
      const errResult: ScanResult = { type: 'error', message: e?.response?.data?.error || 'Ошибка сканирования' };
      setResult(errResult);
      setFullscreen(errResult);
    }
  };

  const handleManualSubmit = () => {
    if (!manualToken.trim()) return;
    handleScan(manualToken.trim());
    setManualToken('');
  };

  const resultColors = { confirmed: '#00ff88', already: '#eab308', error: '#ff3b30' };
  const resultIcons = { confirmed: CheckCircle, already: Clock, error: XCircle };

  return (
    <div className="space-y-6">
      {/* Fullscreen notification overlay */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{
              background: fullscreen.type === 'confirmed'
                ? 'radial-gradient(circle, rgba(0,255,136,0.15) 0%, rgba(0,0,0,0.9) 70%)'
                : fullscreen.type === 'already'
                ? 'radial-gradient(circle, rgba(234,179,8,0.12) 0%, rgba(0,0,0,0.9) 70%)'
                : 'radial-gradient(circle, rgba(255,59,48,0.15) 0%, rgba(0,0,0,0.9) 70%)',
            }}
            onClick={() => setFullscreen(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="text-center space-y-4 max-w-sm"
            >
              {(() => {
                const Icon = resultIcons[fullscreen.type];
                const color = resultColors[fullscreen.type];
                return (
                  <>
                    <Icon className="w-24 h-24 mx-auto" style={{ color, filter: `drop-shadow(0 0 20px ${color})` }} />
                    <h2 className="font-mono text-2xl font-bold" style={{ color, textShadow: `0 0 20px ${color}` }}>
                      {fullscreen.type === 'confirmed' ? 'ПОДТВЕРЖДЕНО' : fullscreen.type === 'already' ? 'УЖЕ ПОДТВЕРЖДЕНО' : 'ОШИБКА'}
                    </h2>
                    {fullscreen.data && (
                      <>
                        <p className="font-mono text-lg text-gray-200">{fullscreen.data.contactName}</p>
                        <p className="font-mono text-sm text-gray-400">{fullscreen.data.regTitle}</p>
                      </>
                    )}
                    {!fullscreen.data && (
                      <p className="font-mono text-sm text-gray-400">{fullscreen.message}</p>
                    )}
                    <p className="font-mono text-[10px] text-gray-600">нажмите чтобы закрыть</p>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <Camera className="w-7 h-7 md:w-8 md:h-8" /> СКАНЕР QR
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// ПОДТВЕРЖДЕНИЕ УЧАСТИЯ</p>
        </div>
      </div>

      {/* Registration selector */}
      <div className="glass rounded-xl p-4">
        <label className="font-mono text-xs text-gray-500 mb-2 block">МЕРОПРИЯТИЕ</label>
        <select value={selectedReg?.id || ''} onChange={e => {
          const reg = registrations.find(r => r.id === e.target.value);
          setSelectedReg(reg || null);
        }}
          className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]">
          <option value="">-- Выберите мероприятие --</option>
          {registrations.map(r => (
            <option key={r.id} value={r.id}>{r.title} {r.eventDate ? `(${r.eventDate})` : ''}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scanner */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>КАМЕРА</h2>

          {/* Camera container */}
          <div id="checkin-scanner" ref={containerRef} className="rounded-xl overflow-hidden" style={{ minHeight: scanning ? 280 : 0 }} />

          {/* Camera error */}
          {cameraError && (
            <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
              <p className="font-mono text-xs text-red-400">{cameraError}</p>
            </div>
          )}

          {/* Camera buttons */}
          <div className="flex gap-2">
            {!scanning ? (
              <button onClick={startScanner}
                className="flex-1 py-3 rounded-xl font-mono text-sm font-bold transition-all"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                <Camera className="w-4 h-4 inline mr-2" /> ЗАПУСТИТЬ КАМЕРУ
              </button>
            ) : (
              <button onClick={stopScanner}
                className="flex-1 py-3 rounded-xl font-mono text-sm font-bold glass transition-all text-red-400">
                <X className="w-4 h-4 inline mr-2" /> ОСТАНОВИТЬ
              </button>
            )}
          </div>

          {/* File upload fallback */}
          <div className="border-t border-white/5 pt-3">
            <p className="font-mono text-[10px] text-gray-500 mb-2">ИЛИ ЗАГРУЗИТЕ ФОТО QR-КОДА:</p>
            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="font-mono text-xs text-gray-400">ЗАГРУЗИТЬ ИЗОБРАЖЕНИЕ</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileScan(file);
                e.target.value = '';
              }} />
            </label>
          </div>

          {/* Manual input */}
          <div className="border-t border-white/5 pt-3">
            <p className="font-mono text-[10px] text-gray-500 mb-2">ИЛИ ВВЕДИТЕ ТОКЕН ВРУЧНУЮ:</p>
            <div className="flex gap-2">
              <input value={manualToken} onChange={e => setManualToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder="// checkin-token"
                className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
              <button onClick={handleManualSubmit}
                className="px-4 py-2 rounded-lg font-mono text-xs font-bold"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
                <Type className="w-3.5 h-3.5 inline mr-1" /> OK
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px]">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <Camera className="w-16 h-16 mx-auto mb-4 opacity-20 text-gray-500" />
                <p className="font-mono text-sm text-gray-500">// НАВЕДИТЕ КАМЕРУ НА QR-КОД</p>
                <p className="font-mono text-[10px] text-gray-600 mt-2">или загрузите фото / введите токен</p>
              </motion.div>
            ) : (
              <motion.div key={result.type} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3 w-full">
                {(() => {
                  const Icon = resultIcons[result.type];
                  const color = resultColors[result.type];
                  return (
                    <>
                      <Icon className="w-16 h-16 mx-auto" style={{ color }} />
                      <h3 className="font-mono text-lg font-bold" style={{ color }}>{result.message}</h3>
                      {result.data && (
                        <div className="rounded-xl p-3 text-left space-y-1" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                          <p className="font-mono text-xs text-gray-400">Имя: <span className="text-gray-200">{result.data.contactName || '—'}</span></p>
                          <p className="font-mono text-xs text-gray-400">Email: <span className="text-gray-200">{result.data.contactEmail || '—'}</span></p>
                          <p className="font-mono text-xs text-gray-400">Телефон: <span className="text-gray-200">{result.data.contactPhone || '—'}</span></p>
                          {result.data.regTitle && <p className="font-mono text-xs text-gray-400">Мероприятие: <span className="text-gray-200">{result.data.regTitle}</span></p>}
                        </div>
                      )}
                    </>
                  );
                })()}
                <button onClick={() => { setResult(null); setCameraError(''); }}
                  className="mt-4 px-4 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-colors">
                  СКАНИРОВАТЬ ЕЩЁ
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Quick link to participants */}
      {selectedReg && (
        <div className="text-center">
          <a href={`/registrations/${selectedReg.id}/participants`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10 transition-colors">
            <Users className="w-3.5 h-3.5" /> ВСЕ УЧАСТНИКИ ({selectedReg.confirmedCount || 0})
          </a>
        </div>
      )}

      {/* Hidden container for file scan */}
      <div id="checkin-scanner-temp" className="hidden" />
    </div>
  );
}
