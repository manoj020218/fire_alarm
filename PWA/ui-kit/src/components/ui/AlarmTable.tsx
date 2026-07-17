import { useState } from 'react'
import AlarmRow, { type AlarmItem } from './AlarmRow'

interface Props {
  alarms: AlarmItem[]
  onAck?: (id: string) => void
  className?: string
}

export default function AlarmTable({ alarms, onAck, className = '' }: Props) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'unacked'>('all')

  const counts = {
    all: alarms.length,
    critical: alarms.filter(a => a.severity === 'critical').length,
    warning: alarms.filter(a => a.severity === 'warning').length,
    unacked: alarms.filter(a => !a.acknowledged).length,
  }

  const visible = alarms.filter(a => {
    if (filter === 'critical') return a.severity === 'critical'
    if (filter === 'warning') return a.severity === 'warning'
    if (filter === 'unacked') return !a.acknowledged
    return true
  })

  const tabs: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'warning', label: 'Warning' },
    { key: 'unacked', label: 'Unacked' },
  ]

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">Recent Alarms</h3>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === t.key ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t.label}
              {counts[t.key] > 0 && <span className="ml-1 opacity-80">({counts[t.key]})</span>}
            </button>
          ))}
        </div>
      </div>
      <div>
        {visible.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No alarms</div>
        ) : (
          visible.map(alarm => <AlarmRow key={alarm.id} alarm={alarm} onAck={onAck} />)
        )}
      </div>
    </div>
  )
}
