/** Shared footer for all public pages — PD links (152-FZ) */
export default function PrivacyFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={`mt-10 pt-5 text-center ${compact ? 'pb-2' : 'pb-6'}`}
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 font-mono text-[10px] tracking-wider">
        <a
          href="/privacy-policy.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)' }}
        >
          ПОЛИТИКА ПД
        </a>
        <span style={{ color: '#3a3a50' }}>·</span>
        <a
          href="/pd-request"
          style={{ color: 'var(--color-accent, #00d4ff)' }}
        >
          ОТЗЫВ СОГЛАСИЯ / МОИ ДАННЫЕ
        </a>
      </div>
      {!compact && (
        <p className="mt-2 font-mono text-[9px]" style={{ color: '#4a4a60' }}>
          NEXUS · обработка персональных данных по 152-ФЗ
        </p>
      )}
    </footer>
  );
}
