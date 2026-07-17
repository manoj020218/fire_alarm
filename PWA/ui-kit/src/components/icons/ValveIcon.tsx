interface IconProps { className?: string; size?: number }

export default function ValveIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="2" y1="12" x2="8" y2="12" />
      <line x1="16" y1="12" x2="22" y2="12" />
      <polygon points="8,7 16,12 8,17" fill="currentColor" fillOpacity="0.2" />
      <polygon points="16,7 8,12 16,17" fill="currentColor" fillOpacity="0.2" />
      <polygon points="8,7 16,12 8,17" />
      <polygon points="16,7 8,12 16,17" />
      <line x1="12" y1="7" x2="12" y2="4" />
      <rect x="10" y="2" width="4" height="2" rx="1" />
    </svg>
  )
}
