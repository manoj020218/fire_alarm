# JENIX FireGuard v1 — Project Status

**Last Updated:** 2026-07-13  
**Status:** ON HOLD — Awaiting Hardware (board identified: Vajruino VVM401)  
**GitHub:** https://github.com/manoj020218/fire_alarm  
**Firmware plan:** `Hardware/VAJRUINO_FIRMWARE_PLAN.md` (authoritative for Phase 5)  

---

## Current State

### Phase 1 — PWA Dashboard ✅ COMPLETE

The full React PWA dashboard is built, tested, and running. Client can review
the UI at any time by running the dev server.

| Item | Status |
|------|--------|
| React PWA frontend (12 pages) | Done |
| Mock real-time data (Socket simulation) | Done |
| RBAC — 5 user roles | Done |
| 43/43 unit tests passing | Done |
| TypeScript — 0 errors | Done |
| Screenshots captured (all pages) | Done |
| Code pushed to GitHub | Done |

**To run the dashboard locally:**
```
cd frontend
pnpm install
pnpm dev
# Open http://localhost:5173
# Login: admin@abctowers.com / Pass@123
```

### Phase 2 onward — NOT STARTED

Backend, mobile APK, and firmware are all pending. See CLAUDE.md for the
full 5-phase plan.

---

## Hardware Change — Customer Requirement

**Date raised:** 2026-07-05 · **Board identified:** 2026-07-13 (Vajruino VVM401)

Customer switched from the bare ESP32-S3 to a custom industrial gateway — now confirmed as the
**Vajravegha Vajruino VVM401**. It is built on a **plain ESP32** (dual-core 240 MHz, 4 MB flash,
520 kB RAM, **no PSRAM**) — the earlier "ESP32-S3" assumption is void. Confirmed interfaces
(from the vendor's own example code — the authoritative pinout):

| Interface | Actual spec on VVM401 | ESP32 pins | Purpose |
|-----------|----------------------|-----------|---------|
| MCU | ESP32 classic, 4 MB flash / 520 kB RAM | — | Controller, MQTT, OTA |
| Cellular | SIMCOM A7672S 4G LTE (TinyGSM as SIM7600) | Serial1 RX27/TX26, PWR4 | Primary uplink (SIM) |
| LAN | W5500 Ethernet (Arduino Ethernet v2) | VSPI CS5/RST25 | Secondary uplink |
| WiFi | ESP32 built-in (STA + AP portal) | — | Backup uplink + provisioning |
| RS485 | Modbus RTU master | Serial2 RX32/TX33 | 14 fire devices |
| RS232 | **Shares Serial2 with RS485 (jumper) — NOT USED** | (same UART) | Panel is Modbus, so unused |
| Digital Input | 4× opto-isolated, **active-low** | 35, 34, 39, 36 | Flow/door dry contacts |
| Digital Output | 2× **3.3 V logic (not relay)**, ext. relay board, **indication only** | 17, 16 | Fault lamp / buzzer |
| SD card | ≤16 GB (HSPI) | CS15/CLK14/MOSI13/MISO2 | Offline buffer + logs |
| RTC + EEPROM | DS3231 + 32k (I²C) | SDA21/SCL22 | Offline timestamps |

**Locked decisions (owner, 2026-07-13):** RS485/Modbus only (no RS232); digital outputs are
indication-only (gateway never actuates fire equipment); provisioning is AP-mode web portal only
(no BLE). Uplink priority 4G > LAN > WiFi. Full rationale in `Hardware/VAJRUINO_FIRMWARE_PLAN.md`.

### Impact on Software

| Layer | Impact |
|-------|--------|
| Firmware (Phase 5) | Significant changes — must add 4G/LTE AT command driver, Ethernet (ETH.begin), RS232 port, DI/DO pin handling, dual-uplink failover logic |
| Backend (Phase 2) | No change — MQTT topics and payload format stays the same |
| Frontend (Phase 1) | Minor — add DI/DO status cards, connection indicator for 4G vs LAN uplink |
| Mobile APK (Phase 4) | No change |

### Firmware Architecture (confirmed — Vajruino VVM401)

```
Hardware Interfaces (actual pins from vendor code):
  ESP32 WiFi          → backup uplink + AP-mode web provisioning (JNX-FG-XXXX)
  4G A7672S           → primary uplink (TinyGSM/SIM7600), Serial1 RX27/TX26, PWR4
  W5500 Ethernet      → secondary uplink, VSPI CS5/RST25 (Arduino Ethernet v2)
  RS485 (Serial2)     → Modbus RTU master — 14 fire devices, RX32/TX33
  RS232               → SHARES Serial2 via jumper — UNUSED (panel is Modbus)
  DI[0..3]            → GPIO 35/34/39/36, opto-isolated, ACTIVE LOW, debounced
  DO[0..1]            → GPIO 17/16, 3.3V logic (ext. relay), INDICATION ONLY
  SD (HSPI)           → offline telemetry buffer + logs
  DS3231 RTC (I²C)    → offline timestamps

Uplink priority: 4G > LAN > WiFi.  Full plan: Hardware/VAJRUINO_FIRMWARE_PLAN.md
```

### New Telemetry Fields (additions to existing payload)

```typescript
// Add to GatewaySystem in types/index.ts when hardware arrives:
uplink: '4g' | 'lan' | 'wifi';     // active uplink
signal4g: number;                   // RSSI dBm for 4G
signalLan: boolean;                 // LAN link up/down

// Add to TelemetryPayload.devices:
digitalInputs: {
  di0: boolean; di1: boolean; di2: boolean; di3: boolean;
};
digitalOutputs: {
  do0: boolean; do1: boolean;
};
```

---

## On Hold — Pending

- [ ] Vajruino VVM401 board delivery
- [ ] On delivery: confirm RS485 DE/RE pin presence + jumper set to RS485; baseline via vendor `LTE_WiFi_Eth_MQTT.ino`
- [x] Firmware plan written — `Hardware/VAJRUINO_FIRMWARE_PLAN.md` (replaces the CLAUDE.md S3 plan)
- [ ] Add DI/DO cards to Dashboard and Live Monitor pages
- [ ] Add uplink indicator (4G/LAN/WiFi) to TopBar / RightPanel

---

## Resume Checklist (when hardware arrives)

1. Run `pnpm test` in `frontend/` — confirm 43/43 still pass
2. Present dashboard screenshots to client for layout approval
3. Start Phase 2 backend (Express + MongoDB + MQTT + Socket.IO)
4. Firmware: follow `Hardware/VAJRUINO_FIRMWARE_PLAN.md` — baseline the board with the vendor
   example first, then FW-1 → FW-8 (RS485-only, indication-only DO, AP-web provisioning)

---

## Contact / Ownership

**Project:** JENIX FireGuard v1  
**PID:** FIREGUARD-S3-01  
**Repo:** https://github.com/manoj020218/fire_alarm  
**Full plan:** See `CLAUDE.md` in repo root  
