import { type ReactNode } from 'react'

interface Props {
  title: string
  accent?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export default function SectionCard({ title, accent, children, className = '', action }: Props) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {accent && <div className="w-1 h-5 rounded-full" style={{ backgroundColor: accent }} />}
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
