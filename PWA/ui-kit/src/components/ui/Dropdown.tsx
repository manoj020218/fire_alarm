import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  options: Option[]
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  className?: string
}

export default function Dropdown({ options, value, onChange, label, placeholder = 'Select...', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 hover:border-indigo-400 transition-colors"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>{selected?.label ?? placeholder}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-indigo-50 ${value === opt.value ? 'text-indigo-700 bg-indigo-50 font-medium' : 'text-slate-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
