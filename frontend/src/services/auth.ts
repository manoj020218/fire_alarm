import type { User } from '@/types';

const MOCK_USERS: Record<string, { password: string; user: User }> = {
  'admin@jenix.io': {
    password: 'Pass@123',
    user: { id: 'u1', name: 'Jenix Admin', email: 'admin@jenix.io', role: 'JENIX_SUPER_ADMIN', siteIds: ['SITE001', 'SITE002'] },
  },
  'vendor@jenix.io': {
    password: 'Pass@123',
    user: { id: 'u2', name: 'Vendor Admin', email: 'vendor@jenix.io', role: 'VENDOR_ADMIN', siteIds: ['SITE001', 'SITE002'] },
  },
  'admin@abctowers.com': {
    password: 'Pass@123',
    user: { id: 'u3', name: 'ABC Admin', email: 'admin@abctowers.com', role: 'CLIENT_ADMIN', siteIds: ['SITE001'] },
  },
  'maint@abctowers.com': {
    password: 'Pass@123',
    user: { id: 'u4', name: 'Maintenance User', email: 'maint@abctowers.com', role: 'MAINTENANCE_USER', siteIds: ['SITE001'] },
  },
  'viewer@abctowers.com': {
    password: 'Pass@123',
    user: { id: 'u5', name: 'Viewer', email: 'viewer@abctowers.com', role: 'VIEWER', siteIds: ['SITE001'] },
  },
};

export interface LoginResult {
  user: User;
  token: string;
}

export async function mockLogin(email: string, password: string): Promise<LoginResult> {
  await new Promise((r) => setTimeout(r, 600));
  const entry = MOCK_USERS[email.toLowerCase()];
  if (!entry || entry.password !== password) {
    throw new Error('Invalid email or password');
  }
  const token = `mock-jwt-${entry.user.id}-${Date.now()}`;
  return { user: entry.user, token };
}

export function canAcknowledgeAlarms(role: User['role']): boolean {
  return ['JENIX_SUPER_ADMIN', 'VENDOR_ADMIN', 'CLIENT_ADMIN', 'MAINTENANCE_USER'].includes(role);
}

export function canManageUsers(role: User['role']): boolean {
  return ['JENIX_SUPER_ADMIN', 'VENDOR_ADMIN', 'CLIENT_ADMIN'].includes(role);
}

export function canAccessAPIIntegration(role: User['role']): boolean {
  return ['JENIX_SUPER_ADMIN', 'VENDOR_ADMIN'].includes(role);
}
