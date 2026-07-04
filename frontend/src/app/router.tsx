import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/Login/LoginPage';
import { DashboardPage } from '@/pages/Dashboard/DashboardPage';
import { LiveMonitorPage } from '@/pages/LiveMonitor/LiveMonitorPage';
import { AlarmsPage } from '@/pages/Alarms/AlarmsPage';
import { TrendsPage } from '@/pages/Trends/TrendsPage';
import { ReportsPage } from '@/pages/Reports/ReportsPage';
import { DevicesPage } from '@/pages/Devices/DevicesPage';
import { MaintenancePage } from '@/pages/Maintenance/MaintenancePage';
import { UsersPage } from '@/pages/Users/UsersPage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';
import { APIIntegrationPage } from '@/pages/APIIntegration/APIIntegrationPage';
import { ROUTES } from '@/utils/constants';
import { useAuth } from '@/hooks/useAuth';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to={ROUTES.LOGIN} replace />;
}

export const router = createBrowserRouter([
  { path: ROUTES.LOGIN, element: <LoginPage /> },
  {
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { path: ROUTES.DASHBOARD,       element: <DashboardPage />      },
      { path: ROUTES.LIVE_MONITOR,    element: <LiveMonitorPage />    },
      { path: ROUTES.ALARMS,          element: <AlarmsPage />         },
      { path: ROUTES.TRENDS,          element: <TrendsPage />         },
      { path: ROUTES.REPORTS,         element: <ReportsPage />        },
      { path: ROUTES.DEVICES,         element: <DevicesPage />        },
      { path: ROUTES.MAINTENANCE,     element: <MaintenancePage />    },
      { path: ROUTES.USERS,           element: <UsersPage />          },
      { path: ROUTES.SETTINGS,        element: <SettingsPage />       },
      { path: ROUTES.API_INTEGRATION, element: <APIIntegrationPage /> },
      { path: '*',                    element: <Navigate to={ROUTES.DASHBOARD} replace /> },
    ],
  },
]);
