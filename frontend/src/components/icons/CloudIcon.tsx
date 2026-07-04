interface Props { className?: string; }

export function CloudIcon({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${className}`}>
      <path
        d="M30 28 H26 M30 28 a6 6 0 0 0 0-12 1 1 0 0 0-1 0.1 A9 9 0 1 0 12 22 a6 6 0 0 0 0 6 H30Z"
        stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round"
      />
      <path d="M18 28 v6 M14 30 l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    </svg>
  );
}
