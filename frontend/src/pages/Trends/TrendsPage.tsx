import { useState } from 'react';
import { MdShowChart } from 'react-icons/md';
import { TrendChart } from '@/components/charts/TrendChart';
import { MOCK_TRENDS } from '@/data/mockTelemetry';

const TREND_OPTIONS = [
  { key: 'sprinklerPressure', label: 'Sprinkler Pressure', unit: 'bar', color: '#1D4ED8', warn: 4, crit: 2 },
  { key: 'hydrantPressure',   label: 'Hydrant Pressure',   unit: 'bar', color: '#0891B2', warn: 3, crit: 2 },
  { key: 'waterTankLevel',    label: 'Water Tank Level',   unit: '%',   color: '#0D9488', warn: 30, crit: 15 },
  { key: 'dgFuelLevel',       label: 'DG Fuel Level',      unit: '%',   color: '#B45309', warn: 25, crit: 10 },
  { key: 'dgBattery',         label: 'DG Battery Voltage', unit: 'V',   color: '#7C3AED', warn: 11.5, crit: 11 },
];

export function TrendsPage() {
  const [selected, setSelected] = useState(TREND_OPTIONS[0].key);
  const option = TREND_OPTIONS.find((o) => o.key === selected)!;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700 text-2xl"><MdShowChart /></div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Trends</h1>
          <p className="text-sm text-slate-500">Historical parameter data — last 24 hours</p>
        </div>
      </div>

      {/* Parameter selector */}
      <div className="flex flex-wrap gap-2">
        {TREND_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setSelected(o.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              selected === o.key
                ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand-blue hover:text-brand-blue'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">{option.label}</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">24h · 10-min intervals</span>
        </div>
        <TrendChart
          data={MOCK_TRENDS[selected] ?? []}
          unit={option.unit}
          color={option.color}
          warningThreshold={option.warn}
          criticalThreshold={option.crit}
          height={320}
        />
      </div>

      {/* All charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {TREND_OPTIONS.filter((o) => o.key !== selected).map((o) => (
          <div key={o.key} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm cursor-pointer hover:border-brand-blue"
            onClick={() => setSelected(o.key)}>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{o.label}</h3>
            <TrendChart data={MOCK_TRENDS[o.key] ?? []} unit={o.unit} color={o.color} height={120} />
          </div>
        ))}
      </div>
    </div>
  );
}
