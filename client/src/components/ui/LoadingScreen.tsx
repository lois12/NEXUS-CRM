import { NexusLogo } from './NexusLogo';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Загрузка...' }: LoadingScreenProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: '#0a0a0f' }}
    >
      <NexusLogo size={64} showText={false} />
      <div className="flex flex-col items-center gap-2">
        <span
          className="font-mono text-sm tracking-widest"
          style={{ color: '#00ff88', textShadow: '0 0 10px rgba(0, 255, 136, 0.3)' }}
        >
          {message}
        </span>
        <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0, 255, 136, 0.1)' }}>
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #00ff88, #00d4ff)',
              animation: 'loading-bar 1.5s ease-in-out infinite',
              width: '30%',
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
