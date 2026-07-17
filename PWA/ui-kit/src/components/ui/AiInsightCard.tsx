import { type Status, statusColor } from '../../lib/utils'

interface Props {
  status: Status
  insight: string
  deviceName?: string
  timestamp?: Date
  className?: string
}

const statusWord: Record<string, string> = {
  ok: 'Normal',
  warning: 'Warning',
  critical: 'Critical Alert',
  offline: 'Offline',
  idle: 'Idle',
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
    </svg>
  )
}

export default function AiInsightCard({ status, insight, deviceName, timestamp, className = '' }: Props) {
  const color = statusColor(status)
  const word = statusWord[status] ?? 'Unknown'

  return (
    <div className={`bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-2xl border border-indigo-100 shadow-sm p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0">
          <SparkleIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">AI Insight</span>
            {deviceName && <span className="text-xs text-slate-400">· {deviceName}</span>}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold" style={{ color }}>{word}</span>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
          {timestamp && (
            <p className="text-xs text-slate-400 mt-2">
              {timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
