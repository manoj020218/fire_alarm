interface Props { className?: string; }

export function FirePanelIcon({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <rect x="4" y="6" width="32" height="28" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
      <rect x="8" y="10" width="24" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5"/>
      <circle cx="12" cy="18" r="2" fill="currentColor" opacity="0.6"/>
      <circle cx="18" cy="18" r="2" fill="currentColor" opacity="0.6"/>
      <circle cx="24" cy="18" r="2" fill="currentColor" opacity="0.6"/>
      <circle cx="30" cy="18" r="2" fill="currentColor" opacity="0.6"/>
      <path d="M8 30 h6 M18 30 h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <path d="M17 13 Q18 10 20 12 Q21 9 22 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}
