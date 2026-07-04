import { useState } from 'react';
import { MdSettings, MdSave } from 'react-icons/md';

export function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [thresholds, setThresholds] = useState({
    sprinklerPressureLow: 4,
    hydrantPressureLow: 3,
    waterTankLevelLow: 20,
    dgFuelLow: 20,
    dgBatteryLow: 11.5,
  });

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-200 rounded-xl text-slate-700 text-2xl"><MdSettings /></div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Settings</h1>
          <p className="text-sm text-slate-500">Alarm thresholds and site configuration</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Alarm Thresholds</h2>
        <div className="space-y-4">
          {[
            { key: 'sprinklerPressureLow', label: 'Sprinkler Pressure Low', unit: 'bar' },
            { key: 'hydrantPressureLow',   label: 'Hydrant Pressure Low',   unit: 'bar' },
            { key: 'waterTankLevelLow',    label: 'Water Tank Level Low',   unit: '%'   },
            { key: 'dgFuelLow',            label: 'DG Fuel Level Low',      unit: '%'   },
            { key: 'dgBatteryLow',         label: 'DG Battery Low',         unit: 'V'   },
          ].map(({ key, label, unit }) => (
            <div key={key} className="flex items-center gap-4">
              <label className="flex-1 text-sm text-slate-600">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholds[key as keyof typeof thresholds]}
                  onChange={(e) => setThresholds((t) => ({ ...t, [key]: parseFloat(e.target.value) }))}
                  className="input-field w-24 text-right"
                  step={0.1}
                />
                <span className="text-xs text-slate-500 w-8">{unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <MdSave /> {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Notification Placeholders</h2>
        <div className="space-y-3">
          {['FCM Push Notification', 'WhatsApp Alert', 'Email Notification', 'SMS Alert'].map((n) => (
            <div key={n} className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{n}</span>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">Coming Soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
