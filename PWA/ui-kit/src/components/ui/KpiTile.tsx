import { type ReactNode } from 'react'
import { type Status, statusColor, statusBgClass } from '../../lib/utils'

interface Props {
  icon: ReactNode
  label: string
  value: string | number
  unit?: string
  status: Status
  className?: string
  subtext?: string
}

export default function KpiTile({ icon, label, value, unit, status, className = '', subtext }: Props) {
  const color = statusColor(status)
  const bgCls = statusBgClass(status)
  const iconBg = bgCls.split(' ')[0] // e.g. 'bg-green-100'

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`} style={{ color }}>
          {icon}
        </div>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-2xl font-bold" style={{ color: status === 'ok' ? '#1E293B' : color }}>{value}</span>
          {unit && <span className="text-sm text-slate-500">{unit}</span>}
        </div>
        {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
      </div>
    </div>
  )
}
