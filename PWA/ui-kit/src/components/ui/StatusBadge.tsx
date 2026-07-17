import { type Status, statusBgClass, statusLabel, statusDotClass } from '../../lib/utils'

interface Props {
  status: Status
  label?: string
  className?: string
}

export default function StatusBadge({ status, label, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBgClass(status)} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(status)}`} />
      {label ?? statusLabel(status)}
    </span>
  )
}
