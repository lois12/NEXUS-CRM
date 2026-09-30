import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { SOUNDS } from './chatConstants';
import { playSound } from './chatUtils';

export default function SoundSettingsPanel({ soundEnabled, setSoundEnabled, soundPrivate, setSoundPrivate, soundGroup, setSoundGroup, chatTheme, setChatTheme, dndEnabled, setDndEnabled, dndStart, setDndStart, dndEnd, setDndEnd, chatWallpaper, setChatWallpaper }: {
  soundEnabled: boolean; setSoundEnabled: (v: boolean) => void;
  soundPrivate: string; setSoundPrivate: (v: string) => void;
  soundGroup: string; setSoundGroup: (v: string) => void;
  chatTheme: 'dark' | 'light'; setChatTheme: (v: 'dark' | 'light') => void;
  dndEnabled: boolean; setDndEnabled: (v: boolean) => void;
  dndStart: string; setDndStart: (v: string) => void;
  dndEnd: string; setDndEnd: (v: string) => void;
  chatWallpaper: string; setChatWallpaper: (v: string) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute bottom-16 right-0 w-60 rounded-2xl overflow-hidden py-2" style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.95) 0%, rgba(15,15,25,0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9999 }}>
      <div className="px-4 py-2 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-wider" style={{ color: '#5a5a70' }}>ЗВУК</span>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg hover:bg-white/5">{soundEnabled ? <Volume2 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> : <VolumeX className="w-4 h-4" style={{ color: '#4a4a60' }} />}</button>
        </div>
        {soundEnabled && (<>
          <div><span className="text-[9px] font-mono block mb-1.5" style={{ color: '#4a4a60' }}>Личные</span><div className="flex flex-wrap gap-1">{SOUNDS.map(s => <button key={s.id} onClick={() => { setSoundPrivate(s.id); playSound(s.id); }} className="px-2.5 py-1 rounded-lg text-[9px] font-mono transition-all" style={soundPrivate === s.id ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' } : { color: '#5a5a70', border: '1px solid transparent' }}>{s.name}</button>)}</div></div>
          <div><span className="text-[9px] font-mono block mb-1.5" style={{ color: '#4a4a60' }}>Группы</span><div className="flex flex-wrap gap-1">{SOUNDS.map(s => <button key={s.id} onClick={() => { setSoundGroup(s.id); playSound(s.id); }} className="px-2.5 py-1 rounded-lg text-[9px] font-mono transition-all" style={soundGroup === s.id ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' } : { color: '#5a5a70', border: '1px solid transparent' }}>{s.name}</button>)}</div></div>
          <div><span className="text-[9px] font-mono block mb-1.5" style={{ color: '#4a4a60' }}>Тема</span><div className="flex gap-1">{(['dark', 'light'] as const).map(t => <button key={t} onClick={() => setChatTheme(t)} className="flex-1 px-2.5 py-1.5 rounded-lg text-[9px] font-mono transition-all" style={chatTheme === t ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' } : { color: '#5a5a70', border: '1px solid transparent' }}>{t === 'dark' ? 'Тёмная' : 'Светлая'}</button>)}</div></div>
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono" style={{ color: '#4a4a60' }}>НЕ БЕСПОКОИТЬ</span>
              <button onClick={() => setDndEnabled(!dndEnabled)} className={`w-8 h-4 rounded-full transition-colors relative ${dndEnabled ? 'bg-[var(--color-primary)]' : 'bg-[#3a3a50]'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${dndEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {dndEnabled && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-mono text-gray-500">с</span>
                <input type="time" value={dndStart} onChange={e => setDndStart(e.target.value)} className="px-2 py-1 rounded text-[10px] font-mono bg-black/30 border border-gray-700 text-gray-300 focus:outline-none w-20" />
                <span className="text-[9px] font-mono text-gray-500">до</span>
                <input type="time" value={dndEnd} onChange={e => setDndEnd(e.target.value)} className="px-2 py-1 rounded text-[10px] font-mono bg-black/30 border border-gray-700 text-gray-300 focus:outline-none w-20" />
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-white/5">
            <span className="text-[9px] font-mono block mb-1.5" style={{ color: '#4a4a60' }}>ФОН ЧАТА</span>
            <div className="flex flex-wrap gap-1">
              {[{ label: 'Стандарт', value: '' }, { label: 'Космос', value: 'linear-gradient(135deg, #0a0a1a, #1a0a2e)' }, { label: 'Океан', value: 'linear-gradient(135deg, #0a1a2e, #0a2e1a)' }, { label: 'Закат', value: 'linear-gradient(135deg, #2e1a0a, #2e0a1a)' }].map(w => (
                <button key={w.label} onClick={() => setChatWallpaper(w.value)} className="px-2 py-1 rounded text-[9px] font-mono transition-all"
                  style={chatWallpaper === w.value ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' } : { color: '#5a5a70', border: '1px solid transparent' }}>{w.label}</button>
              ))}
            </div>
          </div>
        </>)}
      </div>
    </motion.div>
  );
}