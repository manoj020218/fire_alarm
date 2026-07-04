interface Props { className?: string; level?: number; }

export function TankIcon({ className = '', level = 70 }: Props) {
  const fillH = Math.max(0, Math.min(100, level));
  const fillY = 10 + (24 * (1 - fillH / 100));
  const fillHeight = 24 * (fillH / 100);
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <rect x="8" y="10" width="24" height="24" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
      {fillHeight > 0 && (
        <rect x="9" y={fillY} width="22" height={fillHeight} rx="1" fill="currentColor" opacity="0.25"/>
      )}
      <path d="M14 6 L14 10 M26 6 L26 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M20 34 L20 38" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 22 h8 M20 18 v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}
