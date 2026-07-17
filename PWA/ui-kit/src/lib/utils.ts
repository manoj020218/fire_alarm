export type Status = 'ok' | 'warning' | 'critical' | 'offline' | 'idle'

export function statusColor(status: Status): string {
  switch (status) {
    case 'ok': return '#22C55E'
    case 'warning': return '#F59E0B'
    case 'critical': return '#EF4444'
    case 'offline': return '#EF4444'
    case 'idle': return '#94A3B8'
    default: return '#94A3B8'
  }
}

export function statusBgClass(status: Status): string {
  switch (status) {
    case 'ok': return 'bg-green-100 text-green-700'
    case 'warning': return 'bg-amber-100 text-amber-700'
    case 'critical': return 'bg-red-100 text-red-700'
    case 'offline': return 'bg-red-100 text-red-700'
    case 'idle': return 'bg-slate-100 text-slate-500'
    default: return 'bg-slate-100 text-slate-500'
  }
}

export function statusBorderClass(status: Status): string {
  switch (status) {
    case 'ok': return 'border-l-green-500'
    case 'warning': return 'border-l-amber-500'
    case 'critical': return 'border-l-red-500'
    case 'offline': return 'border-l-red-500'
    case 'idle': return 'border-l-slate-400'
    default: return 'border-l-slate-400'
  }
}

export function statusDotClass(status: Status): string {
  switch (status) {
    case 'ok': return 'bg-green-500'
    case 'warning': return 'bg-amber-500'
    case 'critical': return 'bg-red-500'
    case 'offline': return 'bg-red-500'
    case 'idle': return 'bg-slate-400'
    default: return 'bg-slate-400'
  }
}

export function statusLabel(status: Status): string {
  switch (status) {
    case 'ok': return 'Online'
    case 'warning': return 'Warning'
    case 'critical': return 'Critical'
    case 'offline': return 'Offline'
    case 'idle': return 'Idle'
    default: return 'Unknown'
  }
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
