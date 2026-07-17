interface IconProps { className?: string; size?: number }
export default function NavKitIcon({ className = '', size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <rect x="2" y="10" width="9" height="5" rx="1" />
      <rect x="13" y="10" width="9" height="5" rx="1" />
      <rect x="2" y="17" width="20" height="5" rx="1" />
    </svg>
  )
}
