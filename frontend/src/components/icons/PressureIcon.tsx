interface Props { className?: string; }

export function PressureIcon({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M20 20 L20 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M20 20 L28 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      <circle cx="20" cy="20" r="2" fill="currentColor"/>
      <path d="M8 26 Q14 30 20 30 Q26 30 32 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4"/>
      <text x="20" y="36" textAnchor="middle" fontSize="6" fill="currentColor" fontFamily="sans-serif" fontWeight="600">bar</text>
    </svg>
  );
}
