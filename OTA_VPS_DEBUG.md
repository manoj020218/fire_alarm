# FireGuard — VPS OTA Debug & Fix Plan

**Status:** collecting findings before implementation. Delivery deadline ~2 days.
**Test unit:** `JNX-FG-08F6` on `SITE001`, currently fw **1.0.3**, uplink **wifi**,
`apiHost=154.61.69.200`, `mqttHost=154.61.69.200`. Last reset reason: **panic** (~10:04).

---

## A. Server-side pipeline — VERIFIED WORKING (external tests)
- `GET /api/fireguard/ota/manifest?...` over **:80 via nginx** → **200**, returns v1.0.4
  manifest `{version,url,sha256,size,...}`.
- `GET /api/fireguard/ota/download/vvm401/1.0.4` over :80 → **200**, full 1 MB image.
- `POST /api/fireguard/backup` with the **synced** token → **200** `{ok:true,backupId}`.
- Firmware release row: hw `vvm401`, ver `1.0.4`, sha256
  `91c237802a9a5827ea79ae1d1dd9f223a3b8f4b77e0ba472acb707d2ef935bc3`, size `1046896`,
  url now points at `http://154.61.69.200/api/fireguard/ota/download/vvm401/1.0.4` (raw IP, no DNS).

### nginx :80 (already applied)
`server_name fireguard.iotsoft.in 154.61.69.200;` and it now proxies the **whole**
`location /api/fireguard/ { proxy_pass 127.0.0.1:4070; }` (not just `/ota/`) so the
gateway's plain-HTTP ingest/backup/ota all work over port 80. Everything else on :80
→ 301 to https. (Gateway networks block :4070, so :80 is mandatory.)

---

## B. Root causes of "OTA via VPS fails" (confirmed on v1.0.3)

1. **`/backup` 401 "Unknown gateway" — no token registration handshake.**
   Firmware self-generates its device token (`api_generate_token`, shown on WebUI Config
   tab, green). Backend `deviceAuth` does a **hard token match** (no TOFU). Backend had a
   different provisioned token → 401 → OTA aborts at the mandatory backup gate.
   - **Workaround applied for THIS unit:** read gateway token `71993834c22678b0eaaf3e49036d83e1`
     from WebUI, wrote it into backend `Gateway.deviceToken`. Backup now → 200.
   - **Systemic:** every future unit hits this until a real register step exists.

2. **Firmware does NOT act on inbound `.../ota` MQTT commands.**
   Manual `mosquitto_pub` of `{cmd:check}` / `{cmd:update}` to the exact `.../ota` topic →
   zero action, zero reply, **no panic**. Yet `.../command` (sim_info) dispatches fine —
   both are subscribed in the SAME `subscribe_all()`. Suspect: the **3rd `subscribe()` call
   (`topic_ota`) is dropped** by PubSubClient (no flush/verify between the 3 rapid subs).
   Dispatch code in `on_message` is otherwise correct.

3. **`ota_check_manifest()` panics the gateway from the WebUI.**
   The `"reset":"panic"` at ~10:04 matches the WebUI "Check Manifest" that DID hit the
   server (200). `api_get()` runs a blocking HTTP fetch with ~700 B of local buffers on the
   small **AsyncWebServer task stack** → stack overflow → panic → reboot → wipes in-RAM
   `s_updateAvail` → subsequent "Apply Update" finds "no pending update" → no reboot.

4. **Backend has NO OTA-trigger publisher.**
   Grep of `VPS/backend/src` finds nothing that publishes `{cmd:...}` to MQTT. Only the HTTP
   manifest/download endpoints exist. So "VPS triggers OTA over MQTT" is documented but never
   implemented — no dashboard button, no endpoint emits the command.

### Firmware OTA flow reference (facts)
- `ota_check_manifest()` uses `api_get("/ota/manifest?...")` → `apiHost:apiPort` (default 80)
  + base path `/api/fireguard`. Failure paths (`!=200`) return silently, **no `pub_ota`**.
- `ota_begin_update()` → `ota_pre_backup()` (POST `/backup`, MANDATORY — abort on fail) →
  `ota_apply()` streams the URL from the manifest, SHA-256 verifies, `esp_restart()`.
- Download URL host/port parsed from the manifest URL (`parse_ota_url`, default 80).
- `ApiResponse.body[512]`; manifest resp ~212 B (fits).
- Topics: `fireguard/{siteId}/{gatewayId}/{ota|command|config/set}` (subscribe),
  `.../{telemetry|status|alarm|sim}` (publish).

---

## C. Agreed fix plan (user approved "do all of it")
- **Firmware:**
  - (2) `subscribe_all()`: space + verify each `subscribe()`, resubscribe on failure.
  - (3) Move OTA check/apply OFF the WebUI/MQTT callback into the main `loop()` (set a flag,
    act in loop) → no blocking HTTP on the async stack → no panic.
  - add `pub_ota()` on every failure path (observability over MQTT).
  - (1) on boot/claim, POST `gatewayId`+token to a new backend **register** endpoint.
- **Backend:**
  - `POST /api/fireguard/register` — device self-registers its token; accept while gateway
    is provisioned-but-unclaimed (TOFU window).
  - dashboard-triggerable `POST /api/.../gateways/:id/ota` → publishes `{cmd:check}`+
    `{cmd:update}` to the correct `.../ota` topic.
- Rebuild + **cable-flash v1.0.5 once** (remove SD first!), then validate cloud OTA over
  WiFi, then over the **Airtel SIM**.

---

## D. Additional findings — from `Hardware/OTA audit.txt` (static code audit, Jul 20 2026)

**D1. [= B1] Backup gate 401 "Unknown gateway" is the PRIMARY blocker.**
Live VPS returns `{"ok":false,"code":"UNAUTHORIZED","message":"Unknown gateway"}` for an
unregistered gateway on `POST /api/fireguard/backup`. Firmware ALWAYS backs up before
applying (`ota.cpp:245,261,507`). Token is locally generated (`apiclient.cpp:20,149,150`),
only exposed in WebUI (`handlers_config.cpp:78`) — **no registration handshake** teaches the
VPS the gatewayId/token pair. (Already manually patched for THIS unit; systemic fix needed.)

**D2. `{cmd:update}` alone is a NO-OP.** MQTT update handler calls `ota_begin_update()`
directly (`mqtt.cpp:37,38`), but `ota_begin_update()` exits immediately if no prior manifest
check populated `s_updateAvail` (`ota.cpp:153,503`). → VPS must send `{cmd:check}` FIRST (or
device must have checked). **This explains the live no-action result** of my MQTT trigger.

**D3. No boot-time manifest check — up to 24h blind.** `tOta` starts `{0, OTA_CHECK_INTERVAL_MS}`
= 24h (`main.cpp:40`, `defaults.h:41`); nothing calls `task_trigger_now(tOta)`. Loop only
checks when timer expires (`main.cpp:402,404`). Fresh reboot → VPS push is a no-op for up to
24h unless `{cmd:check}` is sent. **Fix:** trigger a check at boot / on first uplink.

**D4. Doc vs firmware topic mismatch.** `FIRMWARE_UPLOAD.md:69` says OTA via MQTT
`command → {cmd:update}`, but firmware listens on the dedicated **`ota`** topic
(`mqtt.cpp:29,99`, `topics.h:30,31`). If VPS publishes to `command`, OTA never starts.

**D5. Post-reboot AUTO-ROLLBACK risk (critical for SIM).** Validation completes only when BOTH
`mqtt_connected()` AND `uplink_is_up()` are true (`main.cpp:429,430`); otherwise auto-rollback
after `OTA_VALIDATE_WINDOW_MS` (`ota.cpp:80,97`, `defaults.h:71`, ~5 min). → OTA success depends
on cloud connectivity coming back fast after reboot. Over a flaky SIM this can roll back a
perfectly good image. **Fix:** widen window and/or relax to uplink-only for SIM.

**D6. Failed backup is LOSSY.** Backup builder drains up to 10 SD-buffered records
(`ota.cpp:222,226`) and `sdbuf_replay_next()` DELETES them from disk as it reads
(`sdbuffer.cpp:5,76`). If `/backup` then fails, those records are gone. **Fix:** make backup
non-destructive (peek, don't pop) or don't drain undelivered records into the backup body.

**D7. Secondary (not today's blocker):** version compare uses `strcmp()` not semver
(`ota.cpp:144`); `apiclient.h:4` claims http(s) but uses plain `HttpClient` over raw Client
(`apiclient.cpp:70,143`). Live URLs are plain HTTP so fine for now.

**D8. [my analysis] Shared uplink Client conflict.** MQTT (`s_mqtt.setClient(uplink_get_client())`)
and `api_get()`/`ota_apply()` (`HttpClient(uplink_get_client(),...)`) use the **same** WiFi
`s_client`. Running OTA's blocking HTTP from INSIDE the MQTT rx callback (or the async WebUI
task) while MQTT also uses that client → conflict/corruption; likely contributes to the WebUI
`panic` and the MQTT no-op. **Fix:** run all OTA work serialized in the main `loop()` (flag +
act), never inside the MQTT callback or WebServer handler.

---

## D9. ROOT CAUSE (from serial log 2026-07-20, fw 1.0.5) — shared socket

Serial capture showed the smoking gun:
```
[I][MQTT] Connected ... Subscribed: config/set command ota
[W][API] Register failed: HTTP -4 err=-4      ← HTTP fails
[I][MQTT] Connected ... Subscribed ...          ← MQTT reconnects, loops forever
```
**MQTT and ALL HTTP calls shared ONE `WiFiClient` (`s_client`).** A single client holds one TCP
connection, so every `api_get`/`api_post` (register, backup, OTA download) **clobbered the live
MQTT socket** → HTTP `-4` + endless MQTT reconnects. This is why register was flaky and OTA
apply never happened (backup/download ran on a socket MQTT was fighting for). Confirmed on WiFi;
would be worse on 4G.

**Fix (v1.0.7):** separate HTTP client per transport, never shared with MQTT —
`wifi_get_http_client()` (2nd `WiFiClient`), `eth_get_http_client()` (2nd `EthernetClient`),
`modem4g_get_http_client()` (TinyGsmClient **mux 1**; MQTT keeps mux 0), exposed via
`uplink_get_http_client()`. `apiclient.cpp` + OTA download now use it. Also added `pub_ota` on the
last silent bail (`ota:check_failed / bad_manifest`). This is the true blocker behind the WebUI
panic history AND the "manifest fetched but apply never runs" symptom.

---

## D10. ROOT CAUSE #2 (2026-07-20, fw 1.0.7) — HTTP response headers not skipped

After D9, the `/command` OTA trigger delivered and the device fetched the manifest (`GET …/manifest
→ 200`), but the apply still silently stalled: **no `pub_ota`, no backup, no reboot**. Cause: the
manifest fetch is the FIRST place firmware actually *parses* an HTTP response body (register/ingest
only check status; 204 has no body). `api_get`/`api_post` read the body **without
`skipResponseHeaders()`**, so `resp.body` = `"<HTTP headers>\r\n\r\n{json}"` → `deserializeJson`
fails → silent `DOWNLOAD_FAILED`. The **same** bug prepended header bytes to the OTA binary in
`ota_apply()` → guaranteed SHA-256 mismatch. So every step up to the manifest worked; the apply
never could.

**Fix (v1.0.9):** call `http.skipResponseHeaders()` after `responseStatusCode()` in `api_get`,
`api_post`, and `ota_apply` (before reading the binary). Added `pub_ota` on the JSON parse-error
path too. D9 (separate sockets) + D10 (skip headers) together make the full OTA path clean:
command → parse manifest → backup → download → SHA verify → reboot.

**Delivery note:** the header bug corrupts the OTA download, so v1.0.9 must go on by **cable**
(can't OTA the fix onto a device that has the bug). From v1.0.9 onward, OTA is clean.

---

## E. FINAL consolidated fix plan (supersedes C)

**Firmware (one cable flash → v1.0.5):**
1. **Register handshake** — on boot after first uplink, `POST /api/fireguard/register`
   `{gatewayId, token, hw, fw}`. Retry until 200. (fixes D1)
2. **Defer + serialize OTA** — MQTT `ota` and WebUI handlers only SET a request flag
   (`check` / `update`); the actual `ota_check_manifest()` / `ota_begin_update()` runs in
   `loop()` between `mqtt_loop()` calls. (fixes D8 panic + client conflict)
3. **`{cmd:update}` implies check** — in the deferred handler, if `update` requested and no
   `s_updateAvail`, run a check first, then apply. (fixes D2)
4. **Boot check** — `task_trigger_now(tOta)` once, after first successful uplink+registration.
   (fixes D3)
5. **Widen/relax validation** — bump `OTA_VALIDATE_WINDOW_MS` (e.g. 10 min) and accept
   `uplink_is_up()` alone (mqtt optional) so SIM reconnect delay won't roll back. (fixes D5)
6. **Non-destructive backup** — peek SD records for the backup body; only pop after `/backup`
   returns 200. Or drop undelivered records from the backup entirely. (fixes D6)
7. `pub_ota()` on EVERY OTA result/failure (observability).
8. Update `FIRMWARE_UPLOAD.md` topic doc; (optional) semver compare. (D4, D7)

**Backend:**
9. `POST /api/fireguard/register` — device self-registers token; accept while gateway is
   provisioned-but-unclaimed (TOFU window); idempotent. (fixes D1 systemically)
10. Dashboard-triggerable `POST /api/gateways/:id/ota` → publishes `{cmd:check}` then (after a
    short delay) `{cmd:update}` to `fireguard/{siteId}/{gatewayId}/ota`. (fixes D4 + D2 ordering)

**Validate:** cable-flash v1.0.5 (SD out) → confirm auto-register (backup 200 w/o manual token)
→ cloud OTA over WiFi → cloud OTA over Airtel SIM (watch rollback window).

