interface Props {
  value: number
  min?: number
  max: number
  unit: string
  label: string
  warningThreshold?: number
  criticalThreshold?: number
  size?: number
}

function getColor(value: number, warning?: number, critical?: number): string {
  if (critical !== undefined && value >= critical) return '#EF4444'
  if (warning !== undefined && value >= warning) return '#F59E0B'
  return '#22C55E'
}

export default function RadialGauge({ value, min = 0, max, unit, label, warningThreshold, criticalThreshold, size = 180 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const strokeW = size * 0.07
  const startAngle = -210
  const endAngle = 30
  const totalDeg = endAngle - startAngle

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const color = getColor(value, warningThreshold, criticalThreshold)

  function polarToXY(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    }
  }

  function arc(startDeg: number, endDeg: number, col: string) {
    const s = polarToXY(startDeg, r)
    const e = polarToXY(endDeg, r)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return (
      <path
        d={`M${s.x},${s.y} A${r},${r} 0 ${large},1 ${e.x},${e.y}`}
        stroke={col}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
      />
    )
  }

  const valueDeg = startAngle + totalDeg * pct
  const needleLen = r - strokeW / 2 - 4
  const needleEnd = polarToXY(valueDeg, needleLen)

  const okEnd = warningThreshold !== undefined
    ? startAngle + totalDeg * Math.min(1, (warningThreshold - min) / (max - min))
    : startAngle + totalDeg

  const warnEnd = criticalThreshold !== undefined && warningThreshold !== undefined
    ? startAngle + totalDeg * Math.min(1, (criticalThreshold - min) / (max - min))
    : undefined

  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
      {/* track */}
      {arc(startAngle, endAngle, '#E2E8F0')}
      {/* green zone */}
      {arc(startAngle, Math.min(valueDeg, okEnd), '#22C55E')}
      {/* warning zone */}
      {warnEnd !== undefined && arc(okEnd, Math.min(valueDeg, warnEnd), '#F59E0B')}
      {/* critical zone */}
      {criticalThreshold !== undefined && warnEnd !== undefined && arc(warnEnd, Math.min(valueDeg, endAngle), '#EF4444')}
      {/* needle */}
      <line
        x1={cx}
        y1={cy}
        x2={needleEnd.x}
        y2={needleEnd.y}
        stroke={color}
        strokeWidth={strokeW * 0.35}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={strokeW * 0.5} fill={color} />
      {/* value text */}
      <text x={cx} y={cy * 1.15} textAnchor="middle" fontSize={size * 0.15} fontWeight="700" fill="#1E293B">
        {value}
      </text>
      <text x={cx} y={cy * 1.28} textAnchor="middle" fontSize={size * 0.07} fill="#64748B">
        {unit}
      </text>
      <text x={cx} y={cy * 1.42} textAnchor="middle" fontSize={size * 0.065} fill="#94A3B8">
        {label}
      </text>
    </svg>
  )
}
