interface Props {
  percent: number
  capacityLabel: string
  label: string
  fluidType?: 'water' | 'diesel'
  status?: 'ok' | 'warning' | 'critical' | 'offline' | 'idle'
  height?: number
}

function levelColor(percent: number, type: 'water' | 'diesel'): string {
  if (percent <= 20) return '#EF4444'
  if (percent <= 40) return '#F59E0B'
  if (type === 'diesel') return '#F59E0B'
  return '#22C55E'
}

export default function TankGauge({ percent, capacityLabel, label, fluidType = 'water', height = 120 }: Props) {
  const clampedPct = Math.max(0, Math.min(100, percent))
  const color = levelColor(clampedPct, fluidType)
  const fillH = (clampedPct / 100) * height

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 48, height }}>
        {/* tank body */}
        <div className="absolute inset-0 border-2 border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
          {/* fill */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-b-xl transition-all duration-700"
            style={{ height: `${clampedPct}%`, backgroundColor: color, opacity: 0.85 }}
          />
          {/* wave shimmer */}
          <div
            className="absolute left-0 right-0 h-1.5 rounded-full opacity-60"
            style={{ bottom: `calc(${clampedPct}% - 3px)`, backgroundColor: color }}
          />
        </div>
        {/* percentage overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-slate-700" style={{ textShadow: '0 0 4px white' }}>
            {clampedPct}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{capacityLabel}</p>
      </div>
    </div>
  )
}
