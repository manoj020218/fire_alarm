import { MdBuild, MdCheckCircle, MdWarning, MdBuildCircle } from 'react-icons/md';
import { MOCK_MAINTENANCE_LOGS } from '@/data/mockAlarms';
import { formatDate } from '@/utils/formatters';

const TYPE_BADGE: Record<string, string> = {
  preventive: 'bg-blue-100 text-blue-700',
  corrective: 'bg-red-100 text-red-700',
  inspection: 'bg-amber-100 text-amber-700',
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  preventive: <MdCheckCircle />,
  corrective: <MdBuildCircle />,
  inspection: <MdWarning />,
};

export function MaintenancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-xl text-orange-700 text-2xl"><MdBuild /></div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Maintenance</h1>
          <p className="text-sm text-slate-500">Equipment maintenance and inspection logs</p>
        </div>
      </div>

      <div className="space-y-4">
        {MOCK_MAINTENANCE_LOGS.map((log) => (
          <div key={log.id} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <span className={`p-2 rounded-lg text-lg ${TYPE_BADGE[log.type]}`}>
                  {TYPE_ICON[log.type]}
                </span>
                <div>
                  <p className="font-semibold text-slate-800">{log.deviceName}</p>
                  <p className="text-sm text-slate-500 mt-1">{log.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-slate-400">
                    <span>By: <span className="text-slate-600">{log.performedBy}</span></span>
                    <span>Date: <span className="text-slate-600">{formatDate(log.performedAt)}</span></span>
                    {log.nextDueDate && (
                      <span>Next: <span className="text-brand-amber font-medium">{formatDate(log.nextDueDate)}</span></span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${TYPE_BADGE[log.type]}`}>
                {log.type}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
