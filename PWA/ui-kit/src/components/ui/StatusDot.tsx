import { type Status, statusDotClass } from '../../lib/utils'

interface Props {
  status: Status
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
}

const sizeMap = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' }

export default function StatusDot({ status, size = 'md', pulse = false }: Props) {
  return (
    <span className="relative inline-flex">
      <span className={`${sizeMap[size]} rounded-full ${statusDotClass(status)}`} />
      {pulse && (status === 'critical' || status === 'warning') && (
        <span className={`absolute inset-0 rounded-full ${statusDotClass(status)} animate-ping opacity-75`} />
      )}
    </span>
  )
}
