import { timeAgo } from '../../lib/utils'
import StatusDot from './StatusDot'
import Button from './Button'

export interface AlarmItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  device: string
  parameter: string
  value: string | number
  unit?: string
  timestamp: Date
  acknowledged: boolean
  acknowledgedBy?: string
}

interface Props {
  alarm: AlarmItem
  onAck?: (id: string) => void
}

const severityDot: Record<string, 'critical' | 'warning' | 'idle'> = {
  critical: 'critical',
  warning: 'warning',
  info: 'idle',
}

export default function AlarmRow({ alarm, onAck }: Props) {
  const isCritical = alarm.severity === 'critical'

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${isCritical && !alarm.acknowledged ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
      <StatusDot status={severityDot[alarm.severity]} size="md" pulse={isCritical && !alarm.acknowledged} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 truncate">{alarm.device}</span>
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${isCritical ? 'bg-red-100 text-red-700' : alarm.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
            {alarm.severity}
          </span>
        </div>
        <p className="text-xs text-slate-500 truncate">
          {alarm.parameter}
          {alarm.value !== '' && <span className="font-medium text-slate-700"> — {alarm.value}{alarm.unit}</span>}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[11px] text-slate-400">{timeAgo(alarm.timestamp)}</p>
        {alarm.acknowledged ? (
          <p className="text-[10px] text-green-600 font-medium">ACK'd</p>
        ) : onAck ? (
          <Button variant="ghost" size="sm" className="mt-0.5 text-indigo-600 hover:bg-indigo-50 text-[11px] px-2 py-0.5" onClick={() => onAck(alarm.id)}>
            ACK
          </Button>
        ) : null}
      </div>
    </div>
  )
}
