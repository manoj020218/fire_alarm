interface IconProps { className?: string; size?: number }

export default function BatteryIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="7" width="18" height="10" rx="2" />
      <path d="M22 11v2" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="4" y="9" width="10" height="6" rx="1" fill="currentColor" fillOpacity="0.4" />
    </svg>
  )
}
