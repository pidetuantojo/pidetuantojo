export function LogoMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <g mask="url(#pta-bite)" fill="currentColor">
        <rect x="14" y="7" width="23" height="87" rx="11.5" />
        <circle cx="52" cy="38" r="32" />
      </g>
    </svg>
  );
}

export function Logo({ variant = 'light', size = 32 }: { variant?: 'light' | 'dark' | 'onBrand'; size?: number }) {
  const text = variant === 'light' ? '#1B1512' : '#FFFFFF';
  const mark = variant === 'onBrand' ? '#FFFFFF' : '#FF6A1A';
  return (
    <div className="flex items-center" style={{ gap: '0.1em', fontSize: size }}>
      <LogoMark className="h-[2.4em] w-[2.4em]" style={{ color: mark }} />
      <span
        className="flex flex-col whitespace-nowrap"
        style={{ fontFamily: 'var(--font-logo)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.02, color: text }}
      >
        <span>Pide tu</span>
        <span>antojo</span>
      </span>
    </div>
  );
}
