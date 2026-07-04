interface Props { className?: string; level?: number; }

export function BatteryIcon({ className = '', level = 80 }: Props) {
  const fillW = Math.max(0, Math.min(100, level)) * 0.22;
  const fillColor = level < 20 ? '#EF4444' : level < 50 ? '#F59E0B' : '#22C55E';
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <rect x="4" y="12" width="28" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
      <rect x="32" y="16" width="4" height="8" rx="1" fill="currentColor" opacity="0.5"/>
      {fillW > 0 && (
        <rect x="6" y="14" width={fillW} height="12" rx="1" fill={fillColor}/>
      )}
      <path d="M17 16 l-3 4 h4 l-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    </svg>
  );
}
