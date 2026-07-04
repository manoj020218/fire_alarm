import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/app/store';

const MOCK_USER = {
  id: 'u3',
  name: 'ABC Admin',
  email: 'admin@abctowers.com',
  role: 'CLIENT_ADMIN' as const,
  siteIds: ['SITE001'],
};

beforeEach(() => {
  // Reset store state
  useStore.setState({ user: null, token: null });
});

describe('useAuth', () => {
  it('returns isAuthenticated=false when no token', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns user and token after login', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login(MOCK_USER, 'mock-token'));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('admin@abctowers.com');
  });

  it('clears user on logout', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login(MOCK_USER, 'mock-token'));
    act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('CLIENT_ADMIN can ack alarms', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login(MOCK_USER, 'tok'));
    expect(result.current.canAckAlarms).toBe(true);
  });

  it('CLIENT_ADMIN can manage users', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login(MOCK_USER, 'tok'));
    expect(result.current.canManageUsers).toBe(true);
  });

  it('CLIENT_ADMIN cannot access API integration', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login(MOCK_USER, 'tok'));
    expect(result.current.canAccessAPI).toBe(false);
  });

  it('VIEWER cannot ack alarms', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login({ ...MOCK_USER, role: 'VIEWER' }, 'tok'));
    expect(result.current.canAckAlarms).toBe(false);
  });

  it('JENIX_SUPER_ADMIN can access API integration', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.login({ ...MOCK_USER, role: 'JENIX_SUPER_ADMIN' }, 'tok'));
    expect(result.current.canAccessAPI).toBe(true);
  });
});
