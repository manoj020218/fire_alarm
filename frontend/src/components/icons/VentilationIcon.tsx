interface Props { className?: string; }

export function VentilationIcon({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="20" cy="20" r="3" fill="currentColor"/>
      <path d="M20 17 Q18 12 14 12 Q16 16 20 17" fill="currentColor" opacity="0.6"/>
      <path d="M23 20 Q28 18 28 14 Q24 16 23 20" fill="currentColor" opacity="0.6"/>
      <path d="M20 23 Q22 28 26 28 Q24 24 20 23" fill="currentColor" opacity="0.6"/>
      <path d="M17 20 Q12 22 12 26 Q16 24 17 20" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}
