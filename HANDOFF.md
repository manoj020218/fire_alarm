# FireGuard — Session Handoff (2026-07-20)

Quick-start context so no full recall is needed. Deep detail lives in
`OTA_VPS_DEBUG.md` (OTA root causes/fixes) and `SIM_UPLINK_PLAN.md` (tomorrow's work).

## TL;DR — where things stand
- **Remote OTA is WORKING and validated end-to-end on real hardware** (WiFi).
- Test unit `JNX-FG-08F6` (SITE001) is running **fw 1.1.0** with all OTA fixes.
- **Next up (tomorrow): SIM data uplink overhaul** — see `SIM_UPLINK_PLAN.md`.
  That's why telemetry shows `signal4g:0 / registered:false` — modem not attaching yet.
  It is a SEPARATE workstream and no longer blocks anything; will ship via OTA.

## Proven OTA flow (2026-07-20 13:25, live)
```
cloud → MQTT {command:"ota_update"} on .../command topic
gateway: ota:update_available 1.0.9→1.1.0
  POST /backup 200 → GET /download/1.1.0 200 (1,064,224 B) → SHA-256 OK
  ota:updating → reboot → boots 1.1.0 → GET /manifest?fw=1.1.0 → 204 (up-to-date)
```

## OTA root causes fixed this session (all in firmware + backend)
- **D1** device never registered its self-token → `/backup` 401. Fix: firmware POSTs
  `/api/fireguard/register` on boot (auto TOFU); backend `register.controller.ts`.
- **D9 (biggest)** MQTT + HTTP shared ONE socket → `register -4` + reconnect storm, OTA
  never applied. Fix: separate HTTP client per transport (`*_get_http_client()`,
  `uplink_get_http_client()`; 4G uses TinyGSM mux 1).
- **D10** HTTP bodies parsed WITH headers attached → manifest JSON parse failed + binary
  download corrupted. Fix: `http.skipResponseHeaders()` in `api_get`/`api_post`/`ota_apply`.
- **D7** version compare used `strcmp` → "1.0.10" < "1.0.9". Fix: numeric `ver_is_newer()`.
- Deferred/serialized OTA (runs in `loop()` via `ota_service()`, never in MQTT/WebUI
  callback → no stack-overflow panic); boot-time check; rollback window 5→10 min + uplink-only
  validate; non-destructive backup; `pub_ota` on every outcome (observability).

## How to trigger OTA (remote)
- Reliable path: publish to the **`.../command`** topic `{"command":"ota_update"}` (or
  `ota_check`). Firmware does check-then-apply. The dedicated `.../ota` topic subscribe is
  still flaky on PubSubClient (open item) — backend publishes to BOTH.
- Backend endpoint: `POST /api/gateways/:id/ota` (CLIENT_ADMIN) body `{action:"update"|"check"}`
  → `publishGatewayOta` + `publishGatewayCommand` (both topics).

## How to release a new firmware
1. Bump `Hardware/firmware/src/config/build_info.h` FW_VERSION; `pio run -d <fw dir>`.
2. `pscp` `.pio/build/fireguard/firmware.bin` → VPS
   `/root/projects/fire_guard/Backend/ota-storage/vvm401/<ver>.bin`.
3. Insert/activate a `firmware_releases` row (hw `vvm401`, version, active:true,
   size, sha256, url `http://154.61.69.200/api/fireguard/ota/download/vvm401/<ver>`).
   (Pattern: the `mkrelease.mjs` I used, run with `node` in the Backend dir.)
4. Trigger via `/command` as above.
- NOTE: strcmp quirk is fixed in ≥1.1.0, but for the CURRENT device use targets that also
  sort correctly (e.g. 1.1.0, 1.2.0). Staged bins are in `D:\IOT Device\fireguard\*.bin`.

## Infra facts that save time (also in memory)
- **VPS can't build the backend (tsc OOM, exit 137)** + plink drops mid-build. So: build
  backend LOCALLY (`node_modules/.bin/tsc -p tsconfig.json`, outDir `dist`), `pscp` changed
  `dist/**.js`, `pm2 restart fireguard-api`. Long remote cmds: run `nohup … &` detached.
- Device HTTP is plain HTTP over **:80** (gateway nets block :4070). nginx :80
  (`server_name fireguard.iotsoft.in 154.61.69.200`) proxies whole `/api/fireguard/` →
  127.0.0.1:4070; else 301→https.
- Flashing: **remove SD first** (MISO=GPIO2 strapping); bootloader = hold J1 low → toggle J2 →
  release J1; `pio run -d <fw> -t upload --upload-port COM12`.
- Serial capture without hanging the terminal: `pio device monitor --filter log2file` (saves
  to file); opening the port does NOT auto-reset this board — toggle J2 to reboot.
- Wrappers `D:\pscp_git.bat` / `D:\plink_git.bat` have creds baked in — never commit them.

## Test unit
`JNX-FG-08F6` / SITE001 / token `71993834c22678b0eaaf3e49036d83e1` (now auto-registered).
SIM inserted (`+919928…`), signal ~26-28 but `registered:false` (tomorrow's fix).

## SIM DATA UPLINK — HANDOFF STATE (2026-07-21, for CODEX / restore point)
Device is on **fw 1.1.7** (JNX-FG-08F6, JIO SIM, LTE-only + APN jionet). All changes ship via OTA.
Refs: `SIM_UPLINK_PLAN.md`, `MNC MCC.txt` (A7672S AT sequence — confirmed accurate).

**DONE & proven on hardware:**
- Modem profile SIM7600→**A7672X** (`platformio.ini`, `modem4g.cpp`) — JIO LTE **data attach did
  reach `modem:connected`** on 1.1.2 (SIM7600 never did).
- Registration via **CREG/CEREG** (accept stat 1/5), not `isNetworkConnected()`/CGREG (false on
  JIO LTE-only). Modem state machine driven ~1.5s (not every-30s, not every-loop).
- Modem is **stable** now (steady −65 dBm, no `no_at` flapping) after removing the destructive
  power-cycle (A7672 PWR_KEY is a **TOGGLE** — FAILED→OFF→POWERING was turning the modem OFF).
- **Preemptive uplink** (`uplink.cpp` `probe_transports` 4G>WiFi>LAN + always-probe) so 4G takes
  over WiFi; **MQTT re-binds** to the new transport on switch (`mqtt.cpp` `s_lastUplink`).
- **Observability:** status telemetry `modem` field = off/powering/wait_at/wait_net/connecting/
  connected/**failed:no_at|failed:gprs**. `signal4g`/`operator` shown once AT-ready (not only CONNECTED).

**CURRENT BLOCKER (where CODEX picks up):** JIO **PDP/data attach** (`gprsConnect` in
`modem4g.cpp` CONNECTING_GPRS) doesn't complete *consistently/quickly*. Diagnostic showed
`failed:gprs` (registered OK, attach fails), then after removing the power-cycle the modem got
**wedged in `wait_net`** (registration lost, `sim_info` stops responding) because there is now NO
"restart modem as last resort" — the recovery ladder is incomplete. A clean power-off clears it.

**NEXT STEPS (recommended order):**
1. **Recovery ladder** (`MNC MCC.txt` §recovery): retry attach without power-cycle for N minutes,
   THEN one proper full modem power-cycle (PWR_KEY off→wait→on) as LAST resort. Make POWERING
   check `testAT()` first and only pulse PWR_KEY if the modem is actually off (avoid toggling a
   live modem).
2. **Serial trace** to see the real AT exchange: `pio device monitor -p COM12 -b 115200
   --filter log2file` (writes to file, won't hang the terminal). Look at CREG/CEREG/COPS/CGATT/
   CGACT/CGPADDR responses during CONNECTING.
3. Consider the doc's **explicit attach**: `CGATT=1` → `CGACT=1,1` → check `CGPADDR/IPADDR`
   instead of relying on TinyGSM `gprsConnect` (which may mishandle JIO's already-active bearer).
4. **Try Airtel SIM** (auto 2G/3G/4G) — far easier than JIO LTE-only; owner may standardize on it.
5. Then the plan's polish: **auto-APN by PLMN** (COPS? → lookup), **configurable priority**
   (dashboard/config-set), **data-usage counters**, CPIN gate, local SIM diagnostics.

**AT contention note:** `modem4g_step` (every 1.5s) and `simsvc` SIM commands share `s_modem`;
during CONNECTING the ~10s blocking `gprsConnect` starves `sim_info`. A small mutex/"modem busy"
guard would help.

## Open items
1. **SIM data uplink** — see the detailed handoff state above; `SIM_UPLINK_PLAN.md` for the full plan.
2. **Multi-protocol capture + LAN WebUI roadmap** — `LAN_DEVICE_CAPTURE.md`: add **Modbus TCP**
   device polling (reuses the RS485 register-map pipeline; UI gains conn-type RS485|TCP + IP:port);
   move W5500 to ESP-IDF **`ETH.h`/lwIP** so the WebUI is reachable over the Ethernet LAN IP (not
   just the WiFi AP) and the uplink client code simplifies. Roadmap, not yet built.
3. `.../ota` MQTT topic subscribe unreliable (PubSubClient) — using `/command` instead.
4. Marketing site (:80 default) returns 200 for `.env`/probe paths (SPA fallback) — low-pri harden.
