import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Camera, X, CheckCircle, XCircle, Users, Type, Upload, List, Clock } from 'lucide-react';
import { controlApi, publicRegApi } from '../services/api';
import { CyberBackground } from '../components/ui/CyberBackground';

type Tab = 'scan' | 'list';
type ScanResult = { type: 'confirmed' | 'already' | 'error'; data?: any; message: string } | null;

export default function NexusControl() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedReg, setSelectedReg] = useState<any | null>(null);
  const [tab, setTab] = useState<Tab>('scan');
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [result, setResult] = useState<ScanResult>(null);
  const [fullscreen, setFullscreen] = useState<ScanResult>(null);
  const [cameraError, setCameraError] = useState('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    controlApi.getRegistrations().then(res => {
      if (res.success && res.data) setRegistrations(res.data);
    });
  }, []);

  useEffect(() => {
    if (fullscreen) {
      const timer = setTimeout(() => setFullscreen(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [fullscreen]);

  const loadSubmissions = useCallback(async (regId: string) => {
    setLoadingSubs(true);
    try {
      const res = await controlApi.getSubmissions(regId);
      if (res.success && res.data) setSubmissions(res.data);
    } catch { setSubmissions([]); }
    setLoadingSubs(false);
  }, []);

  useEffect(() => {
    if (selectedReg && tab === 'list') loadSubmissions(selectedReg.id);
  }, [selectedReg, tab, loadSubmissions]);

  const startScanner = async () => {
    if (!containerRef.current) return;
    setScanning(true);
    setResult(null);
    setCameraError('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      await new Promise(r => setTimeout(r, 200));
      const el = document.getElementById('nexus-control-scanner');
      if (!el) { setCameraError('Элемент сканера не найден'); setScanning(false); return; }
      const scanner = new Html5Qrcode('nexus-control-scanner');
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
        () => {}
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

  const handleFileScan = async (file: File) => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('nexus-control-scanner-temp');
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
        const errResult: ScanResult = { type: 'error', message: 'УЧАСТНИК НЕ НАЙДЕН' };
        setResult(errResult); setFullscreen(errResult); return;
      }
      const sub = getRes.data;
      if (sub.status === 'cancelled') {
        const errResult: ScanResult = { type: 'error', message: 'Заявка отменена' };
        setResult(errResult); setFullscreen(errResult); return;
      }
      if (sub.status === 'waitlist') {
        const errResult: ScanResult = { type: 'error', message: `${sub.contactName} — в листе ожидания` };
        setResult(errResult); setFullscreen(errResult); return;
      }
      if (sub.status === 'confirmed') {
        const alreadyResult: ScanResult = { type: 'already', data: sub, message: `${sub.contactName} — уже подтверждён` };
        setResult(alreadyResult); setFullscreen(alreadyResult); return;
      }
      const postRes = await publicRegApi.checkinPost(checkinToken);
      if (postRes.success && postRes.data) {
        const successResult: ScanResult = { type: 'confirmed', data: { ...sub, ...postRes.data }, message: `${sub.contactName} — ПОДТВЕРЖДЁН` };
        setResult(successResult); setFullscreen(successResult);
        if (selectedReg) loadSubmissions(selectedReg.id);
      }
    } catch (e: any) {
      const errResult: ScanResult = { type: 'error', message: 'УЧАСТНИК НЕ НАЙДЕН' };
      setResult(errResult); setFullscreen(errResult);
    }
  };

  const handleManualSubmit = async () => {
    const val = manualToken.trim();
    if (!val) return;
    setManualToken('');
    if (/^\d{4}$/.test(val) && selectedReg) {
      try {
        const getRes = await publicRegApi.checkinByCode(selectedReg.id, val);
        if (getRes.success && getRes.data) {
          const sub = getRes.data;
          if (sub.status === 'cancelled') { setResult({ type: 'error', message: 'Заявка отменена' }); setFullscreen({ type: 'error', message: 'Заявка отменена' }); return; }
          if (sub.status === 'confirmed') { setResult({ type: 'already', data: sub, message: `${sub.contactName} — уже подтверждён` }); setFullscreen({ type: 'already', data: sub, message: `${sub.contactName} — уже подтверждён` }); return; }
          if (sub.status === 'waitlist') { setResult({ type: 'error', data: sub, message: `${sub.contactName} — в листе ожидания` }); setFullscreen({ type: 'error', data: sub, message: `${sub.contactName} — в листе ожидания` }); return; }
          const postRes = await publicRegApi.checkinPost(sub.checkinToken);
          if (postRes.success) {
            setResult({ type: 'confirmed', data: sub, message: `${sub.contactName} — ПОДТВЕРЖДЁН` });
            setFullscreen({ type: 'confirmed', data: sub, message: `${sub.contactName} — ПОДТВЕРЖДЁН` });
            if (selectedReg) loadSubmissions(selectedReg.id);
          }
          return;
        }
      } catch {
        setResult({ type: 'error', message: 'Код не найден' });
        setFullscreen({ type: 'error', message: 'Код не найден' });
        return;
      }
    }
    handleScan(val);
  };

  const resultColors = { confirmed: '#00ff88', already: '#eab308', error: '#ff3b30' };
  const resultIcons = { confirmed: CheckCircle, already: Clock, error: XCircle };

  const statusLabel: Record<string, string> = { registered: 'Зарегистрирован', confirmed: 'Подтверждён', waitlist: 'Лист ожидания', cancelled: 'Отменён' };
  const statusColor: Record<string, string> = { registered: '#00d4ff', confirmed: '#00ff88', waitlist: '#eab308', cancelled: '#ff3b30' };

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
      <CyberBackground />

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
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
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="text-center space-y-4 max-w-sm px-4"
            >
              {(() => {
                const Icon = resultIcons[fullscreen.type];
                const color = resultColors[fullscreen.type];
                return (
                  <>
                    {fullscreen.type === 'confirmed' ? (
                      <svg viewBox="0 0 120 120" width="96" height="96" className="mx-auto" style={{ filter: `drop-shadow(0 0 20px ${color})` }}>
                        <polygon points="60,8 108,32 108,88 60,112 12,88 12,32" fill="none" stroke="#00ff88" strokeWidth="3" opacity="0.6"/>
                        <polygon points="60,20 96,38 96,82 60,100 24,82 24,38" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.3"/>
                        <path d="M48,50 L56,70 L72,45 L60,65 L52,55 Z" fill="#00ff88" opacity="0.8"/>
                        <circle cx="60" cy="58" r="3" fill="#00ff88"/>
                      </svg>
                    ) : (
                      <Icon className="w-24 h-24 mx-auto" style={{ color, filter: `drop-shadow(0 0 20px ${color})` }} />
                    )}
                    <h2 className="font-mono text-2xl font-bold" style={{ color, textShadow: `0 0 20px ${color}` }}>
                      {fullscreen.type === 'confirmed' ? 'ПОДТВЕРЖДЕНО' : fullscreen.type === 'already' ? 'УЖЕ ПОДТВЕРЖДЕНО' : 'УЧАСТНИК НЕ НАЙДЕН'}
                    </h2>
                    {fullscreen.data && (
                      <>
                        <p className="font-mono text-lg text-gray-200">{fullscreen.data.contactName}</p>
                        <p className="font-mono text-sm text-gray-400">{fullscreen.data.regTitle}</p>
                      </>
                    )}
                    {!fullscreen.data && <p className="font-mono text-sm text-gray-400">{fullscreen.message}</p>}
                    <p className="font-mono text-[10px] text-gray-600">нажмите чтобы закрыть</p>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.3)' }}>
              <Shield className="w-5 h-5" style={{ color: '#00ff88' }} />
            </div>
            <h1 className="font-mono text-2xl md:text-3xl font-bold" style={{ color: '#00ff88', textShadow: '0 0 20px rgba(0,255,136,0.3)' }}>
              NEXUS CONTROL
            </h1>
          </div>
          <p className="font-mono text-xs text-gray-500">// СИСТЕМА КОНТРОЛЯ ДОСТУПА</p>
        </motion.div>

        {/* Registration selector */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl p-4" style={{ background: 'rgba(10,10,20,0.7)', border: '1px solid rgba(0,255,136,0.1)', backdropFilter: 'blur(12px)' }}>
          <label className="font-mono text-[10px] text-gray-500 mb-2 block uppercase tracking-wider">Мероприятие</label>
          <select
            value={selectedReg?.id || ''}
            onChange={e => {
              const reg = registrations.find(r => r.id === e.target.value);
              setSelectedReg(reg || null);
              setResult(null);
              setCameraError('');
              if (scanning) stopScanner();
            }}
            className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/40 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00ff88] transition-colors"
          >
            <option value="">-- Выберите мероприятие --</option>
            {registrations.map(r => (
              <option key={r.id} value={r.id}>
                {r.title}{r.eventDate ? ` (${r.eventDate})` : ''} — {r.confirmedCount || 0} участ.
              </option>
            ))}
          </select>
        </motion.div>

        {/* Tabs + content */}
        {selectedReg && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {([['scan', Camera, 'Контроль'], ['list', List, 'Все заявки']] as [Tab, any, string][]).map(([t, Icon, label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all"
                  style={tab === t
                    ? { background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88' }
                    : { background: 'rgba(10,10,20,0.5)', border: '1px solid rgba(255,255,255,0.05)', color: '#666' }}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Scan tab */}
            {tab === 'scan' && (
              <div className="space-y-4">
                {/* Scanner + result */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Camera */}
                  <div className="rounded-xl p-5 space-y-3" style={{ background: 'rgba(10,10,20,0.7)', border: '1px solid rgba(0,255,136,0.1)', backdropFilter: 'blur(12px)' }}>
                    <h2 className="font-mono text-xs font-bold flex items-center gap-2" style={{ color: '#00ff88' }}>
                      <Camera className="w-3.5 h-3.5" /> КАМЕРА
                    </h2>
                    <div id="nexus-control-scanner" ref={containerRef} className="rounded-lg overflow-hidden" style={{ minHeight: scanning ? 260 : 0 }} />
                    {cameraError && (
                      <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
                        <p className="font-mono text-[11px] text-red-400">{cameraError}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {!scanning ? (
                        <button onClick={startScanner}
                          className="flex-1 py-3 rounded-xl font-mono text-sm font-bold transition-all hover:opacity-90"
                          style={{ backgroundColor: '#00ff88', color: '#000' }}>
                          <Camera className="w-4 h-4 inline mr-2" /> ЗАПУСТИТЬ КАМЕРУ
                        </button>
                      ) : (
                        <button onClick={stopScanner}
                          className="flex-1 py-3 rounded-xl font-mono text-sm font-bold transition-all"
                          style={{ background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.3)', color: '#ff3b30' }}>
                          <X className="w-4 h-4 inline mr-2" /> ОСТАНОВИТЬ
                        </button>
                      )}
                    </div>
                    {/* File upload */}
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
                      <p className="font-mono text-[10px] text-gray-500 mb-2">ВВЕДИТЕ 4-ЗНАЧНЫЙ КОД:</p>
                      <div className="flex gap-2">
                        <input value={manualToken} onChange={e => setManualToken(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                          placeholder="// код"
                          className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00ff88]" />
                        <button onClick={handleManualSubmit}
                          className="px-4 py-2 rounded-lg font-mono text-xs font-bold"
                          style={{ backgroundColor: '#00ff88', color: '#000' }}>
                          <Type className="w-3.5 h-3.5 inline mr-1" /> OK
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Result */}
                  <div className="rounded-xl p-5 flex flex-col items-center justify-center min-h-[300px]"
                    style={{ background: 'rgba(10,10,20,0.7)', border: '1px solid rgba(0,255,136,0.1)', backdropFilter: 'blur(12px)' }}>
                    <AnimatePresence mode="wait">
                      {!result ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                          <Camera className="w-14 h-14 mx-auto mb-4 opacity-15 text-gray-500" />
                          <p className="font-mono text-sm text-gray-500">// НАВЕДИТЕ КАМЕРУ НА QR-КОД</p>
                          <p className="font-mono text-[10px] text-gray-600 mt-2">или загрузите фото / введите код</p>
                        </motion.div>
                      ) : (
                        <motion.div key={result.type + Date.now()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3 w-full">
                          {(() => {
                            const Icon = resultIcons[result.type];
                            const color = resultColors[result.type];
                            return (
                              <>
                                {result.type === 'confirmed' ? (
                                  <svg viewBox="0 0 120 120" width="64" height="64" className="mx-auto">
                                    <polygon points="60,8 108,32 108,88 60,112 12,88 12,32" fill="none" stroke="#00ff88" strokeWidth="3" opacity="0.6"/>
                                    <polygon points="60,20 96,38 96,82 60,100 24,82 24,38" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.3"/>
                                    <path d="M48,50 L56,70 L72,45 L60,65 L52,55 Z" fill="#00ff88" opacity="0.8"/>
                                    <circle cx="60" cy="58" r="3" fill="#00ff88"/>
                                  </svg>
                                ) : (
                                  <Icon className="w-16 h-16 mx-auto" style={{ color }} />
                                )}
                                <h3 className="font-mono text-lg font-bold" style={{ color }}>{result.message}</h3>
                                {result.data && (
                                  <div className="rounded-xl p-3 text-left space-y-1" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                                    <p className="font-mono text-xs text-gray-400">Имя: <span className="text-gray-200">{result.data.contactName || '—'}</span></p>
                                    {result.data.regTitle && <p className="font-mono text-xs text-gray-400">Мероприятие: <span className="text-gray-200">{result.data.regTitle}</span></p>}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <button onClick={() => { setResult(null); setCameraError(''); }}
                            className="mt-3 px-4 py-2 rounded-lg font-mono text-xs transition-all hover:opacity-80"
                            style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88' }}>
                            СКАНИРОВАТЬ ЕЩЁ
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-3 justify-center">
                  {[
                    { label: 'Всего заявок', value: selectedReg.totalCount || 0, color: '#00d4ff' },
                    { label: 'Подтверждено', value: selectedReg.confirmedCount || 0, color: '#00ff88' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl px-4 py-2.5 text-center"
                      style={{ background: 'rgba(10,10,20,0.5)', border: `1px solid ${s.color}20` }}>
                      <p className="font-mono text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="font-mono text-[10px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submissions list tab */}
            {tab === 'list' && (
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(10,10,20,0.7)', border: '1px solid rgba(0,255,136,0.1)', backdropFilter: 'blur(12px)' }}>
                {loadingSubs ? (
                  <div className="p-8 text-center">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#00ff8840', borderTopColor: 'transparent' }} />
                    <p className="font-mono text-xs text-gray-500 mt-3">Загрузка...</p>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-20 text-gray-500" />
                    <p className="font-mono text-sm text-gray-500">Нет заявок</p>
                  </div>
                ) : (
                  <>
                    {/* Summary bar */}
                    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <span className="font-mono text-xs text-gray-400">Всего: {submissions.length}</span>
                      <div className="flex gap-3">
                        {['registered', 'confirmed', 'waitlist', 'cancelled'].map(s => {
                          const count = submissions.filter(x => x.status === s).length;
                          if (!count) return null;
                          return (
                            <span key={s} className="font-mono text-[10px] flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: statusColor[s] }} />
                              {statusLabel[s]}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <th className="px-4 py-2.5 text-left font-mono text-[10px] text-gray-500 font-normal uppercase tracking-wider">#</th>
                            <th className="px-4 py-2.5 text-left font-mono text-[10px] text-gray-500 font-normal uppercase tracking-wider">Имя</th>
                            <th className="px-4 py-2.5 text-left font-mono text-[10px] text-gray-500 font-normal uppercase tracking-wider">Статус</th>
                            <th className="px-4 py-2.5 text-left font-mono text-[10px] text-gray-500 font-normal uppercase tracking-wider">Пришёл</th>
                            <th className="px-4 py-2.5 text-left font-mono text-[10px] text-gray-500 font-normal uppercase tracking-wider">Дата</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map((s, i) => (
                            <tr key={s.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{i + 1}</td>
                              <td className="px-4 py-2.5 font-mono text-xs text-gray-200">{s.contactName || '—'}</td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10px]"
                                  style={{ background: `${statusColor[s.status]}12`, border: `1px solid ${statusColor[s.status]}30`, color: statusColor[s.status] }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor[s.status] }} />
                                  {statusLabel[s.status]}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                {s.attended ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px]"
                                    style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88' }}>
                                    <CheckCircle className="w-3 h-3" /> Да
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-gray-500">
                                {s.createdAt ? new Date(s.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="font-mono text-[10px] text-gray-600">NEXUS CRM // CONTROL SYSTEM v1.0</p>
        </div>
      </div>

      {/* Hidden containers */}
      <div id="nexus-control-scanner-temp" className="hidden" />
    </div>
  );
}
