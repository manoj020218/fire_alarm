interface Props { className?: string; }

export function GatewayIcon({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <rect x="6" y="14" width="28" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M10 20 h4 M10 26 h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <circle cx="28" cy="20" r="2" fill="currentColor" opacity="0.6"/>
      <circle cx="28" cy="26" r="2" fill="currentColor" opacity="0.6"/>
      <path d="M20 14 L20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M14 10 Q20 6 26 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M11 8 Q20 2 29 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.3"/>
    </svg>
  );
}
