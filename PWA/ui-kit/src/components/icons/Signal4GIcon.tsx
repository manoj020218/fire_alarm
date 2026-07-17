interface IconProps { className?: string; size?: number }

export default function Signal4GIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="18" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="7" y="14" width="3" height="7" rx="0.5" fill="currentColor" />
      <rect x="12" y="10" width="3" height="11" rx="0.5" fill="currentColor" />
      <rect x="17" y="6" width="3" height="15" rx="0.5" fill="currentColor" stroke="none" />
      <text x="17" y="5" fontSize="5" fill="currentColor" stroke="none" fontWeight="bold">4G</text>
    </svg>
  )
}
