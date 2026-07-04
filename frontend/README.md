# JENIX FireGuard — Frontend PWA

React + TypeScript + Tailwind CSS dashboard for Smart Fire Fighting System Monitoring.

## Quick Start

```bash
cd frontend
pnpm install
pnpm dev          # http://localhost:5173
```

## Demo Login

| Email | Password | Role |
|-------|----------|------|
| admin@jenix.io | Pass@123 | JENIX_SUPER_ADMIN |
| vendor@jenix.io | Pass@123 | VENDOR_ADMIN |
| admin@abctowers.com | Pass@123 | CLIENT_ADMIN |
| maint@abctowers.com | Pass@123 | MAINTENANCE_USER |
| viewer@abctowers.com | Pass@123 | VIEWER |

## Commands

```bash
pnpm dev            # Dev server on :5173
pnpm build          # Production build
pnpm preview        # Preview production build
pnpm test           # Run all tests
pnpm test:coverage  # Coverage report
```

## Phase 1 (Current)

This is the **PWA Demo** — all data is mock/static. No backend required.
Socket simulation fires every 8 seconds with jittered telemetry values.

## Architecture

```
src/
  app/         Zustand store + router
  components/  Reusable UI (layout, cards, icons, charts, tables, status)
  pages/       12 pages (Login, Dashboard, LiveMonitor, Alarms, ...)
  services/    api.ts (Axios), socket.ts (mock), auth.ts
  hooks/       useAuth, useSocket, useAlarms, useDashboard
  types/       All TypeScript interfaces
  utils/       formatters, constants
  data/        Mock telemetry + alarms (ABC Towers, Mumbai)
```

## CLAUDE.md

See `../CLAUDE.md` for the full project plan, test strategy, and session log.
