import { useState, useEffect } from 'react'

interface Props {
  totalSeconds: number
  onRefresh?: () => void
  size?: number
}

export default function RefreshCountdown({ totalSeconds, onRefresh, size = 36 }: Props) {
  const [remaining, setRemaining] = useState(totalSeconds)

  useEffect(() => {
    setRemaining(totalSeconds)
  }, [totalSeconds])

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          onRefresh?.()
          return totalSeconds
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [totalSeconds, onRefresh])

  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const pct = remaining / totalSeconds
  const dash = circ * pct

  return (
    <div className="flex flex-col items-center gap-0.5 cursor-pointer" onClick={() => { onRefresh?.(); setRemaining(totalSeconds) }} title="Click to refresh now">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E2E8F0" strokeWidth="3" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="#6366F1"
          strokeWidth="3"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.9s linear' }}
        />
      </svg>
      <span className="text-[9px] text-slate-500 font-medium leading-none">{remaining}s</span>
    </div>
  )
}
