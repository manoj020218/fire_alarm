import { useState } from 'react';
import { useStore } from '@/app/store';
import { useAlarms } from '@/hooks/useAlarms';
import { SummaryBar } from './SummaryBar';
import { PumpRoomMap } from './PumpRoomMap';
import { RightPanel } from './RightPanel';
import { AlarmTable } from '@/components/tables/AlarmTable';
import { AckModal } from '@/pages/Alarms/AckModal';
import type { Alarm } from '@/types';

export function DashboardPage() {
  const telemetry = useStore((s) => s.telemetry);
  const summary = useStore((s) => s.summary());
  const { siteAlarms, ack, canAckAlarms } = useAlarms();
  const [ackTarget, setAckTarget] = useState<Alarm | null>(null);

  const recentAlarms = siteAlarms.slice(0, 5);

  return (
    <div className="space-y-6">
      <SummaryBar summary={summary} />

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Main center: pump room */}
        <div className="flex-1 min-w-0">
          <PumpRoomMap devices={telemetry.devices} />
        </div>

        {/* Right side panel */}
        <div className="xl:w-72 flex-shrink-0">
          <RightPanel />
        </div>
      </div>

      {/* Alarm table */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Recent Alarms</h2>
          <span className="text-xs text-slate-400">Last 5 events</span>
        </div>
        <AlarmTable
          alarms={recentAlarms}
          onAck={(alarm) => setAckTarget(alarm)}
          canAck={canAckAlarms}
          limit={5}
        />
      </div>

      {ackTarget && (
        <AckModal
          alarm={ackTarget}
          onConfirm={(reason) => { ack(ackTarget, reason); setAckTarget(null); }}
          onClose={() => setAckTarget(null)}
        />
      )}
    </div>
  );
}
