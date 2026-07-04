import { useState } from 'react';
import { MdDevices, MdCheckCircle, MdError } from 'react-icons/md';
import { MOCK_REGISTER_MAP } from '@/data/mockAlarms';

export function DevicesPage() {
  const [search, setSearch] = useState('');
  const filtered = MOCK_REGISTER_MAP.filter((d) =>
    d.deviceName.toLowerCase().includes(search.toLowerCase()) ||
    d.deviceId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-100 rounded-xl text-cyan-700 text-2xl"><MdDevices /></div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Devices</h1>
          <p className="text-sm text-slate-500">RS485 Modbus device register mapping</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        {[
          { label: 'Total Devices', value: MOCK_REGISTER_MAP.length, color: 'text-slate-700' },
          { label: 'Online', value: MOCK_REGISTER_MAP.filter((d) => d.online).length, color: 'text-brand-green' },
          { label: 'Offline', value: MOCK_REGISTER_MAP.filter((d) => !d.online).length, color: 'text-brand-red' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl px-5 py-3 border border-slate-200 shadow-sm text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search devices…"
        className="input-field max-w-xs"
      />

      {/* Register map table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Register Mapping</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Status</th>
                <th className="table-cell">Device</th>
                <th className="table-cell">Slave ID</th>
                <th className="table-cell">Register</th>
                <th className="table-cell">FC</th>
                <th className="table-cell">Parameter</th>
                <th className="table-cell">Unit</th>
                <th className="table-cell">Scale</th>
                <th className="table-cell">Last Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.deviceId} className="table-row">
                  <td className="table-cell">
                    {d.online
                      ? <MdCheckCircle className="text-brand-green text-lg" />
                      : <MdError className="text-brand-red text-lg" />}
                  </td>
                  <td className="table-cell font-medium">{d.deviceName}</td>
                  <td className="table-cell font-mono">{d.slaveId}</td>
                  <td className="table-cell font-mono">0x{d.register.toString(16).toUpperCase().padStart(4, '0')}</td>
                  <td className="table-cell font-mono">FC{d.functionCode.toString().padStart(2, '0')}</td>
                  <td className="table-cell text-slate-500">{d.parameter}</td>
                  <td className="table-cell">{d.unit || '—'}</td>
                  <td className="table-cell font-mono">{d.scale}</td>
                  <td className="table-cell font-mono">{String(d.lastValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
