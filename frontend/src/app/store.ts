import { create } from 'zustand';
import type { Site, TelemetryPayload, Alarm, User, DashboardSummary } from '@/types';
import { MOCK_SITES, MOCK_TELEMETRY } from '@/data/mockTelemetry';
import { MOCK_ALARMS } from '@/data/mockAlarms';

// ─── Auth Slice ───────────────────────────────────────────────────────────────

interface AuthSlice {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

// ─── Site Slice ───────────────────────────────────────────────────────────────

interface SiteSlice {
  sites: Site[];
  activeSiteId: string;
  setActiveSite: (id: string) => void;
}

// ─── Telemetry Slice ──────────────────────────────────────────────────────────

interface TelemetrySlice {
  telemetry: TelemetryPayload;
  setTelemetry: (t: TelemetryPayload) => void;
}

// ─── Alarm Slice ──────────────────────────────────────────────────────────────

interface AlarmSlice {
  alarms: Alarm[];
  acknowledgeAlarm: (id: string, by: string, reason: string) => void;
  addAlarm: (alarm: Alarm) => void;
}

// ─── Derived Summary ──────────────────────────────────────────────────────────

interface SummarySlice {
  summary: () => DashboardSummary;
}

// ─── Combined Store ───────────────────────────────────────────────────────────

type AppStore = AuthSlice & SiteSlice & TelemetrySlice & AlarmSlice & SummarySlice;

export const useStore = create<AppStore>((set, get) => ({
  // Auth
  user: JSON.parse(localStorage.getItem('fg_user') ?? 'null') as User | null,
  token: localStorage.getItem('fg_token'),
  login: (user, token) => {
    localStorage.setItem('fg_user', JSON.stringify(user));
    localStorage.setItem('fg_token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('fg_user');
    localStorage.removeItem('fg_token');
    set({ user: null, token: null });
  },

  // Sites
  sites: MOCK_SITES,
  activeSiteId: MOCK_SITES[0].id,
  setActiveSite: (id) => set({ activeSiteId: id }),

  // Telemetry
  telemetry: MOCK_TELEMETRY,
  setTelemetry: (t) => set({ telemetry: t }),

  // Alarms
  alarms: MOCK_ALARMS,
  acknowledgeAlarm: (id, by, reason) =>
    set((state) => ({
      alarms: state.alarms.map((a) =>
        a.id === id
          ? { ...a, acknowledged: true, acknowledgedBy: by, acknowledgedAt: new Date().toISOString(), acknowledgeReason: reason }
          : a
      ),
    })),
  addAlarm: (alarm) => set((state) => ({ alarms: [alarm, ...state.alarms] })),

  // Derived summary
  summary: () => {
    const { telemetry, alarms } = get();
    const devices = telemetry.devices;
    const deviceList = Object.values(devices);
    const devicesOnline = deviceList.filter((d) => d.online).length;
    const devicesTotal = deviceList.length;
    const siteAlarms = alarms.filter((a) => a.siteId === get().activeSiteId);
    const activeAlarms = siteAlarms.filter((a) => !a.acknowledged).length;
    const acknowledgedAlarms = siteAlarms.filter((a) => a.acknowledged).length;
    const unacknowledgedAlarms = activeAlarms;

    let systemStatus: DashboardSummary['systemStatus'] = 'NORMAL';
    if (telemetry.system.mqtt === 'disconnected' || telemetry.system.wifi === 'offline') {
      systemStatus = 'OFFLINE';
    } else if (siteAlarms.some((a) => !a.acknowledged && a.severity === 'critical')) {
      systemStatus = 'CRITICAL';
    } else if (siteAlarms.some((a) => !a.acknowledged && a.severity === 'warning')) {
      systemStatus = 'WARNING';
    }

    return { systemStatus, devicesOnline, devicesTotal, activeAlarms, acknowledgedAlarms, unacknowledgedAlarms };
  },
}));
