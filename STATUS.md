# JENIX FireGuard v1 — Project Status

**Last Updated:** 2026-07-05  
**Status:** ON HOLD — Awaiting Hardware  
**GitHub:** https://github.com/manoj020218/fire_alarm  

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

**Date raised:** 2026-07-05  

Customer has specified a custom gateway hardware instead of a bare ESP32-S3
board. The new gateway must have the following interfaces on a single unit:

| Interface | Specification | Purpose |
|-----------|--------------|---------|
| MCU | ESP32 (WiFi built-in) | Main controller, MQTT, OTA |
| Cellular | 4G LTE module | Primary internet uplink (SIM card) |
| LAN | Ethernet port | Alternate/backup internet uplink |
| RS485 | Half-duplex, MAX485 | Modbus RTU to fire equipment (14 devices) |
| RS232 | Full-duplex | Spare serial — Fire Alarm Panel direct link |
| Digital Input | 4 channels, 24V DC optoisolated | Dry contact inputs (flow switches, door contacts) |
| Digital Output | 2 channels, relay | Remote trip / siren / indication |

### Impact on Software

| Layer | Impact |
|-------|--------|
| Firmware (Phase 5) | Significant changes — must add 4G/LTE AT command driver, Ethernet (ETH.begin), RS232 port, DI/DO pin handling, dual-uplink failover logic |
| Backend (Phase 2) | No change — MQTT topics and payload format stays the same |
| Frontend (Phase 1) | Minor — add DI/DO status cards, connection indicator for 4G vs LAN uplink |
| Mobile APK (Phase 4) | No change |

### Firmware Architecture Update (to do when hardware arrives)

```
Hardware Interfaces:
  ESP32 WiFi         → backup uplink (AP mode for local config)
  4G LTE (AT cmds)   → primary uplink (PPP or AT+QMTCONN for MQTT)
  LAN (W5500 or ETH) → secondary uplink
  RS485 (UART1)      → Modbus RTU master — 14 fire devices
  RS232 (UART2)      → Fire Alarm Panel or spare
  DI[0..3]           → GPIO with optoisolation, interrupt-driven
  DO[0..1]           → GPIO relay output, latching

Uplink priority: 4G > LAN > WiFi
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

- [ ] Hardware gateway PCB/module delivery
- [ ] Verify pinout and UART assignments on actual board
- [ ] Update firmware plan in CLAUDE.md (Phase 5) for new interfaces
- [ ] Add DI/DO cards to Dashboard and Live Monitor pages
- [ ] Add uplink indicator (4G/LAN/WiFi) to TopBar / RightPanel

---

## Resume Checklist (when hardware arrives)

1. Run `pnpm test` in `frontend/` — confirm 43/43 still pass
2. Present dashboard screenshots to client for layout approval
3. Start Phase 2 backend (Express + MongoDB + MQTT + Socket.IO)
4. Update firmware plan for 4G + LAN + RS232 + DI/DO
5. Start Phase 5 firmware once board pinout is confirmed

---

## Contact / Ownership

**Project:** JENIX FireGuard v1  
**PID:** FIREGUARD-S3-01  
**Repo:** https://github.com/manoj020218/fire_alarm  
**Full plan:** See `CLAUDE.md` in repo root  
