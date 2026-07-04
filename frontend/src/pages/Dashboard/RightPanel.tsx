import { MdRefresh, MdNotificationsActive, MdBugReport } from 'react-icons/md';
import { ConnectionDots } from '@/components/status/ConnectionDots';
import { StatusBadge } from '@/components/status/StatusBadge';
import type { Gateway } from '@/types';
import { formatUptime, formatRSSI, relativeTime } from '@/utils/formatters';
import { MOCK_GATEWAY } from '@/data/mockTelemetry';

interface Props { gateway?: Gateway; }

export function RightPanel({ gateway = MOCK_GATEWAY }: Props) {
  return (
    <div className="space-y-4">
      {/* Gateway Status */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Gateway</h3>
        <div className="flex items-center gap-2 mb-3">
          <StatusBadge status={gateway.online ? 'online' : 'offline'} label={gateway.online ? 'Online' : 'Offline'} />
          <span className="text-sm font-semibold text-slate-700">{gateway.name}</span>
        </div>
        <div className="space-y-1.5 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>PID</span>
            <span className="font-mono text-slate-700">{gateway.pid}</span>
          </div>
          <div className="flex justify-between">
            <span>Firmware</span>
            <span className="font-mono text-slate-700">{gateway.system.fw}</span>
          </div>
          <div className="flex justify-between">
            <span>Uptime</span>
            <span className="text-slate-700">{formatUptime(gateway.system.uptime)}</span>
          </div>
          <div className="flex justify-between">
            <span>RSSI</span>
            <span className="text-slate-700">{gateway.system.rssi} dBm ({formatRSSI(gateway.system.rssi)})</span>
          </div>
          <div className="flex justify-between">
            <span>Last seen</span>
            <span className="text-slate-700">{relativeTime(gateway.lastSeen)}</span>
          </div>
        </div>
      </div>

      {/* Communication Status */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Communication</h3>
        <ConnectionDots system={gateway.system} />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <button className="flex items-center gap-2 w-full text-sm text-slate-600 hover:text-brand-blue hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">
            <MdRefresh /> Refresh Data
          </button>
          <button className="flex items-center gap-2 w-full text-sm text-slate-600 hover:text-brand-amber hover:bg-amber-50 px-3 py-2 rounded-lg transition-colors">
            <MdBugReport /> Test Alarm
          </button>
          <button className="flex items-center gap-2 w-full text-sm text-slate-600 hover:text-brand-red hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
            <MdNotificationsActive /> Notify All
          </button>
        </div>
      </div>
    </div>
  );
}
