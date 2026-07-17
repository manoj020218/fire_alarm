interface IconProps { className?: string; size?: number }

export default function GatewayIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="14" width="20" height="7" rx="2" />
      <circle cx="6" cy="17.5" r="1" fill="currentColor" />
      <circle cx="10" cy="17.5" r="1" fill="currentColor" />
      <line x1="12" y1="14" x2="12" y2="10" />
      <path d="M8 10a6 6 0 0 1 8 0" />
      <path d="M6 7.5a9 9 0 0 1 12 0" />
      <line x1="18" y1="17.5" x2="20" y2="17.5" />
    </svg>
  )
}
