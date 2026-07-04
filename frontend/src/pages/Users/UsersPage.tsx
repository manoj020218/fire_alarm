import { MdPeople, MdShield, MdCircle } from 'react-icons/md';
import { useAuth } from '@/hooks/useAuth';

const MOCK_USERS = [
  { id: 'u1', name: 'Jenix Admin',    email: 'admin@jenix.io',        role: 'JENIX_SUPER_ADMIN', sites: 'All Sites',          active: true },
  { id: 'u2', name: 'Vendor Admin',   email: 'vendor@jenix.io',       role: 'VENDOR_ADMIN',      sites: 'All Sites',          active: true },
  { id: 'u3', name: 'ABC Admin',      email: 'admin@abctowers.com',   role: 'CLIENT_ADMIN',      sites: 'ABC Towers',         active: true },
  { id: 'u4', name: 'Maintenance',    email: 'maint@abctowers.com',   role: 'MAINTENANCE_USER',  sites: 'ABC Towers',         active: true },
  { id: 'u5', name: 'Viewer',         email: 'viewer@abctowers.com',  role: 'VIEWER',            sites: 'ABC Towers',         active: true },
];

const ROLE_BADGE: Record<string, string> = {
  JENIX_SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  VENDOR_ADMIN:      'bg-blue-100 text-blue-700',
  CLIENT_ADMIN:      'bg-cyan-100 text-cyan-700',
  MAINTENANCE_USER:  'bg-amber-100 text-amber-700',
  VIEWER:            'bg-slate-100 text-slate-600',
};

export function UsersPage() {
  const { canManageUsers } = useAuth();

  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <MdShield className="text-5xl mb-3" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm">You need CLIENT_ADMIN role or higher to manage users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-xl text-violet-700 text-2xl"><MdPeople /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Users</h1>
            <p className="text-sm text-slate-500">{MOCK_USERS.length} users across all sites</p>
          </div>
        </div>
        <button className="btn-primary">+ Add User</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Name</th>
              <th className="table-cell">Email</th>
              <th className="table-cell">Role</th>
              <th className="table-cell">Sites</th>
              <th className="table-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_USERS.map((u) => (
              <tr key={u.id} className="table-row">
                <td className="table-cell font-medium">{u.name}</td>
                <td className="table-cell text-slate-500">{u.email}</td>
                <td className="table-cell">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="table-cell text-slate-500 text-xs">{u.sites}</td>
                <td className="table-cell">
                  <span className="flex items-center gap-1.5 text-xs text-brand-green font-medium">
                    <MdCircle className="text-xs" /> Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
