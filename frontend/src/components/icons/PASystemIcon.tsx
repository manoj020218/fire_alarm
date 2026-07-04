interface Props { className?: string; }

export function PASystemIcon({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <path d="M10 15 L10 25 L16 25 L24 32 L24 8 L16 15 Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round"/>
      <path d="M28 14 Q32 20 28 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M31 10 Q38 20 31 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
    </svg>
  );
}
