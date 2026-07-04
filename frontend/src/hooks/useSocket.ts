import { useEffect } from 'react';
import { mockSocket } from '@/services/socket';
import { useStore } from '@/app/store';

export function useSocket(): void {
  const setTelemetry = useStore((s) => s.setTelemetry);
  const addAlarm = useStore((s) => s.addAlarm);

  useEffect(() => {
    mockSocket.connect();
    const offTelemetry = mockSocket.onTelemetry(setTelemetry);
    const offAlarm = mockSocket.onAlarm(addAlarm);
    return () => {
      offTelemetry();
      offAlarm();
      mockSocket.disconnect();
    };
  }, [setTelemetry, addAlarm]);
}
