interface Props { className?: string; }

export function PumpIcon({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <rect x="6" y="22" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="15" cy="28" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M24 28h6a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M28 14l4 6-4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="10" y="16" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M15 22v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
