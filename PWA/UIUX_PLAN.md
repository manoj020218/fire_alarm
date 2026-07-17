# FireGuard UI/UX — Reusable Component Kit (for client approval)

> **Goal:** a reusable, polished component library + showcase the client approves BEFORE we build
> the full app. Direction (owner-approved 2026-07-16): **"polished NBSense"** — rich, colorful,
> gauge-heavy, tank fills, colored equipment cards, AI-insight card, live-refresh countdown — but
> **cleaner, more consistent, and more professional** than the competitor (dashboard.nbsense.com).
>
> **Beat NBSense on:** consistent semantic color (color = status, not random decoration), crisp
> SVG icons (no clipart/emoji), clear hierarchy so a CRITICAL fire alarm never looks like a routine
> reading, and mobile-responsiveness. **Match NBSense on:** radial gauges, tank fills, real-time
> refresh, AI insights.

Location: `fireguard v1/PWA/ui-kit/` (fresh Vite+React18+TS+Tailwind+Recharts — matches the Phase-1
frontend stack; mock data only, no backend). Approve here → then build real pages from this kit.

## Design tokens
- Primary: indigo/violet (#6366F1 → #7C3AED gradient, used tastefully — headers/active, not every card).
- Semantic (ONLY meaning, never decoration): online/ok #22C55E · warning #F59E0B · critical/fault/offline #EF4444 · idle/unknown #94A3B8.
- Surfaces: page #F1F5F9, card #FFFFFF, border #E2E8F0, soft shadow, rounded-2xl. Metric numbers big + bold in indigo; labels small grey; Inter font.
- Icons: crisp duotone/line SVG set (pump, pressure, tank, fuel, battery, fire-panel, PA, ventilation, valve, gateway, 4G/LAN/WiFi, alarm). NO clipart or emoji.

## Reusable components (the kit — each in its own file, ≤~150 lines)
AppShell (role-aware sidebar + topbar w/ site selector, live clock, refresh-countdown ring, alarm
bell+count, user menu) · SectionCard · KpiTile · EquipmentCard (status left-accent + pill + reading
+ Detail View) · RadialGauge (green/amber/red zones + needle + center value) · TankGauge (clean CSS
vertical fill, %+capacity) · AiInsightCard · StatusBadge · StatusDot · ConnectionStrip
(4G/LAN/WiFi/MQTT/Cloud/RS485) · RefreshCountdown · AlarmRow + AlarmTable (severity, param, value,
time, ACK; critical row highlighted) · TrendChart (Recharts area/line, tabs, threshold lines,
range) · Buttons/Inputs/Tabs/Toggle · LoginScreen (FireGuard/Jenix branded).

## Showcase (what the client opens)
1. **/kit** — component gallery: every component in all states (ok/warn/critical/offline) so the
   client sees the whole system.
2. **/dashboard** — a full sample FireGuard dashboard assembled ONLY from kit components, mock
   ABC Towers data with the 14 fire devices: top KPI strip (System status · Devices online · Active
   alarms · Water tank · DG fuel) → equipment grid (Jockey/Main1/Main2/Diesel pumps as EquipmentCards
   + Sprinkler/Hydrant pressure RadialGauges + Water/Diesel TankGauges + DG battery + Fire Panel/PA/
   Ventilation status) → AI Insight card → ConnectionStrip/Gateway panel → Recent Alarms table →
   a TrendChart. Live-refresh countdown ticking; alarm bell shows count.
3. **/login** — branded login.
Mobile-responsive throughout (Capacitor APK later).

Deliverable: runs with `pnpm dev`; `pnpm build` produces a static bundle to host for client review.
After approval, real pages compose these exact components against the live API/Socket.IO.
