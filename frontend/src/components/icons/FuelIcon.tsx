interface Props { className?: string; }

export function FuelIcon({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <path d="M8 36 L8 10 Q8 8 10 8 L22 8 Q24 8 24 10 L24 36 Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round"/>
      <rect x="10" y="18" width="12" height="10" rx="1" fill="currentColor" opacity="0.2"/>
      <path d="M24 14 L30 10 L30 22 Q32 22 32 24 L32 30 Q32 32 30 32 L28 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M13 12 h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}
