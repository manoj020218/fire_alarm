# FireGuard Gateway Firmware — Vajruino VVM401

Firmware for the JENIX FireGuard gateway. Monitors RS485 fire-fighting equipment,
publishes telemetry to MQTT, and provides a local WebUI for provisioning.

---

## Hardware Wiring

| Function | Board Label | GPIO | Notes |
|---|---|---|---|
| 4G modem (A7672S) | Serial1 | RX=27, TX=26, PWR_KEY=4 | TinyGSM SIM7600 mode |
| RS485 Modbus | Serial2 | RX=32, TX=33 | Set jumper to **RS485** position |
| Status LED | LED | 12 | Active HIGH, onboard |
| DI1–DI4 | Digital In | 35, 34, 39, 36 | Opto-isolated, **active LOW**, no pull |
| DO1–DO2 | Digital Out | 17, 16 | 3.3 V logic → external relay board |
| W5500 Ethernet | VSPI | CS=5, RST=25, MOSI=23, MISO=19, SCK=18 | |
| SD card | HSPI | CS=15, CLK=14, MOSI=13, MISO=2 | ≤16 GB |
| DS3231 RTC + EEPROM | I2C | SDA=21, SCL=22 | RTC 0x68, EEPROM 0x57 |
| Power | 12 V input | 9–30 V, 2 A SMPS | |

### Jumper Settings
- **J_RS232/RS485**: Set to **RS485** side before powering on.
- If your board has a DE/RE pad, wire it to a free GPIO and set
  `PIN_RS485_DE_RE` in `src/config/pins.h`.

---

## First Flash (External USB-TTL, No Onboard USB)

1. Wire USB-TTL: `GND→GND`, `RX(USB-TTL)→TX(board)`, `TX(USB-TTL)→RX(board)`.
2. Hold J1 (GPIO0) LOW and press J2 (RESET) → release J2 → release J1 (enter download mode).
3. In `platformio.ini`, set `upload_port = COM12` (adjust to your port).
4. Run `pio run --target upload`.
5. After flash, press J2 (RESET) to boot normally.

**After the first flash, all subsequent updates use OTA** — the jumper dance is not needed again.

---

## Dev/Prod Environment Switch

Edit `src/config/defaults.h`:
```c
#define DEFAULT_ENV "dev"   // → 154.61.69.200
#define DEFAULT_ENV "prod"  // → mqtt.iotsoft.in / fireguard.iotsoft.in
```
Or change via the WebUI (stored in NVS) without reflashing.

---

## MQTT Topics

Base: `fireguard/{siteId}/{gatewayId}/`

| Leaf | Direction | Content |
|---|---|---|
| `telemetry` | GW → Broker | Full device + DI/DO + system JSON (10 s) |
| `status` | GW → Broker | Gateway heartbeat JSON, retained (60 s) |
| `alarm` | GW → Broker | Alarm event JSON (immediate on threshold cross) |
| `config/get` | GW → Broker | Current config snapshot |
| `config/set` | Broker → GW | Update config fields |
| `command` | Broker → GW | Acknowledge alarm, set DO, etc. |
| `ota` | Broker → GW | Trigger OTA update |

### Telemetry JSON shape
```json
{
  "pid": "FIREGUARD-S3-01",
  "gatewayId": "JNX-FG-AB12",
  "siteId": "SITE001",
  "timestamp": 1752480000,
  "system": {
    "uptime": 3600, "heap": 180000, "fw": "1.0.0",
    "uplink": "4g", "signal4g": -73, "signalLan": false,
    "mqtt": "connected", "cloud": "online", "rs485": "ok", "wifi": "offline"
  },
  "devices": {
    "jockeyPump": {"value": 1.0, "online": true},
    "digitalInputs":  {"di0": false, "di1": false, "di2": false, "di3": false},
    "digitalOutputs": {"do0": false, "do1": false}
  }
}
```

---

## Config (NVS, editable via WebUI in PART B)

All settings survive reboots and OTA updates.

| Key | Default | Description |
|---|---|---|
| `env` | `dev` | `dev` or `prod` (selects host set) |
| `mqttHost` | `154.61.69.200` | MQTT broker hostname/IP |
| `mqttPort` | `1883` | MQTT port |
| `mqttUser` / `mqttPass` | `""` | Broker credentials (set at provisioning) |
| `siteId` | `SITE001` | Site identifier |
| `gatewayId` | `JNX-FG-XXXX` | Auto-derived from MAC at first boot |
| `modbusBaud` | `9600` | RS485 baud rate |
| `telemetryIntervalMs` | `10000` | Telemetry publish interval |
| `statusIntervalMs` | `60000` | Status heartbeat interval |

---

## OTA Update (§10.3 of Firmware Plan)

**PART B will implement the full OTA flow:**
1. Gateway polls `GET /api/fireguard/ota/manifest` (daily, or via MQTT command).
2. If newer version found: **mandatory** `POST /api/fireguard/backup` (config + alarm state + undelivered SD records).
3. Download binary to inactive OTA slot; verify SHA-256.
4. Boot new slot. 5-minute self-validation window.
5. On success: `esp_ota_mark_app_valid_cancel_rollback()`.
6. On failure: bootloader auto-rollback to previous slot.

**PART A:** ElegantOTA on `/update` (WebUI upload). Pre-OTA backup gate enforced in PART B.

**Auto-rollback** (`CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=1`) means a bad OTA
**cannot brick a field unit**.

---

## Provisioning (PART B WebUI)

At first boot the gateway starts a WiFi AP: **JNX-FG-XXXX** (SSID).
Connect to it and visit `http://192.168.4.1` to configure:
- Environment (dev/prod), MQTT host/port/creds
- Site ID, Gateway ID
- WiFi STA credentials
- RS485 baud rate + register map
- Alarm thresholds

---

## Build

```bash
cd "D:\IOT Device\fireguard\fireguard v1\Hardware\firmware"
pio run              # compile only
pio run -t upload    # compile + flash (needs COM port + boot-mode jumpers)
pio device monitor   # serial monitor @ 115200
```

---

## Partition Table

`partitions_fireguard.csv`:
```
nvs      4 MB flash → 20 kB
otadata  8 kB
ota_0    1.625 MB   (active slot)
ota_1    1.625 MB   (standby slot for OTA)
coredump 64 kB
```

No SPIFFS/LittleFS — web assets are PROGMEM PROGMEM (keeps OTA slots large).

---

## PART B — What Remains

- Full WebUI pages: provisioning, RS485 scan, single-register test, register-map editor, alarm list, config form.
- Complete OTA flow (§10.3): manifest check, backup gate, slot write, SHA-256 verify, self-validate, rollback.
- HTTP `/ingest` + `/alarm` fallback when MQTT is down.
- NTP time sync + RTC sync from modem time.
- Watchdog auto-reboot schedule (configurable time of day).
- Device bearer token / HMAC for VPS API auth.
- Factory-reset long-press on DI1 (5 s hold).
- WebUI: OTA pre-backup gate ("skip backup" checkbox for offline emergencies).
