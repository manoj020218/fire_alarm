import { useState } from 'react';
import { MdNotifications } from 'react-icons/md';
import { useAlarms } from '@/hooks/useAlarms';
import { AlarmTable } from '@/components/tables/AlarmTable';
import { AckModal } from './AckModal';
import type { Alarm } from '@/types';

export function AlarmsPage() {
  const { siteAlarms, activeAlarms, acknowledgedAlarms, ack, canAckAlarms } = useAlarms();
  const [ackTarget, setAckTarget] = useState<Alarm | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-xl text-brand-red text-2xl">
          <MdNotifications />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Alarms</h1>
          <p className="text-sm text-slate-500">{activeAlarms.length} active · {acknowledgedAlarms.length} acknowledged</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <AlarmTable
          alarms={siteAlarms}
          onAck={(alarm) => setAckTarget(alarm)}
          canAck={canAckAlarms}
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
