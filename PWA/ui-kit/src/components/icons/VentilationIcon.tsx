interface IconProps { className?: string; size?: number }

export default function VentilationIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9c0-3 2-6 5-6-1 3-1 5 0 6" />
      <path d="M15 12c3 0 6-2 6-5-3 1-5 1-6 0" />
      <path d="M12 15c0 3-2 6-5 6 1-3 1-5 0-6" />
      <path d="M9 12c-3 0-6 2-6 5 3-1 5-1 6 0" />
    </svg>
  )
}
