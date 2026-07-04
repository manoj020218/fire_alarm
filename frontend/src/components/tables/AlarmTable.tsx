import { useState } from 'react';
import { MdCheckCircle, MdWarning, MdError } from 'react-icons/md';
import type { Alarm } from '@/types';
import { StatusBadge } from '@/components/status/StatusBadge';
import { EQUIPMENT_LABELS, SEVERITY_BADGE } from '@/utils/constants';
import { formatDateTime, relativeTime } from '@/utils/formatters';

interface Props {
  alarms: Alarm[];
  onAck: (alarm: Alarm) => void;
  canAck: boolean;
  limit?: number;
}

export function AlarmTable({ alarms, onAck, canAck, limit }: Props) {
  const [filter, setFilter] = useState<'all' | 'active' | 'acked'>('all');

  const visible = alarms
    .filter((a) => filter === 'all' ? true : filter === 'active' ? !a.acknowledged : a.acknowledged)
    .slice(0, limit);

  if (alarms.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
        <MdCheckCircle className="mr-2 text-brand-green text-lg" /> No alarms
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {(['all', 'active', 'acked'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Acknowledged'}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">{visible.length} shown</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Severity</th>
              <th className="table-cell">Device</th>
              <th className="table-cell">Parameter</th>
              <th className="table-cell">Value</th>
              <th className="table-cell">Time</th>
              <th className="table-cell">Status</th>
              {canAck && <th className="table-cell">Action</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((alarm) => (
              <tr key={alarm.id} className="table-row">
                <td className="table-cell">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_BADGE[alarm.severity]}`}>
                    {alarm.severity === 'critical'
                      ? <MdError className="text-sm" />
                      : <MdWarning className="text-sm" />}
                    {alarm.severity}
                  </span>
                </td>
                <td className="table-cell font-medium">{EQUIPMENT_LABELS[alarm.deviceId] ?? alarm.deviceId}</td>
                <td className="table-cell text-slate-500">{alarm.parameter.replace(/_/g, ' ')}</td>
                <td className="table-cell font-mono">{String(alarm.value)}</td>
                <td className="table-cell text-slate-400 text-xs whitespace-nowrap">
                  <span title={formatDateTime(alarm.timestamp)}>{relativeTime(alarm.timestamp)}</span>
                </td>
                <td className="table-cell">
                  <StatusBadge status={alarm.acknowledged ? 'ON' : 'ALARM'} label={alarm.acknowledged ? 'Acknowledged' : 'Active'} size="sm" />
                </td>
                {canAck && (
                  <td className="table-cell">
                    {!alarm.acknowledged ? (
                      <button
                        onClick={() => onAck(alarm)}
                        className="btn-primary py-1 px-3 text-xs"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400" title={alarm.acknowledgedBy}>
                        {alarm.acknowledgedBy?.split('@')[0]}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
