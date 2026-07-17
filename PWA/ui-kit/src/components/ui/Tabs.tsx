interface TabItem {
  id: string
  label: string
  count?: number
}

interface Props {
  items: TabItem[]
  activeTab: string
  onChange: (id: string) => void
  variant?: 'pills' | 'underline'
  className?: string
}

export default function Tabs({ items, activeTab, onChange, variant = 'pills', className = '' }: Props) {
  if (variant === 'underline') {
    return (
      <div className={`flex border-b border-slate-200 ${className}`}>
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === item.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === item.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={`flex gap-1 bg-slate-100 p-1 rounded-xl ${className}`}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === item.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="ml-1 text-xs opacity-70">({item.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}
