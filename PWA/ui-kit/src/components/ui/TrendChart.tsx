import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export interface TrendSeries {
  id: string
  label: string
  data: { time: string; value: number }[]
  unit: string
  color?: string
  warningValue?: number
  criticalValue?: number
}

interface Props {
  series: TrendSeries[]
  tabs?: string[]
  activeTab?: string
  onTabChange?: (tab: string) => void
  className?: string
}

export default function TrendChart({ series, tabs, activeTab, onTabChange, className = '' }: Props) {
  const [localTab, setLocalTab] = useState(tabs?.[0] ?? series[0]?.id ?? '')
  const currentTabId = activeTab ?? localTab

  const handleTab = (tab: string) => {
    setLocalTab(tab)
    onTabChange?.(tab)
  }

  const activeSeries = series.find(s => s.id === currentTabId) ?? series[0]

  if (!activeSeries) return null

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Trend History</h3>
        <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Last 24h</span>
      </div>
      {tabs && tabs.length > 1 && (
        <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => handleTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                currentTabId === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {series.find(s => s.id === tab)?.label ?? tab}
            </button>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={activeSeries.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${activeSeries.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={activeSeries.color ?? '#6366F1'} stopOpacity={0.2} />
              <stop offset="95%" stopColor={activeSeries.color ?? '#6366F1'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} unit={activeSeries.unit} width={36} />
          <Tooltip
            contentStyle={{ background: '#0F172A', border: 'none', borderRadius: '8px', color: '#F8FAFC', fontSize: '12px' }}
            formatter={(v: number) => [`${v} ${activeSeries.unit}`, activeSeries.label]}
            labelStyle={{ color: '#94A3B8' }}
          />
          {activeSeries.warningValue !== undefined && (
            <ReferenceLine y={activeSeries.warningValue} stroke="#F59E0B" strokeDasharray="4 2" label={{ value: 'Warn', fontSize: 9, fill: '#F59E0B', position: 'right' }} />
          )}
          {activeSeries.criticalValue !== undefined && (
            <ReferenceLine y={activeSeries.criticalValue} stroke="#EF4444" strokeDasharray="4 2" label={{ value: 'Crit', fontSize: 9, fill: '#EF4444', position: 'right' }} />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={activeSeries.color ?? '#6366F1'}
            strokeWidth={2}
            fill={`url(#grad-${activeSeries.id})`}
            dot={false}
            activeDot={{ r: 4, stroke: activeSeries.color ?? '#6366F1', strokeWidth: 2, fill: 'white' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
