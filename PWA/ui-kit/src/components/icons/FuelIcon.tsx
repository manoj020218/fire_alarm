interface IconProps { className?: string; size?: number }

export default function FuelIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 22V8l4-4h8l4 4v14H3z" />
      <path d="M3 11h14" />
      <path d="M17 8h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
      <line x1="8" y1="22" x2="8" y2="11" />
      <line x1="12" y1="22" x2="12" y2="11" />
    </svg>
  )
}
