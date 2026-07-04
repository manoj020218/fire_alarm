import { NavLink } from 'react-router-dom';
import {
  MdDashboard, MdMonitor, MdNotifications, MdShowChart,
  MdAssessment, MdDevices, MdBuild, MdPeople, MdSettings, MdLink,
} from 'react-icons/md';
import { useStore } from '@/app/store';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/utils/constants';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  adminOnly?: boolean;
  superOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.DASHBOARD,       icon: <MdDashboard />,     label: 'Dashboard'     },
  { to: ROUTES.LIVE_MONITOR,    icon: <MdMonitor />,        label: 'Live Monitor'  },
  { to: ROUTES.ALARMS,          icon: <MdNotifications />,  label: 'Alarms'        },
  { to: ROUTES.TRENDS,          icon: <MdShowChart />,      label: 'Trends'        },
  { to: ROUTES.REPORTS,         icon: <MdAssessment />,     label: 'Reports'       },
  { to: ROUTES.DEVICES,         icon: <MdDevices />,        label: 'Devices'       },
  { to: ROUTES.MAINTENANCE,     icon: <MdBuild />,          label: 'Maintenance'   },
  { to: ROUTES.USERS,           icon: <MdPeople />,         label: 'Users',         adminOnly: true },
  { to: ROUTES.SETTINGS,        icon: <MdSettings />,       label: 'Settings'      },
  { to: ROUTES.API_INTEGRATION, icon: <MdLink />,           label: 'API Integration', superOnly: true },
];

interface Props { collapsed?: boolean; }

export function Sidebar({ collapsed = false }: Props) {
  const alarms = useStore((s) => s.alarms);
  const activeSiteId = useStore((s) => s.activeSiteId);
  const { canManageUsers, canAccessAPI } = useAuth();

  const unackCount = alarms.filter((a) => a.siteId === activeSiteId && !a.acknowledged).length;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !canManageUsers) return false;
    if (item.superOnly && !canAccessAPI) return false;
    return true;
  });

  return (
    <aside
      className={`flex flex-col bg-sidebar text-slate-400 flex-shrink-0 transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">FG</span>
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-tight">FireGuard</p>
            <p className="text-slate-500 text-xs">by JENIX</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isDivider = item.to === ROUTES.USERS && !collapsed;
          return (
            <div key={item.to}>
              {isDivider && <div className="border-t border-sidebar-border my-2" />}
              <NavLink
                to={item.to}
                end={item.to === ROUTES.DASHBOARD}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
                {!collapsed && item.to === ROUTES.ALARMS && unackCount > 0 && (
                  <span className="bg-brand-red text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {unackCount}
                  </span>
                )}
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-xs text-slate-600">PID: FIREGUARD-S3-01</p>
          <p className="text-xs text-slate-600">v1.0.0</p>
        </div>
      )}
    </aside>
  );
}
