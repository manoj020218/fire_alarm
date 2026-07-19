# FireGuard Gateway — Firmware Upload (Flashing) Guide

Board: **Vajruino VVM401 (ESP32 classic)**. There are **no BOOT/EN buttons** — boot
mode is set with the **J1 (GPIO0)** and **J2 (RESET)** jumpers. Flash over the onboard
CH9102 USB port (e.g. `COM12`) or an external USB‑TTL wired to J1/J2.

> After the **first** cable flash, every future update goes **OTA** from the VPS — the
> jumper dance is never needed again in the field.

---

## ⚠️ #1 rule: REMOVE THE SD CARD BEFORE FLASHING
The SD card's **MISO line is GPIO2**, which is an ESP32 **strapping pin**. With a card
inserted, GPIO2 is held high and the chip **cannot enter download mode**, so esptool
fails with:

```
A fatal error occurred: Failed to connect to ESP32: No serial data received.
```

**Take the SD card out, flash, then put it back.** (This was the cause of every failed
attempt on 2026‑07‑19.)

---

## Pre-flash checklist
1. **SD card removed.** ← the big one.
2. `J_RS232/RS485` jumper set to the **RS485** side.
3. Board powered (12 V) and USB connected.
4. Find the port: `pio device list` (ours showed `COM12`, a CH9102 bridge).

## Enter download mode (jumpers, no buttons)
1. Hold **J1 (GPIO0) LOW**.
2. Momentarily toggle **J2 (RESET)** (connect → disconnect).
3. Release **J1**.
4. The ESP32 is now sitting in the bootloader and stays there until the next reset.

## Flash
```
cd Hardware/firmware
pio run -t upload --upload-port COM12       # adjust the port
```
`platformio.ini` is already set for this board: `upload_speed = 115200` and
`upload_flags = --before=no_reset` (no auto-reset — you entered the bootloader by hand).

## After flashing
1. Toggle **J2 (RESET)** to boot the new firmware.
2. **Re-insert the SD card.**
3. (Optional) Watch it boot: `pio device monitor -p COM12 -b 115200`
   — you should see the derived `gatewayId`, uplink, and MQTT connect.

---

## Troubleshooting "No serial data received"
In order of likelihood:
1. **SD card still inserted** → remove it.
2. **Not in download mode** → redo J1‑low + toggle J2, release J1, then upload.
3. **Wrong COM port** → re-check `pio device list`.
4. Something else pulling a **strapping pin** (GPIO0/2/12/15) — unplug peripherals on
   those lines while flashing.

## Build only (no flash)
```
pio run          # → .pio/build/fireguard/firmware.bin
```

## Field updates (no cable)
Publish a new firmware release on the VPS; gateways pull it via the OTA manifest (daily)
or on an MQTT `command → {"cmd":"update"}`. OTA‑with‑backup self‑validates for 5 min and
auto‑rolls‑back on failure. See `PORTABILITY.md` §6.
