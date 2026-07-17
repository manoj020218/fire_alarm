interface IconProps { className?: string; size?: number }

export default function LanIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <rect x="2" y="14" width="6" height="4" rx="1" />
      <rect x="9" y="14" width="6" height="4" rx="1" />
      <rect x="16" y="14" width="6" height="4" rx="1" />
      <line x1="12" y1="6" x2="12" y2="10" />
      <line x1="5" y1="10" x2="19" y2="10" />
      <line x1="5" y1="10" x2="5" y2="14" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="19" y1="10" x2="19" y2="14" />
    </svg>
  )
}
