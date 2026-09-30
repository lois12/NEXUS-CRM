import { useRef, useState } from 'react';
import { Square } from 'lucide-react';
import { fmtTime } from './chatUtils';

export default function VoicePlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const speeds = [0.5, 1, 1.5, 2];

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <div className="flex items-center gap-2 mb-1 min-w-[180px]">
      <audio ref={audioRef} src={src} preload="metadata"
        onTimeUpdate={() => { if (audioRef.current) setProgress(audioRef.current.currentTime); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onEnded={() => { setPlaying(false); setProgress(0); }} />
      <button onClick={togglePlay} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)' }}>
        {playing ? <Square className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} /> : <span style={{ color: 'var(--color-primary)', fontSize: '14px' }}>▶</span>}
      </button>
      <div className="flex-1">
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden cursor-pointer" onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const pct = (e.clientX - rect.left) / rect.width; if (audioRef.current) { audioRef.current.currentTime = pct * audioRef.current.duration; setProgress(pct * audioRef.current.duration); } }}>
          <div className="h-full rounded-full transition-all" style={{ width: duration ? `${(progress / duration) * 100}%` : '0%', background: 'var(--color-primary)' }} />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] font-mono" style={{ color: '#5a5a70' }}>{fmtTime(Math.floor(progress))}</span>
          <button onClick={cycleSpeed} className="text-[9px] font-mono px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors" style={{ color: speed !== 1 ? 'var(--color-primary)' : '#5a5a70' }}>{speed}x</button>
        </div>
      </div>
    </div>
  );
}