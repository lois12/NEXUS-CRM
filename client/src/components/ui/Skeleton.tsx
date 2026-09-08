import { motion } from 'framer-motion';

export function SkeletonBlock({ height = 'h-4', className = '' }: { height?: string; className?: string }) {
  return (
    <div className={`${height} rounded-lg overflow-hidden ${className}`} style={{ background: 'rgba(255,255,255,0.04)' }}>
      <motion.div
        className="h-full w-full"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,255,136,0.04) 40%, rgba(0,255,136,0.08) 50%, rgba(0,255,136,0.04) 60%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`glass rounded-2xl p-6 space-y-4 ${className}`}>
      <SkeletonBlock height="h-6" className="w-2/3" />
      <SkeletonBlock height="h-4" className="w-full" />
      <SkeletonBlock height="h-4" className="w-4/5" />
      <SkeletonBlock height="h-4" className="w-3/5" />
    </div>
  );
}

export function SkeletonGrid({ count = 6, cols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' }: { count?: number; cols?: string }) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <div className="flex items-center gap-3">
      <SkeletonBlock height="h-8" className="w-8 rounded-lg" />
      <div className="space-y-2 flex-1">
        <SkeletonBlock height="h-6" className="w-48" />
        <SkeletonBlock height="h-3" className="w-32" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonBlock key={i} height="h-3" className="flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonBlock key={c} height="h-8" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonGauge() {
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        className="w-32 h-32 rounded-full"
        style={{ background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.06)' }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <SkeletonBlock height="h-4" className="w-24" />
      <SkeletonBlock height="h-3" className="w-32" />
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div className="space-y-4">
      <SkeletonBlock height="h-10" className="w-full" />
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock height="h-10" />
        <SkeletonBlock height="h-10" />
      </div>
      <SkeletonBlock height="h-10" className="w-full" />
      <SkeletonBlock height="h-10" className="w-full" />
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock height="h-10" />
        <SkeletonBlock height="h-10" />
      </div>
      <SkeletonBlock height="h-10" className="w-full" />
      <SkeletonBlock height="h-20" className="w-full" />
      <SkeletonBlock height="h-12" className="w-full" />
    </div>
  );
}
