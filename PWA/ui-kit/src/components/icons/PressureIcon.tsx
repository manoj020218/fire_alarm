interface IconProps { className?: string; size?: number }

export default function PressureIcon({ className = '', size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13L9 8" strokeWidth="2" />
      <circle cx="12" cy="13" r="1.5" fill="currentColor" />
      <path d="M6 17.5A8 8 0 0 1 8 9" />
      <path d="M18 17.5A8 8 0 0 0 16 9" />
      <line x1="12" y1="5" x2="12" y2="3" />
      <line x1="7" y1="6.5" x2="6" y2="5" />
      <line x1="17" y1="6.5" x2="18" y2="5" />
    </svg>
  )
}
