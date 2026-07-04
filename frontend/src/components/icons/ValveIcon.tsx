interface Props { className?: string; }

export function ValveIcon({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <path d="M4 20 h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M26 20 h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M14 14 L26 26 M14 26 L26 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M20 12 L20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 8 h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
