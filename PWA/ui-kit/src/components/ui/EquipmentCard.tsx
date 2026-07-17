import { type ReactNode } from 'react'
import { type Status, statusColor, statusBorderClass, statusBgClass } from '../../lib/utils'
import StatusBadge from './StatusBadge'

interface Reading {
  label: string
  value: string | number
  unit?: string
}

interface Props {
  icon: ReactNode
  name: string
  status: Status
  reading: Reading
  onDetail?: () => void
  className?: string
}

export default function EquipmentCard({ icon, name, status, reading, onDetail, className = '' }: Props) {
  const color = statusColor(status)
  const borderCls = statusBorderClass(status)
  const iconBg = statusBgClass(status).split(' ')[0]

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${borderCls} shadow-sm p-4 flex flex-col gap-3 transition-shadow hover:shadow-md ${className}`}>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`} style={{ color }}>
          {icon}
        </div>
        <StatusBadge status={status} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800 leading-tight">{name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{reading.label}</p>
        <p className="text-lg font-bold mt-1" style={{ color: status === 'critical' ? color : '#1E293B' }}>
          {reading.value}
          {reading.unit && <span className="text-sm font-normal text-slate-500 ml-0.5">{reading.unit}</span>}
        </p>
      </div>
      {onDetail && (
        <button
          onClick={onDetail}
          className="text-xs text-indigo-600 font-medium hover:text-indigo-800 text-left transition-colors"
        >
          Detail View →
        </button>
      )}
    </div>
  )
}
