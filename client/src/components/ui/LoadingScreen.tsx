import { NexusLogo } from './NexusLogo';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Загрузка...' }: LoadingScreenProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        backgroundColor: 'var(--color-bg, #0a0a0f)',
        // vignette over ambient orbs over base — all behind content, no stacking traps
        backgroundImage: [
          'radial-gradient(120% 100% at 50% 45%, transparent 35%, rgba(0, 0, 0, 0.4) 100%)',
          'radial-gradient(900px 520px at 12% -8%, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 60%)',
          'radial-gradient(760px 460px at 96% 8%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 62%)',
        ].join(','),
        color: 'var(--color-text-primary, #e8e8ec)',
      }}
    >
      <div className="nx-rise flex flex-col items-center gap-6">
        <div style={{ filter: 'drop-shadow(0 12px 32px color-mix(in srgb, var(--color-primary) 22%, transparent))' }}>
          <NexusLogo size={64} showText={false} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span
            className="font-mono text-sm tracking-widest"
            style={{ color: 'var(--color-primary)', textShadow: '0 0 10px var(--color-glow)' }}
          >
            {message}
          </span>
          <div
            className="w-48 h-1.5 rounded-full overflow-hidden"
            style={{
              background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              boxShadow: 'var(--depth-contact), var(--depth-rim-top), var(--depth-rim-bottom)',
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
                boxShadow: '0 0 12px var(--color-glow)',
                animation: 'loading-bar 1.5s ease-in-out infinite',
                width: '30%',
              }}
            />
          </div>
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
