# FireGuard Firmware Plan — Vajruino VVM401 Gateway

> **Supersedes** the ESP32-S3 assumptions in `S3 prompt.txt` and CLAUDE.md Phase 5.
> The delivered hardware is the **Vajravegha Vajruino VVM401** (plain ESP32), not an ESP32-S3.
> Cloud/backend/PWA layers are UNCHANGED — same MQTT topics and telemetry JSON. This plan
> covers Phase 5 (firmware) only.
>
> Date: 2026-07-13. Sources of truth: vendor examples (`Examples/*.ino`) + `Vajruino.pdf`
> datasheet — both in this folder. Decisions locked with owner 2026-07-13 (see §0).

---

## 0. Locked decisions (owner, 2026-07-13)

1. **RS485 / Modbus-RTU only.** All 14 field devices incl. the fire alarm panel are Modbus over
   RS485. RS232 is NOT used (the board shares one UART between them via a physical jumper — RS485
   selected). Both digital outputs stay free.
2. **Digital outputs = indication only.** DO1/DO2 drive a fault lamp / buzzer *via an external
   relay board* (board pins are 3.3 V logic, non-isolated, cannot drive a relay directly). The
   gateway **never actuates fire equipment** — signals only. No software-controlled trip.
3. **Provisioning = AP-mode web portal only.** No BLE. Device hosts `JNX-FG-XXXX` softAP + config
   page. 4G uses blank/auto APN, so uplink usually needs zero setup.

---

## 1. Hardware truth (from vendor code + datasheet — authoritative)

**MCU:** ESP32 classic, dual-core 240 MHz, **4 MB flash, 520 kB SRAM, NO PSRAM.** WiFi + BLE
capable. This memory budget drives every design choice below.

**Confirmed pin map (do NOT guess — these are the vendor's own definitions):**

| Function | Pins | Notes |
|---|---|---|
| 4G A7672S (SIMCOM) | Serial1: RX=27, TX=26, PWR_KEY=4 | TinyGSM as `SIM7600`. Blank APN = auto. |
| RS485 (Modbus) | Serial2: RX=32, TX=33 | Shared w/ RS232 by jumper — set jumper to RS485. **No separate DE/RE pin in vendor code** — board auto-directs (verify on delivery; if a DE/RE line exists it must be wired). |
| Status LED | GPIO12 | Onboard. |
| Digital Inputs DI1–4 | 35, 34, 39, 36 | Input-only, opto-isolated, **ACTIVE LOW**. No internal pull. |
| Digital Outputs DO1–2 | 17, 16 | 3.3 V logic, non-isolated. External relay board required. Shared w/ LoRa RA-08 header (unused). |
| Ethernet W5500 | VSPI: MOSI=23, MISO=19, SCK=18, CS=5, RST=25 | Arduino `Ethernet.h` v2. |
| SD card | HSPI: CS=15, CLK=14, MOSI=13, MISO=2 | ≤16 GB. Offline buffer + logs. |
| RTC DS3231 + 32k EEPROM | I²C: SDA=21, SCL=22 | RTC 0x68, EEPROM 0x57. Real timestamps offline. |
| Power | 9–30 V, 2 A SMPS | — |
| Flashing | External USB-TTL + J1(GPIO0)/J2(RESET) jumper dance | **No onboard USB → OTA is the real update path.** |

**Consequences of "no onboard USB + 4 MB flash + 520 kB RAM":**
- OTA is essential (physical reflash is painful). 4 MB flash → custom partition table: two ~1.5 MB
  OTA app slots + NVS + small SPIFFS/LittleFS for web assets. No room for large embedded assets →
  web UI must be tiny (gzipped, single page).
- Running WiFi-AP+STA + AsyncWebServer + TinyGSM + W5500 + SD + Modbus + JSON simultaneously is
  RAM-tight. Rules: one MQTT client reused across transports (not three), bounded JSON buffers,
  **plain MQTT first** (TLS on all uplinks at once will not fit comfortably — see §7 risks).

---

## 2. Library stack (pin exact versions in platformio.ini)

From vendor examples, these are proven on this board:
- `vshymanskyy/TinyGSM` — A7672 as `TINY_GSM_MODEM_SIM7600`
- `arduino-libraries/Ethernet` **v2.x** (W5500)
- `knolleary/PubSubClient` — **must raise `MQTT_MAX_PACKET_SIZE`** (default 256 B < our telemetry)
- `bblanchon/ArduinoJson` v6 — fixed-capacity docs only
- `adafruit/RTClib` (DS3231)
- `4-20ma/ModbusMaster` **or** vendor's `smarmengol/Modbus-Master-Slave-for-Arduino` — pick one;
  ModbusMaster is cleaner for a pure master and lets us set DE/RE if the board exposes it. Decide
  at §5 after checking the delivered board for a DE/RE pin.
- `ESP32Async/ESPAsyncWebServer` + `AsyncTCP` — local web UI
- OTA: `ayushsharma82/ElegantOTA` v3 (vendor used the deprecated AsyncElegantOTA — upgrade)
- `SD`, `Wire`, `EEPROM`, `Preferences`(NVS) — core

**Framework/target:** PlatformIO, `framework = arduino`, `board = esp32dev` (classic).

---

## 3. Module structure (PlatformIO, small files — CLAUDE.md rule)

```
hardware/
├── platformio.ini          # esp32dev, libs pinned, 4MB OTA partition csv
├── partitions_fireguard.csv
├── README.md               # wiring, jumper=RS485, flashing, OTA, MQTT topics, test steps
└── src/
    ├── main.cpp            # setup(): init order; loop(): millis scheduler only
    ├── config/
    │   ├── pins.h          # ALL pins from §1 — single source
    │   ├── build_info.h    # FW_VERSION, RELEASE_DATE, PID
    │   └── defaults.h      # default site/gateway id, intervals, thresholds
    ├── net/
    │   ├── uplink.h/.cpp   # failover manager: 4G > LAN > WiFi; owns the active Client*
    │   ├── modem4g.cpp     # TinyGSM lifecycle, signal, APN auto
    │   ├── ethernet.cpp    # W5500 begin, link/DHCP, static fallback
    │   └── wifiap.cpp      # STA connect + AP fallback (JNX-FG-XXXX)
    ├── mqttc/
    │   ├── mqtt.h/.cpp     # PubSubClient bound to uplink's active Client; connect, pub, sub
    │   └── topics.h        # topic builders (fireguard/{site}/{gw}/...)
    ├── modbus/
    │   ├── bus.cpp         # Serial2 master, timeout, CRC/timeout counters
    │   └── registers.h     # per-device slaveId/fc/regAddr/scale/unit map (config-driven)
    ├── io/
    │   └── dio.cpp         # DI read (active-low debounce), DO set (indication)
    ├── alarms/
    │   └── engine.cpp      # threshold eval, severity, dedup, NVS-retained state
    ├── store/
    │   ├── nvs.cpp         # Preferences: settings + alarm state
    │   ├── sdbuffer.cpp    # offline telemetry queue on SD, replay on reconnect
    │   └── rtc.cpp         # DS3231 read; sync from NTP/4G/MQTT time when online
    ├── webui/
    │   ├── server.cpp      # AsyncWebServer :80 — status + scan + test + config + OTA
    │   └── page.h          # gzipped single-page HTML (tiny)
    ├── ota/
    │   └── ota.cpp         # ElegantOTA + version endpoint; pull-from-VPS hook
    └── util/
        ├── scheduler.h     # millis-based task ticks (no delay())
        ├── health.h/.cpp   # uptime, heap, RSSI, reset reason, counters
        └── log.h           # serial log macros (levels)
```

---

## 4. Telemetry / topics — UNCHANGED from CLAUDE.md (backend compatibility)

Keep the exact JSON shape and topic tree the PWA/backend already expect:
`fireguard/{siteId}/{gatewayId}/{telemetry|status|alarm|config/get|config/set|ota|command}`.

**Add the fields STATUS.md already reserved** (backend/PWA already planned for them):
```jsonc
system: { ..., "uplink": "4g|lan|wifi", "signal4g": <dBm>, "signalLan": <bool> }
devices: { ..., "digitalInputs": {di0..di3: bool}, "digitalOutputs": {do0,do1: bool} }
```
Timers: heartbeat/status 60 s, telemetry 10 s, alarms immediate. All via the millis scheduler.

---

## 5. Build order (each step compiles + is bench-testable)

**FW-1 — Skeleton + peripherals bring-up.** platformio.ini, partitions, pins.h, build_info,
scheduler, serial log, health. Bring up RTC, SD, EEPROM, status LED, DI read (active-low),
DO set. Verify against the vendor `ConnectionTest.ino` behavior. Deliverable: boots, prints health,
reads DIs, toggles DOs.

**FW-2 — Uplink failover manager.** modem4g (A7672/TinyGSM), ethernet (W5500), wifiap (STA+AP).
`uplink` picks the first working transport in priority 4G > LAN > WiFi, exposes the active
`Client&`, re-evaluates on loss. Deliverable: unplug 4G → falls to LAN → falls to WiFi, logged.

**FW-3 — MQTT over the active uplink.** One PubSubClient rebased onto uplink's Client. Connect to
the Jenix VPS broker (configurable), publish status/telemetry stubs, subscribe config/set +
command. Raise MQTT_MAX_PACKET_SIZE. Deliverable: telemetry visible on broker; survives an uplink
switch (reconnect).

**FW-4 — Modbus master.** Serial2 @ configurable baud/parity, jumper=RS485. Config-driven register
map (slaveId, FC 03/04, regAddr, count, scale, unit) for the 14 devices. Timeout + CRC-error
counters; per-device offline detect. Deliverable: reads a real/simulated slave; values into
telemetry JSON.

**FW-5 — Alarm engine.** Per-parameter thresholds (low/high, warning/critical), dedup, immediate
alarm publish, state retained in NVS across reboot. Pump-offline / RS485-offline alarms.
Deliverable: cross a threshold → single alarm event, ack via command topic clears it.

**FW-6 — Offline buffer + time.** SD-backed telemetry queue when all uplinks down; replay on
reconnect (bounded, oldest-dropped). RTC timestamps offline; sync RTC from NTP/4G/MQTT when online.
Deliverable: pull internet for 5 min → data queued on SD → reconnect → backfilled.

**FW-7 — Local web UI + OTA.** AsyncWebServer :80: gateway/WiFi/MQTT/cloud status, RS485 scan,
single-register Modbus read test, per-device test, register-map view, FW version/date, OTA upload.
Tiny gzipped page. ElegantOTA + a pull-from-VPS version check hook. AP provisioning page (WiFi
creds, site/gateway id, broker) saved to NVS. Deliverable: config a fresh unit from phone on the AP.

**FW-8 — Hardening.** Watchdog, configurable auto-reboot schedule, uncaught-exception safety,
health JSON complete (uptime/heap/RSSI/reset-reason/fw/counters), README with wiring + jumper +
flashing + OTA + test procedure.

---

## 6. Testing (no S3-style unit-test harness on MCU — bench + simulator)

- **Modbus slave simulator** on a PC (e.g. `modbus-simulator`/`diagslave`) + USB-RS485 dongle to
  exercise FW-4/FW-5 without the real pump room.
- **MQTT check** against the broker (mosquitto_sub) for topic/shape correctness — reuse the
  backend's expected JSON as the golden fixture.
- **Failover bench test**: physically drop 4G/LAN/WiFi in turn, confirm priority + reconnect.
- **Offline/replay**: block uplink, confirm SD queue + backfill with correct RTC timestamps.
- **Soak**: 24–48 h run watching heap (fragmentation is the classic-ESP32 killer) + watchdog resets.

---

## 7. Risks / watch-items (classic ESP32 specific)

- **RAM pressure.** AP+STA WiFi + AsyncWebServer + TinyGSM + W5500 + SD + JSON at once is tight on
  520 kB. Mitigate: bounded JSON, single reused MQTT client, keep web page tiny, don't hold big
  buffers. Watch heap in soak.
- **TLS.** MQTTS/HTTPS on classic ESP32 across three transports won't fit comfortably. Plan:
  **plain MQTT with username/password on a firewalled VPS broker** for v1; evaluate TLS on the 4G
  path only later if the client mandates it.
- **DE/RE direction pin.** Vendor code drives RS485 with no explicit DE/RE toggle (auto-direction
  hardware). **Confirm on the delivered board** — if there IS a DE/RE line, wire it and switch to a
  library that toggles it (ModbusMaster preTransmission/postTransmission).
- **PubSubClient payload cap.** Default 256 B is smaller than our telemetry — raise it or split.
- **Flashing friction.** No USB → keep OTA working from FW-3 onward so we're never stuck needing
  the jumper dance in the field.
- **4G data cost.** 10 s telemetry over cellular adds up; make interval configurable and consider
  batching on the 4G path.
- **Fire-safety liability.** Outputs are indication-only (locked §0.2) — keep it that way; do not
  add software trip without explicit written sign-off.

---

## 8. What does NOT change

Backend (Phase 2), PWA (Phase 1), and APK (Phase 4) are untouched: same MQTT topics, same telemetry
JSON (plus the DI/DO + uplink fields STATUS.md already reserved). The PWA only needs the small
additions already noted in STATUS.md — DI/DO status cards and a 4G/LAN/WiFi uplink indicator.

## 9. First action when the board is in hand
1. Confirm ESP32-classic + inspect for a DE/RE pin and the RS485/RS232 jumper position.
2. Flash the vendor `LTE_WiFi_Eth_MQTT.ino` unchanged → prove 4G/LAN/WiFi + MQTT + SD + RTC all work
   on THIS unit before writing a line of FireGuard firmware (baseline the hardware).
3. Then start FW-1.

> Bench status 2026-07-14: board powered (12 V 3 A), USB-TTL RX/TX wiring confirmed correct on
> COM12 @115200, vendor firmware runs (brownout loop was a power issue, now resolved).

---

# 10. Product-grade config, environment switching, and OTA-with-backup (owner reqs 2026-07-14)

**Decisions locked:** (a) build **firmware now against the documented API contract below** — the VPS
endpoints are a fast follow-up; MQTT already exists on the dev server. (b) **Plain MQTT + user/pass,
TLS-ready** (no MQTTS in v1). Target: sellable, 10-year-lifespan product.

## 10.1 Endpoints & DNS (all overridable in WebUI → NVS; compile-time defaults below)

| Purpose | Default host (DNS) | Dev resolves to | Protocol |
|---|---|---|---|
| MQTT broker | `mqtt.iotsoft.in` | 154.61.69.200 | MQTT 1883, user/pass |
| VPS API (OTA + backup + HTTP telemetry fallback) | `fireguard.iotsoft.in` | 154.61.69.200 | HTTP (TLS-ready) |

**Environment profiles.** A single `environment` setting (`dev` | `prod`) selects the host set.
Stored in NVS, changeable in WebUI, with compile-time default = `dev`. Switching to `prod` later =
one setting change (or one build flag) — no code edits. All of MQTT host/port/user/pass, API base,
site/gateway IDs live in one `config` struct persisted to NVS, seeded from `config/defaults.h`.
**No secrets committed** — defaults use placeholders; real creds entered at provisioning (WebUI) or
via a build-time `secrets.h` that is gitignored.

## 10.2 VPS API contract (firmware codes to THIS; VPS implements it later)

Base = `http(s)://{API_HOST}/api/fireguard`. All requests send `X-Gateway-Id` and a per-device
bearer/HMAC token (provisioned). JSON bodies.

- `GET /ota/manifest?gw={id}&fw={ver}&hw=vvm401`
  → `200 {"version":"1.2.0","url":"https://.../fw/1.2.0.bin","sha256":"...","size":123456,"mandatory":false,"minFrom":"1.0.0"}`
  or `204` if already latest.
- `POST /backup` — **pre-OTA safety snapshot** (see 10.3). Body:
  `{gatewayId, fwVersion, ts, config{...NVS settings, register map, thresholds}, alarmState[...],
    undelivered[...buffered telemetry], health{uptime,heap,rssi,resetReason}}`
  → `200 {"backupId":"...","ok":true}`. Firmware will NOT proceed with OTA without this 200.
- `POST /ingest` — HTTP telemetry fallback when MQTT is down (same JSON as the MQTT telemetry topic).
- `POST /alarm` — HTTP alarm fallback.
- (MQTT remains primary for telemetry/status/alarm/command; HTTP endpoints are fallback + OTA/backup.)

## 10.3 OTA flow — "backup first, then update, then self-validate or roll back"

Triggered by: MQTT `.../ota` command, WebUI button, or a periodic manifest check (configurable,
default daily). Steps, each guarded and logged; abort on any failure leaves the running FW untouched:

1. **Check** `GET /ota/manifest`. If a newer (or mandatory) version exists → continue, else stop.
2. **Pre-OTA backup (mandatory gate).** `POST /backup` with full config + alarm state + undelivered
   SD buffer + health. **Require HTTP 200 + backupId.** If backup fails → **abort OTA**, report
   `ota:backup_failed`, keep running current firmware. (This is the owner's hard requirement:
   never update without a server-side snapshot first.)
3. **Download** the binary to the **inactive OTA slot** (esp_ota_begin/write), streaming, with a
   running SHA-256. Verify size + **sha256 matches manifest**. Mismatch → abort, erase slot.
4. **Set boot = new slot**, publish `ota:updating`, reboot.
5. **Self-validate on new firmware:** within a boot-validation window (e.g. 5 min) the new FW must
   (a) mount peripherals, (b) get an uplink, (c) connect MQTT (or reach the API). On success →
   `esp_ota_mark_app_valid_cancel_rollback()` and publish `ota:success` with new version.
6. **Auto-rollback:** if the new FW crashes or fails self-validation, the ESP32 bootloader rollback
   (`CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`) reverts to the previous slot automatically. Old FW
   publishes `ota:rolled_back`. **A bad OTA can never brick a field unit.**

WebUI local OTA (upload .bin) uses the SAME gate: it performs the pre-OTA `POST /backup` before
accepting/flashing the uploaded image (unless the operator explicitly checks "skip backup — offline
mode", for when the VPS is unreachable and a local fix is urgent).

## 10.4 Flash partitioning for safe OTA on 4 MB

Custom `partitions_fireguard.csv`: `nvs` + `otadata` + **two ~1.6 MB app slots (ota_0/ota_1)** +
small `nvs`/`coredump`. **WebUI assets embedded gzipped in PROGMEM** (no SPIFFS partition) so both
OTA slots stay large — critical on 4 MB. Enable rollback + app-valid check in `platformio.ini`
(`board_build.partitions`, `-D CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`).

## 10.5 Adjustments to the FW-x steps

- **FW-3 (MQTT):** default host `mqtt.iotsoft.in` (dev→154.61.69.200), 1883, user/pass from NVS/
  secrets; env profile switch; HTTP `/ingest` fallback when MQTT down.
- **FW-7 (WebUI + OTA):** implement the full 10.3 flow (manifest check, pre-OTA backup gate, slot
  write, self-validate, rollback) for BOTH VPS-pull and WebUI-upload paths. Provisioning page writes
  the full config struct (env, hosts, creds, site/gateway IDs, register map, thresholds) to NVS.
- **FW-8 (hardening):** partition table + rollback config; device token/HMAC for API auth;
  factory-reset (long-press / WebUI) that clears NVS but preserves nothing sensitive in logs.
