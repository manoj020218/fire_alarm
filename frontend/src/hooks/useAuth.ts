import { useStore } from '@/app/store';
import { canAcknowledgeAlarms, canManageUsers, canAccessAPIIntegration } from '@/services/auth';

export function useAuth() {
  const user = useStore((s) => s.user);
  const token = useStore((s) => s.token);
  const login = useStore((s) => s.login);
  const logout = useStore((s) => s.logout);

  return {
    user,
    token,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    canAckAlarms: user ? canAcknowledgeAlarms(user.role) : false,
    canManageUsers: user ? canManageUsers(user.role) : false,
    canAccessAPI: user ? canAccessAPIIntegration(user.role) : false,
  };
}
