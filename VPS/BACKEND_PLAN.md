# FireGuard VPS Backend — Build Plan (Phase 2)

> **Location:** `D:\IOT Device\fireguard\fireguard v1\VPS\` (build here, on the local dev machine).
> **Bar:** rock-solid, 10-year production-grade. Typed, validated, tested, no shortcuts.
> **Authoritative specs to READ first:**
> - `../CLAUDE.md` — §2 folder structure, §5 test strategy, §6 data models + RBAC roles, §7 coding
>   standards, §9 env vars. This is the primary backend spec.
> - `../Hardware/VAJRUINO_FIRMWARE_PLAN.md` — §4 telemetry JSON + MQTT topics, §10.2 the device
>   HTTP contract the backend MUST implement. The firmware is LIVE and already publishing this shape.
>
> The CLAUDE.md puts backend at `backend/`; per owner it goes under `VPS/backend/` instead. Same
> structure, just rooted in VPS/.

---

## 0. Ground truth from the working firmware (do not deviate — device is live)

**MQTT (broker 154.61.69.200:1883, user `fg_device` / pass in env, ACL `fireguard/#`):**
Device → server, retained where noted:
- `fireguard/{siteId}/{gatewayId}/telemetry` — every 10 s. Exact JSON (from live device):
  ```json
  {"pid":"FIREGUARD-S3-01","gatewayId":"JNX-FG-08F6","siteId":"SITE001","timestamp":<unix>,
   "system":{"uptime":<s>,"heap":<b>,"fw":"1.0.0","releaseDate":"2026-07-14","uplink":"wifi|lan|4g",
     "signal4g":<dBm>,"signalLan":<bool>,"rssi":<dBm>,"mqtt":"connected","cloud":"online",
     "rs485":"ok|error","wifi":"online|offline"},
   "devices":{"<deviceId>":{"value":<n>,"online":<bool>} | {"status":"ON|OFF|FAULT|NORMAL|ALARM","online":<bool>},
     "digitalInputs":{"di0..3":<bool>},"digitalOutputs":{"do0..1":<bool>}}}
  ```
- `fireguard/{siteId}/{gatewayId}/status` — every 60 s (retained): gatewayId, siteId, online, fw,
  uplink, signal4g, signalLan, uptime, heap, reset, alarmsActive.
- `fireguard/{siteId}/{gatewayId}/alarm` — immediate on alarm: alarmId, siteId, gatewayId, deviceId,
  parameter, value, severity(warning|critical), timestamp, active(bool).
Server → device (backend PUBLISHES these): `.../config/set`, `.../command`, `.../ota`
  (ota payloads: `{"cmd":"check"}` / `{"cmd":"update"}`).

**Device HTTP contract (backend MUST implement — base `/api/fireguard`, auth headers
`X-Gateway-Id` + `X-Gateway-Token`):**
- `GET  /api/fireguard/ota/manifest?gw={id}&fw={ver}&hw=vvm401` → 200
  `{version,url,sha256,size,mandatory,minFrom}` or **204** if up to date.
- `POST /api/fireguard/backup` → body `{gatewayId,fwVersion,ts,config,alarmState,undelivered,health}`
  → 200 `{ok:true,backupId}`. (Device will NOT OTA without this 200 — store it durably.)
- `POST /api/fireguard/ingest` → telemetry HTTP fallback (same JSON as MQTT telemetry).
- `POST /api/fireguard/alarm` → alarm HTTP fallback.

---

## 1. Stack (locked by CLAUDE.md)

Node 20 + Express + **TypeScript (strict, no `any`)** · MongoDB + Mongoose · Socket.IO ·
MQTT.js (subscribe broker) · JWT (jsonwebtoken) + bcryptjs · **Zod** validation · pino logger ·
Jest + Supertest + **mongodb-memory-server** (tests need no local Mongo). Package manager **pnpm**.
Runtime needs a `MONGO_URI` (VPS Mongo or Atlas); tests are self-contained in-memory.

---

## 2. Build order (3 phases, each COMPILES + TESTS green before the next)

### Phase 2A — Foundation
Scaffold `VPS/backend` (package.json, tsconfig strict, eslint, jest config, .env.example, .gitignore).
Zod-validated env config (`config/env.ts`), Mongoose connect (`config/db.ts`), pino logger,
asyncHandler, central error handler, JWT auth service + `auth.middleware` + `rbac.middleware`
(5 roles: JENIX_SUPER_ADMIN > VENDOR_ADMIN > CLIENT_ADMIN > MAINTENANCE_USER > VIEWER).
**All 10 Mongoose models** with schemas + indexes: User, Site, Gateway, Device, Telemetry,
Alarm, Report, AuditLog, MaintenanceLog, DeviceConfig (+ a GatewayBackup model for the OTA backup
payload, + FirmwareRelease model for OTA manifests). Money/precision N/A here. Multi-tenant scoping
(siteId) baked into models + a scoping helper. Unit tests for auth service + model validation.

### Phase 2B — REST API for the PWA
Controllers + routes + Zod schemas + services for: auth (login/refresh/logout, seeded users),
sites, gateways (+ config get/set that publishes to MQTT `config/set`), devices, alarms
(list/filter/ack with reason → audit), telemetry (latest + range query, downsampled), reports
(generate CSV/PDF stub + list), users (RBAC-gated CRUD), maintenance logs. Audit-log every write.
Site-level tenant isolation enforced in every query. Integration tests (Supertest + in-memory Mongo)
for every endpoint incl. authz negative cases (VIEWER can't ack, cross-site denied, etc.).

### Phase 2C — Real-time + device contract + ops
- **MQTT ingestion service**: connect broker (env creds), subscribe `fireguard/#`, parse
  telemetry/status/alarm, upsert Gateway last-seen + latest telemetry, insert Telemetry docs
  (with TTL/retention), run alarm dedup/store, mark gateway offline on heartbeat gap (>2 min).
  Robust: reconnect, malformed-payload guard, backpressure-safe, never crash on bad input.
- **Socket.IO**: broadcast telemetry/alarm/gateway-status to subscribed site rooms; JWT handshake auth.
- **Device HTTP contract** (§0): `/api/fireguard/ingest|alarm|backup|ota/manifest` with
  `X-Gateway-Token` device auth (per-gateway token, provisioned/stored on Gateway model; the
  firmware already generates one and sends it). OTA: FirmwareRelease collection + binary hosting
  (serve signed .bin, sha256), manifest logic (compare fw vs latest per hw, respect minFrom/mandatory).
  Backup: persist to GatewayBackup durably, return backupId (gate the device OTA).
- Audit logging on device-config/OTA actions. Notification service stubs (FCM/WhatsApp/Email —
  on-device SMS already covers critical). Seed script (ABC Towers SITE001, gateway JNX-FG-XXXX,
  5 role users). Regression scenarios per CLAUDE.md §5 (10 e2e flows incl. telemetry-ingest-socket,
  alarm-trigger-ack, device-offline-detect, multi-site-isolation, gateway-config-update).

---

## 3. Non-negotiables (10-year bar)
- TypeScript strict; no `any`, no `@ts-ignore`. Zod at every trust boundary (HTTP body, MQTT payload,
  env). Every money-free numeric still range-checked. Files ≤ ~200 lines.
- Every write → AuditLog. Every route → integration test. Every service fn → unit test.
- No secrets in code; `.env.example` only; JWT secret + MQTT creds + device tokens from env/DB.
- Graceful shutdown (SIGTERM: close MQTT, socket, Mongo). Health endpoint. Structured logs.
- MQTT + HTTP ingestion must be idempotent and crash-proof against malformed device data.
- Deployable to the VPS later (PM2), but built + fully tested locally now (mongodb-memory-server).

## 4. Verification each phase
`pnpm run build` (tsc, 0 errors) + `pnpm test` (all green, coverage per CLAUDE.md targets) before
advancing. Do NOT deploy; do NOT touch the live broker's other products. Report coverage + any
deviations.
