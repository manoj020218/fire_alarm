import { MdCheckCircle, MdWarning, MdError, MdDevices, MdNotifications, MdDoneAll } from 'react-icons/md';
import { StatusCard } from '@/components/cards/StatusCard';
import type { DashboardSummary } from '@/types';

interface Props { summary: DashboardSummary; }

export function SummaryBar({ summary }: Props) {
  const statusAccent = summary.systemStatus === 'NORMAL' ? 'green'
    : summary.systemStatus === 'CRITICAL' ? 'red'
    : summary.systemStatus === 'WARNING' ? 'amber'
    : 'slate';

  const statusIcon = summary.systemStatus === 'NORMAL' ? <MdCheckCircle />
    : summary.systemStatus === 'CRITICAL' ? <MdError />
    : <MdWarning />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      <StatusCard
        label="System Status"
        value={summary.systemStatus}
        icon={statusIcon}
        accent={statusAccent}
      />
      <StatusCard
        label="Devices Online"
        value={`${summary.devicesOnline}/${summary.devicesTotal}`}
        sub="RS485 equipment"
        icon={<MdDevices />}
        accent={summary.devicesOnline === summary.devicesTotal ? 'green' : 'amber'}
      />
      <StatusCard
        label="Active Alarms"
        value={summary.activeAlarms}
        sub="Requires attention"
        icon={<MdNotifications />}
        accent={summary.activeAlarms === 0 ? 'green' : summary.activeAlarms > 2 ? 'red' : 'amber'}
      />
      <StatusCard
        label="Acknowledged"
        value={summary.acknowledgedAlarms}
        sub="Alarms resolved"
        icon={<MdDoneAll />}
        accent="blue"
      />
      <StatusCard
        label="Unacknowledged"
        value={summary.unacknowledgedAlarms}
        sub="Pending action"
        icon={<MdWarning />}
        accent={summary.unacknowledgedAlarms === 0 ? 'green' : 'red'}
      />
    </div>
  );
}
