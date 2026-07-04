# JENIX FireGuard v1 — Master Plan & Session Log

> **RULE FOR ALL SESSIONS:** Read this file FIRST before touching any code. Update the
> Session Log section at the END of every session before closing. This file is the single
> source of truth for project state, decisions, and progress.

---

## 1. PROJECT OVERVIEW

**Product:** JENIX FireGuard — Smart Fire Fighting System Monitoring  
**PID:** FIREGUARD-S3-01  
**Client:** Jenix (internal product, delivering to end client)  
**Reference:** FloodGuard (D:\IOT Device\RUB\FloodGuard) — same architecture family  
**Goal:** Cloud dashboard + Mobile APK for RS485-based fire fighting equipment monitoring  
**Horizon:** 10-year production system — code quality must match that lifespan  

### Hardware Stack
- ESP32-S3 N16R8 as RS485 Modbus RTU Master (MAX485 chip)
- 14 RS485 field devices (pumps, sensors, panels)
- MQTT primary / HTTP fallback communication

### Software Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| State | Zustand |
| Charts | Recharts |
| Router | React Router v6 |
| HTTP Client | Axios |
| Real-time | Socket.IO client |
| Icons | react-icons |
| PWA | Vite PWA plugin + workbox |
| Mobile | Capacitor v5 |
| Backend | Node.js 20 + Express + TypeScript |
| Database | MongoDB 7 + Mongoose |
| Real-time | Socket.IO server |
| IoT | MQTT v5 (aedes broker or external) |
| Auth | JWT + bcryptjs |
| Validation | Zod |
| Package Mgr | pnpm |
| Frontend Tests | Vitest + @testing-library/react + MSW |
| Backend Tests | Jest + Supertest + mongodb-memory-server |
| Firmware | PlatformIO + Arduino framework |

---

## 2. FOLDER STRUCTURE

```
fireguard v1/
├── CLAUDE.md                          ← THIS FILE — always read first
├── frontend/                          ← React PWA (Phase 1 — CURRENT PRIORITY)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json
│   │   ├── icons/                     ← PWA icons (192, 512, maskable)
│   │   └── robots.txt
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── app/
│       │   ├── store.ts               ← Zustand global store
│       │   └── router.tsx             ← Route definitions
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx        ← Dark navy sidebar, FireGuard logo, nav items
│       │   │   ├── TopBar.tsx         ← Site selector, clock, bell, user menu
│       │   │   └── AppLayout.tsx      ← Wrapper: sidebar + topbar + outlet
│       │   ├── cards/
│       │   │   ├── StatusCard.tsx     ← Reusable status card (icon, label, value, color)
│       │   │   └── EquipmentCard.tsx  ← Equipment item card (icon, status badge, value)
│       │   ├── icons/                 ← Custom SVG icon components
│       │   │   ├── PumpIcon.tsx
│       │   │   ├── PressureIcon.tsx
│       │   │   ├── TankIcon.tsx
│       │   │   ├── BatteryIcon.tsx
│       │   │   ├── FuelIcon.tsx
│       │   │   ├── FirePanelIcon.tsx
│       │   │   ├── PASystemIcon.tsx
│       │   │   ├── VentilationIcon.tsx
│       │   │   ├── ValveIcon.tsx
│       │   │   ├── GatewayIcon.tsx
│       │   │   └── CloudIcon.tsx
│       │   ├── charts/
│       │   │   ├── TrendChart.tsx     ← Recharts LineChart wrapper
│       │   │   └── MiniSparkline.tsx  ← Small inline trend
│       │   ├── tables/
│       │   │   ├── AlarmTable.tsx     ← Alarm rows with ACK button
│       │   │   └── DeviceTable.tsx    ← RS485 device list
│       │   └── status/
│       │       ├── StatusBadge.tsx    ← green/red/orange pill
│       │       └── ConnectionDots.tsx ← WiFi/MQTT/Cloud/RS485 dots
│       ├── pages/
│       │   ├── Login/
│       │   │   └── LoginPage.tsx
│       │   ├── Dashboard/
│       │   │   ├── DashboardPage.tsx  ← Main layout orchestrator
│       │   │   ├── SummaryBar.tsx     ← 5 status cards top row
│       │   │   ├── PumpRoomMap.tsx    ← Icon-based equipment diagram center
│       │   │   └── RightPanel.tsx     ← Comm status + quick actions
│       │   ├── LiveMonitor/
│       │   │   └── LiveMonitorPage.tsx
│       │   ├── Alarms/
│       │   │   ├── AlarmsPage.tsx
│       │   │   └── AckModal.tsx       ← Acknowledge dialog with reason
│       │   ├── Reports/
│       │   │   └── ReportsPage.tsx
│       │   ├── Trends/
│       │   │   └── TrendsPage.tsx
│       │   ├── Devices/
│       │   │   ├── DevicesPage.tsx
│       │   │   └── RegisterMapTable.tsx
│       │   ├── Maintenance/
│       │   │   └── MaintenancePage.tsx
│       │   ├── Users/
│       │   │   └── UsersPage.tsx
│       │   ├── Settings/
│       │   │   └── SettingsPage.tsx
│       │   └── APIIntegration/
│       │       └── APIIntegrationPage.tsx
│       ├── services/
│       │   ├── api.ts                 ← Axios instance + typed request helpers
│       │   ├── socket.ts              ← Socket.IO client singleton + event helpers
│       │   └── auth.ts                ← JWT store/retrieve, login/logout
│       ├── hooks/
│       │   ├── useSocket.ts           ← Subscribe to socket events
│       │   ├── useAuth.ts             ← Auth state + role checks
│       │   ├── useDashboard.ts        ← Dashboard data polling/socket
│       │   └── useAlarms.ts           ← Alarm list + ack action
│       ├── types/
│       │   └── index.ts               ← All shared TypeScript types
│       ├── utils/
│       │   ├── formatters.ts          ← Date, unit, status formatters
│       │   └── constants.ts           ← Routes, colors, equipment IDs
│       └── data/
│           ├── mockTelemetry.ts       ← Static mock for ABC Towers demo
│           └── mockAlarms.ts
├── backend/                           ← Node.js + Express (Phase 2)
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── server.ts                  ← HTTP + Socket.IO server boot
│       ├── app.ts                     ← Express app factory (testable)
│       ├── config/
│       │   ├── env.ts                 ← Zod-validated env
│       │   ├── db.ts                  ← Mongoose connect
│       │   └── mqtt.ts                ← MQTT client config
│       ├── models/
│       │   ├── User.ts
│       │   ├── Site.ts
│       │   ├── Gateway.ts
│       │   ├── Device.ts
│       │   ├── Telemetry.ts
│       │   ├── Alarm.ts
│       │   ├── Report.ts
│       │   ├── AuditLog.ts
│       │   ├── MaintenanceLog.ts
│       │   └── DeviceConfig.ts
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── ingest.routes.ts
│       │   ├── sites.routes.ts
│       │   ├── alarms.routes.ts
│       │   ├── reports.routes.ts
│       │   ├── gateways.routes.ts
│       │   └── admin.routes.ts
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── ingest.controller.ts
│       │   ├── sites.controller.ts
│       │   ├── alarms.controller.ts
│       │   ├── reports.controller.ts
│       │   └── gateways.controller.ts
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── telemetry.service.ts
│       │   ├── alarm.service.ts
│       │   ├── notification.service.ts  ← FCM + WhatsApp + Email placeholders
│       │   ├── report.service.ts
│       │   ├── audit.service.ts
│       │   └── device.service.ts
│       ├── mqtt/
│       │   ├── mqttClient.ts          ← MQTT connect + subscribe
│       │   └── mqttHandlers.ts        ← Per-topic message handlers
│       ├── socket/
│       │   └── socketServer.ts        ← Socket.IO server + broadcast helpers
│       ├── middleware/
│       │   ├── auth.middleware.ts      ← JWT verify + role check
│       │   ├── rbac.middleware.ts      ← Role-based route guard
│       │   ├── validate.middleware.ts  ← Zod schema validation
│       │   └── errorHandler.ts
│       └── utils/
│           ├── logger.ts
│           └── asyncHandler.ts
├── tests/                             ← All tests (frontend + backend)
│   ├── frontend/
│   │   ├── unit/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── utils/
│   │   └── integration/
│   │       └── pages/
│   ├── backend/
│   │   ├── unit/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   ├── integration/
│   │   │   ├── routes/
│   │   │   └── mqtt/
│   │   └── regression/
│   │       └── scenarios/
│   └── shared/
│       └── fixtures/                  ← Shared test data (ABC Towers seed)
├── seed/
│   ├── abcTowers.seed.ts             ← Full ABC Towers, Mumbai demo data
│   └── run-seed.ts
└── hardware/                          ← ESP32-S3 PlatformIO (Phase 5)
    ├── platformio.ini
    ├── README.md
    └── src/
        ├── main.cpp
        ├── config/pins.h
        ├── modbus/
        ├── mqtt/
        ├── http/
        ├── webui/
        ├── ota/
        ├── storage/
        ├── alarms/
        └── utils/
```

---

## 3. EXECUTION PHASES

### PHASE 1 — PWA Dashboard (ACTIVE — Client Approval Target)
Build the full React PWA with mock data so client can approve the UI.
No backend required at this stage. All data from `mockTelemetry.ts`.

**Deliverables:**
- [x] 1.1 Project scaffold (Vite + React + TS + Tailwind + pnpm)
- [x] 1.2 TypeScript types (`types/index.ts`)
- [x] 1.3 Custom SVG icon components (all 11 equipment icons)
- [x] 1.4 Layout components: Sidebar, TopBar, AppLayout
- [x] 1.5 StatusCard + EquipmentCard + StatusBadge components
- [x] 1.6 Mock data: ABC Towers telemetry + alarms
- [x] 1.7 Zustand store wired to mock data
- [x] 1.8 Login page (mock auth, JWT stored in localStorage)
- [x] 1.9 Dashboard page — full layout (SummaryBar + PumpRoomMap + RightPanel + AlarmTable)
- [x] 1.10 AlarmTable with mock ACK flow
- [x] 1.11 Live Monitor page — all 14 parameters as live cards
- [x] 1.12 Alarms page — history + filter + ACK modal
- [x] 1.13 Trends page — Recharts with mock historical data
- [x] 1.14 Devices page — RS485 device list + register map table
- [x] 1.15 Reports page — generate button (mock download)
- [x] 1.16 Maintenance page — log list
- [x] 1.17 Users page — RBAC table (read-only for non-admins)
- [x] 1.18 Settings page — site config, thresholds
- [x] 1.19 API Integration page — token display, webhook config
- [x] 1.20 PWA manifest + service worker + offline fallback
- [x] 1.21 Responsive: mobile view for Capacitor APK
- [x] 1.22 Mock Socket.IO simulation (setInterval events in dev mode)
- [x] 1.23 `pnpm dev` works cleanly, zero TypeScript errors
- [x] 1.24 Frontend unit tests pass — 43/43 tests passing

### PHASE 2 — Backend API
- [ ] 2.1 Express + TypeScript project scaffold
- [ ] 2.2 Zod-validated env config
- [ ] 2.3 Mongoose models (10 collections)
- [ ] 2.4 JWT auth controller + middleware
- [ ] 2.5 RBAC middleware (5 roles)
- [ ] 2.6 All REST routes + controllers
- [ ] 2.7 Telemetry + alarm service logic
- [ ] 2.8 MQTT ingestion service
- [ ] 2.9 Socket.IO server + broadcast on telemetry/alarm
- [ ] 2.10 Audit logging on every write action
- [ ] 2.11 Notification service (FCM + WhatsApp + Email stubs)
- [ ] 2.12 Seed script: ABC Towers, Mumbai
- [ ] 2.13 .env.example documented
- [ ] 2.14 Backend unit + integration tests pass

### PHASE 3 — Frontend ↔ Backend Integration
- [ ] 3.1 Replace mock data with real API calls
- [ ] 3.2 Real Socket.IO connection to backend
- [ ] 3.3 Real login/logout flow
- [ ] 3.4 Alarm ACK writes to DB + broadcasts
- [ ] 3.5 Report generation (PDF/Excel/CSV)
- [ ] 3.6 Full regression test suite passes

### PHASE 4 — Mobile APK (Capacitor)
- [ ] 4.1 Capacitor install + android project init
- [ ] 4.2 Mobile-specific responsive overrides
- [ ] 4.3 FCM push notification plugin
- [ ] 4.4 APK build + signing
- [ ] 4.5 6 mobile screen flows tested

### PHASE 5 — Hardware Firmware
- [ ] 5.1 PlatformIO project scaffold
- [ ] 5.2 WiFi provisioning (BLE + AP)
- [ ] 5.3 RS485 Modbus RTU master module
- [ ] 5.4 MQTT telemetry publish
- [ ] 5.5 Alarm engine
- [ ] 5.6 Local web UI
- [ ] 5.7 NVS config storage
- [ ] 5.8 OTA placeholder
- [ ] 5.9 Watchdog + millis scheduler

---

## 4. UI DESIGN DECISIONS

### Color Palette
```
Sidebar bg:          #0F172A  (slate-900)
Sidebar accent:      #1E3A5F  (navy)
Sidebar text:        #94A3B8  (slate-400)
Sidebar active:      #EF4444  (red-500) + white text
Primary accent:      #1D4ED8  (blue-700)
Alarm / danger:      #EF4444  (red-500)
Warning:             #F59E0B  (amber-500)
OK / online:         #22C55E  (green-500)
Offline / unknown:   #6B7280  (gray-500)
Card bg:             #FFFFFF
Page bg:             #F1F5F9  (slate-100)
TopBar bg:           #FFFFFF
Border:              #E2E8F0
```

### Layout
```
Desktop (≥1024px):
  [Sidebar 240px] [Main content flex-1]
  TopBar spans full width inside main
  3-column main: [PumpRoomMap flex-1] [RightPanel 280px]

Tablet (768-1023px):
  Sidebar collapses to icon-only (56px)

Mobile (<768px):
  Sidebar hidden, bottom nav bar
  Stack layout, full-width cards
```

### Sidebar Navigation Order
1. Dashboard (home icon)
2. Live Monitor (activity icon)
3. Alarms (bell icon) — badge with unACK count
4. Trends (trending-up icon)
5. Reports (file-text icon)
6. Devices (cpu icon)
7. Maintenance (wrench icon)
8. — divider —
9. Users (users icon) [ADMIN only]
10. Settings (settings icon)
11. API Integration (link icon) [SUPER ADMIN only]

### Dashboard Page Layout (3 rows)
```
Row 1: [System Status] [Devices Online] [Active Alarms] [Acknowledged] [Unacknowledged]
Row 2: [PumpRoomMap - center, 2/3 width] | [RightPanel - 1/3 width]
Row 3: [AlarmTable - full width]
```

### PumpRoomMap Equipment Grid (3x4 grid of cards)
Row 1: Jockey Pump | Main Pump 1 | Main Pump 2 | Diesel Pump
Row 2: Sprinkler Line | Hydrant Line | Water Tank | DG Fuel
Row 3: DG Battery | Fire Alarm Panel | PA System | Ventilation

Each card: Icon (40px) + Name + Status badge + Live value

### Right Panel Sections
1. **Gateway Status** — name, online/offline, RSSI
2. **Communication** — WiFi / MQTT / Cloud / RS485 dots
3. **Quick Actions** — Acknowledge All, Test Alarm, Refresh
4. **System Health** — Uptime, FW version, Last seen

---

## 5. TESTING STRATEGY

### Principle
- Tests are written ALONGSIDE code, not after
- Every component has at least a smoke test (renders without crash)
- Every service function has a unit test
- Every API route has an integration test
- Regression scenarios cover full user workflows

### Frontend Tests (Vitest + @testing-library/react + MSW)

#### Unit Tests — Components
```
tests/frontend/unit/components/
  StatusCard.test.tsx          — renders label, value, correct color per status
  EquipmentCard.test.tsx       — renders icon, status badge, value
  StatusBadge.test.tsx         — renders correct color/text for each status enum
  AlarmTable.test.tsx          — renders rows, ACK button visible, fires callback
  ConnectionDots.test.tsx      — renders correct dot colors
  Sidebar.test.tsx             — nav items render, active item highlighted
  TopBar.test.tsx              — site selector, clock, bell badge
  AckModal.test.tsx            — form validation, submit with reason
```

#### Unit Tests — Hooks
```
tests/frontend/unit/hooks/
  useAuth.test.ts              — login sets token, logout clears, role check
  useAlarms.test.ts            — loads alarms, ack updates state
  useDashboard.test.ts         — loads telemetry, updates on socket event
```

#### Unit Tests — Utils
```
tests/frontend/unit/utils/
  formatters.test.ts           — date format, unit label, status string
  constants.test.ts            — route paths defined
```

#### Integration Tests — Pages
```
tests/frontend/integration/pages/
  LoginPage.test.tsx           — fill form, submit, redirect to dashboard
  DashboardPage.test.tsx       — renders summary cards + pump room + alarm table
  AlarmsPage.test.tsx          — filter, sort, ack flow end-to-end
  LiveMonitorPage.test.tsx     — all 14 parameters displayed
  TrendsPage.test.tsx          — chart renders, date range selector works
  DevicesPage.test.tsx         — device list + register map
```

### Backend Tests (Jest + Supertest + mongodb-memory-server)

#### Unit Tests — Services
```
tests/backend/unit/services/
  alarm.service.test.ts        — threshold check, alarm creation, dedup
  telemetry.service.test.ts    — parse, validate, store telemetry payload
  auth.service.test.ts         — hashPassword, comparePassword, signToken, verifyToken
  audit.service.test.ts        — log entry created on each action
  notification.service.test.ts — stubs called with correct payload
```

#### Unit Tests — Utils
```
tests/backend/unit/utils/
  logger.test.ts               — does not throw
  asyncHandler.test.ts         — wraps async, calls next(err) on throw
```

#### Integration Tests — Routes (in-memory MongoDB)
```
tests/backend/integration/routes/
  auth.routes.test.ts          — POST /api/auth/login success + fail cases
  ingest.routes.test.ts        — POST /api/ingest/telemetry valid + invalid payload
  sites.routes.test.ts         — GET /api/sites auth required, returns seeded sites
  alarms.routes.test.ts        — GET alarms, POST ack with reason
  reports.routes.test.ts       — POST generate, GET list
  gateways.routes.test.ts      — GET config, PUT config updates
```

#### Integration Tests — MQTT
```
tests/backend/integration/mqtt/
  mqttHandlers.test.ts         — telemetry message → stored in DB + socket broadcast
                                  alarm message → stored + notification stub called
```

#### Regression Scenarios (Full E2E without browser)
```
tests/backend/regression/scenarios/
  01-login-dashboard.test.ts          — login → GET dashboard → correct site data
  02-telemetry-ingest-socket.test.ts  — ingest telemetry → socket event fired → DB updated
  03-alarm-trigger-ack.test.ts        — alarm ingest → appears in GET alarms → POST ack → acknowledged
  04-role-viewer-readonly.test.ts     — VIEWER cannot POST ack, cannot access /users
  05-role-maintenance-access.test.ts  — MAINTENANCE can log maintenance, cannot manage users
  06-device-offline-detect.test.ts    — no heartbeat for 2min → device marked offline
  07-report-generate-download.test.ts — POST generate → GET report file
  08-audit-log-completeness.test.ts   — every write action creates audit entry
  09-multi-site-isolation.test.ts     — site A user cannot see site B data
  10-gateway-config-update.test.ts    — PUT config → GET config returns updated values
```

### Test Coverage Targets
| Area | Target |
|------|--------|
| Frontend components | 80% |
| Frontend hooks | 90% |
| Backend services | 95% |
| Backend routes | 100% of endpoints |
| Regression scenarios | 10/10 pass |

---

## 6. DATA MODELS (Key fields)

### Telemetry Shape (matches hardware JSON)
```typescript
interface TelemetryPayload {
  pid: string;
  gatewayId: string;
  siteId: string;
  timestamp: number;
  system: {
    wifi: 'online' | 'offline';
    mqtt: 'connected' | 'disconnected';
    cloud: 'online' | 'offline';
    rs485: 'ok' | 'error';
    rssi: number;
    uptime: number;
    fw: string;
    releaseDate: string;
  };
  devices: {
    jockeyPump: { status: 'ON' | 'OFF' | 'FAULT'; online: boolean };
    mainPump1: { status: 'ON' | 'OFF' | 'FAULT'; online: boolean };
    mainPump2: { status: 'ON' | 'OFF' | 'FAULT'; online: boolean };
    dieselPump: { status: 'ON' | 'OFF' | 'FAULT'; online: boolean };
    sprinklerPressure: { value: number; unit: 'bar'; online: boolean };
    hydrantPressure: { value: number; unit: 'bar'; online: boolean };
    waterTankLevel: { value: number; unit: '%'; online: boolean };
    dgFuelLevel: { value: number; unit: '%'; online: boolean };
    dgBattery: { value: number; unit: 'V'; online: boolean };
    fireAlarmPanel: { status: 'NORMAL' | 'ALARM' | 'FAULT'; online: boolean };
    paSystem: { status: 'NORMAL' | 'FAULT'; online: boolean };
    ventilation: { status: 'ON' | 'OFF' | 'FAULT'; online: boolean };
  };
}
```

### Alarm Shape
```typescript
interface Alarm {
  alarmId: string;
  siteId: string;
  gatewayId: string;
  deviceId: string;       // e.g. 'sprinklerPressure'
  parameter: string;      // e.g. 'sprinkler_pressure_low'
  value: number | string;
  severity: 'warning' | 'critical';
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  acknowledgeReason?: string;
}
```

### User Roles (ordered by permission level)
```
JENIX_SUPER_ADMIN  → all sites, all users, API integration, system settings
VENDOR_ADMIN       → multi-site, can manage CLIENT_ADMIN and below
CLIENT_ADMIN       → single org, manages MAINTENANCE_USER and VIEWER
MAINTENANCE_USER   → can acknowledge alarms, log maintenance, read-only otherwise
VIEWER             → read-only dashboard, alarms, trends
```

### Seed Data — ABC Towers, Mumbai (SITE001)
```
Site: ABC Towers, Mumbai
Gateway: JNX-FG-AB12
Users:
  admin@jenix.io        / Pass@123  → JENIX_SUPER_ADMIN
  vendor@jenix.io       / Pass@123  → VENDOR_ADMIN
  admin@abctowers.com   / Pass@123  → CLIENT_ADMIN
  maint@abctowers.com   / Pass@123  → MAINTENANCE_USER
  viewer@abctowers.com  / Pass@123  → VIEWER
```

---

## 7. CODING STANDARDS (enforce in every file)

1. **File size:** Frontend components max 200 lines. Backend controllers/services max 200 lines.
2. **TypeScript:** No `any`. No `@ts-ignore`. Strict mode on.
3. **Imports:** No barrel re-exports from `index.ts` if it causes circular deps.
4. **Comments:** Only where the WHY is non-obvious. No "what" comments.
5. **Error handling:** All async controllers wrapped in `asyncHandler`. Frontend: Axios error interceptor + toast.
6. **Env vars:** Never hardcoded. Always from validated env config.
7. **Secrets:** No credentials in code or seed files (use .env.example pattern).
8. **Naming:** PascalCase components, camelCase functions/vars, UPPER_SNAKE_CASE constants.
9. **Tests:** Write test file alongside implementation file, same commit.
10. **Git:** Feature → test → commit together. No TODO items left in committed code.

---

## 8. KEY ARCHITECTURE DECISIONS

| Decision | Choice | Reason |
|----------|--------|--------|
| State management | Zustand | Minimal boilerplate, no Provider hell, easier testing |
| Styling | Tailwind CSS | Fast iteration for PWA demo approval |
| Charts | Recharts | Best React integration, TypeScript-first |
| Auth storage | httpOnly cookie (prod) / localStorage (dev) | XSS protection in production |
| MongoDB driver | Mongoose | Schema validation, middleware hooks |
| MQTT library | mqtt.js (client) | Lightweight, browser+node compatible |
| Socket.IO transport | WebSocket with polling fallback | Reliability behind proxies |
| Report generation | exceljs + pdfkit | No heavy SaaS dependency |
| PWA caching | vite-plugin-pwa + workbox | Auto-generates SW, cache strategies |
| File-based vs MongoDB | MongoDB (as client specified) | Scalability for multi-site |

---

## 9. ENVIRONMENT VARIABLES

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=development
```

### Backend (.env)
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/fireguard
JWT_SECRET=<random-256-bit>
JWT_EXPIRY=8h
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
CORS_ORIGIN=http://localhost:5173
FCM_SERVER_KEY=<placeholder>
NODE_ENV=development
```

---

## 10. COMMANDS REFERENCE

```bash
# Frontend
cd frontend
pnpm install
pnpm dev           # start dev server on :5173
pnpm build         # production build
pnpm preview       # preview production build
pnpm test          # Vitest unit + integration
pnpm test:coverage # coverage report

# Backend
cd backend
pnpm install
pnpm dev           # ts-node-dev on :3001
pnpm build         # tsc compile
pnpm start         # compiled production
pnpm test          # Jest all
pnpm test:unit     # unit only
pnpm test:int      # integration only
pnpm test:reg      # regression only
pnpm seed          # run seed script

# Full stack quick start
# Terminal 1: cd backend && pnpm dev
# Terminal 2: cd frontend && pnpm dev
```

---

## 11. SESSION LOG

### Session 2 — 2026-07-04
**Focus:** Phase 1 — Full PWA frontend build  
**Completed (Phase 1 tasks):**
- [x] 1.1 Project scaffold (Vite + React + TS + Tailwind + pnpm) — manual files, pnpm install done
- [x] 1.2 TypeScript types (types/index.ts) — full types for all entities
- [x] 1.3 Custom SVG icon components (all 11: Pump, Pressure, Tank, Battery, Fuel, FirePanel, PA, Ventilation, Valve, Gateway, Cloud)
- [x] 1.4 Layout: Sidebar (collapsible, role-aware nav, alarm badge), TopBar (site selector, clock, bell), AppLayout
- [x] 1.5 StatusCard + EquipmentCard + StatusBadge + ConnectionDots components
- [x] 1.6 Mock data: ABC Towers telemetry + alarms (5 alarms, 3 maintenance logs, 2 reports, register map)
- [x] 1.7 Zustand store wired to mock data (auth + site + telemetry + alarms + summary)
- [x] 1.8 Login page (mock auth, demo credentials, role-based, redirect)
- [x] 1.9 Dashboard page (SummaryBar + PumpRoomMap + RightPanel + AlarmTable)
- [x] 1.10 AlarmTable with filter tabs + ACK flow
- [x] 1.11 Live Monitor page (all 14 parameters as live cards, pulsing indicators)
- [x] 1.12 Alarms page (history + filter + ACK modal with required reason)
- [x] 1.13 Trends page (Recharts with mock 24h historical data, warning/critical thresholds)
- [x] 1.14 Devices page (RS485 register map table with hex addresses + FC codes)
- [x] 1.15 Reports page (type+format selector + previous reports list)
- [x] 1.16 Maintenance page (log list with type badges)
- [x] 1.17 Users page (RBAC-gated, role badges)
- [x] 1.18 Settings page (alarm thresholds + notification placeholders)
- [x] 1.19 API Integration page (SUPER_ADMIN gated, token, MQTT topics, REST endpoints)
- [x] 1.20 PWA manifest + favicon SVG (service worker via vite-plugin-pwa)
- [x] 1.21 Responsive: sidebar collapses, mobile-friendly card layouts
- [x] 1.22 Mock Socket.IO simulation (8s interval, jittered telemetry)
- [x] 1.23 pnpm dev works cleanly, zero TypeScript errors
- [x] 1.24 43/43 unit tests pass (formatters, StatusBadge, StatusCard, AlarmTable, useAuth, useAlarms)

**Dev server:** http://localhost:5173 ✓  
**Tests:** 43/43 ✓  
**TypeScript:** 0 errors ✓  

**Not yet done (Phase 1 remaining):**
- [ ] Integration tests for pages (LoginPage, DashboardPage, AlarmsPage, etc.)
- [ ] StatusCard smoke tests for colors  
- [ ] AckModal unit tests
- [ ] ConnectionDots unit tests

**Next session must start with:** 
1. Run `pnpm test` to confirm 43/43 still pass
2. Write remaining integration tests for pages (LoginPage, DashboardPage, AlarmsPage)
3. Then present app to client for dashboard approval
4. After approval, start Phase 2 (backend)

### Session 1 — 2026-07-03
**Focus:** Project planning, CLAUDE.md creation  
**Completed:**
- Read FloodGuard project (reference architecture)
- Read both client prompts (PWA + Hardware)
- Created comprehensive CLAUDE.md with full plan, folder structure, test strategy, design decisions
**Next session must start with:** Phase 1.1 — Frontend scaffold (Vite + React + TS + Tailwind + pnpm)

---
<!-- ADD NEW SESSION ENTRIES ABOVE THIS LINE -->
<!-- FORMAT: ### Session N — YYYY-MM-DD -->
<!-- Include: Focus, Completed checkboxes from Section 3, blockers, next session start point -->
