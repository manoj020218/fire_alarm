import { useStore } from '@/app/store';
import { useAuth } from '@/hooks/useAuth';
import type { Alarm } from '@/types';

export function useAlarms() {
  const alarms = useStore((s) => s.alarms);
  const activeSiteId = useStore((s) => s.activeSiteId);
  const acknowledgeAlarm = useStore((s) => s.acknowledgeAlarm);
  const { user, canAckAlarms } = useAuth();

  const siteAlarms = alarms.filter((a) => a.siteId === activeSiteId);
  const activeAlarms = siteAlarms.filter((a) => !a.acknowledged);
  const acknowledgedAlarms = siteAlarms.filter((a) => a.acknowledged);

  function ack(alarm: Alarm, reason: string): void {
    if (!canAckAlarms || !user) return;
    acknowledgeAlarm(alarm.id, user.email, reason);
  }

  return { siteAlarms, activeAlarms, acknowledgedAlarms, ack, canAckAlarms };
}
