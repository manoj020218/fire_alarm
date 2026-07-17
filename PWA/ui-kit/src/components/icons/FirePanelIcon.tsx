interface IconProps { className?: string; size?: number }

export default function FirePanelIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 6c0 3-3 4-2 7 1-1 2-3 4-3-1 2 0 4 1 5-1-4 3-5 2-9-1 1-2 3-5 0z" fill="currentColor" fillOpacity="0.4" strokeWidth="1" />
      <circle cx="7" cy="17" r="1" fill="currentColor" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
      <circle cx="17" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}
