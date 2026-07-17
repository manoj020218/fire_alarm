interface IconProps { className?: string; size?: number }

export default function TankIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <ellipse cx="12" cy="4" rx="6" ry="2" />
      <ellipse cx="12" cy="20" rx="6" ry="2" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="9" y1="20" x2="9" y2="22" />
      <line x1="15" y1="20" x2="15" y2="22" />
      <path d="M6 14h12" strokeDasharray="2 2" />
    </svg>
  )
}
