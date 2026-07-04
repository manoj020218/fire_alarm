import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAlarms } from '@/hooks/useAlarms';
import { useStore } from '@/app/store';
import { MOCK_ALARMS } from '@/data/mockAlarms';

const CLIENT_ADMIN = {
  id: 'u3', name: 'ABC Admin', email: 'admin@abctowers.com',
  role: 'CLIENT_ADMIN' as const, siteIds: ['SITE001'],
};

beforeEach(() => {
  useStore.setState({ alarms: MOCK_ALARMS, activeSiteId: 'SITE001', user: null, token: null });
});

describe('useAlarms', () => {
  it('filters alarms to active site', () => {
    const { result } = renderHook(() => useAlarms());
    expect(result.current.siteAlarms.every((a) => a.siteId === 'SITE001')).toBe(true);
  });

  it('separates active and acknowledged alarms', () => {
    const { result } = renderHook(() => useAlarms());
    const totalActive = MOCK_ALARMS.filter((a) => a.siteId === 'SITE001' && !a.acknowledged).length;
    const totalAcked = MOCK_ALARMS.filter((a) => a.siteId === 'SITE001' && a.acknowledged).length;
    expect(result.current.activeAlarms.length).toBe(totalActive);
    expect(result.current.acknowledgedAlarms.length).toBe(totalAcked);
  });

  it('does not ack when user lacks permission', () => {
    useStore.setState({ user: { ...CLIENT_ADMIN, role: 'VIEWER' }, token: 'tok' });
    const { result } = renderHook(() => useAlarms());
    const alarm = result.current.activeAlarms[0];
    act(() => result.current.ack(alarm, 'test'));
    // Still active — ack was blocked
    const updated = useStore.getState().alarms.find((a) => a.id === alarm.id);
    expect(updated?.acknowledged).toBe(false);
  });

  it('acknowledges alarm when user has permission', () => {
    useStore.setState({ user: CLIENT_ADMIN, token: 'tok' });
    const { result } = renderHook(() => useAlarms());
    const alarm = result.current.activeAlarms[0];
    act(() => result.current.ack(alarm, 'Pressure restored'));
    const updated = useStore.getState().alarms.find((a) => a.id === alarm.id);
    expect(updated?.acknowledged).toBe(true);
    expect(updated?.acknowledgedBy).toBe('admin@abctowers.com');
    expect(updated?.acknowledgeReason).toBe('Pressure restored');
  });
});
