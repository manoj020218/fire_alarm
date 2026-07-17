import { type Status } from '../../lib/utils'
import StatusDot from './StatusDot'

interface Connection {
  label: string
  status: Status
  sublabel?: string
}

interface Props {
  connections: Connection[]
  className?: string
  layout?: 'row' | 'grid'
}

export default function ConnectionStrip({ connections, className = '', layout = 'row' }: Props) {
  if (layout === 'grid') {
    return (
      <div className={`grid grid-cols-3 gap-3 ${className}`}>
        {connections.map(c => (
          <div key={c.label} className="flex flex-col items-center gap-1.5 bg-slate-50 rounded-xl p-3">
            <StatusDot status={c.status} size="md" pulse={c.status === 'critical'} />
            <span className="text-xs font-medium text-slate-700">{c.label}</span>
            {c.sublabel && <span className="text-[10px] text-slate-400">{c.sublabel}</span>}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-4 flex-wrap ${className}`}>
      {connections.map(c => (
        <div key={c.label} className="flex items-center gap-1.5">
          <StatusDot status={c.status} size="sm" pulse={c.status === 'critical'} />
          <span className="text-xs text-slate-600 font-medium">{c.label}</span>
          {c.sublabel && <span className="text-[10px] text-slate-400">({c.sublabel})</span>}
        </div>
      ))}
    </div>
  )
}
