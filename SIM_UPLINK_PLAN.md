# FireGuard — SIM-first Uplink & 4G Modem Overhaul (plan)

**Goal (user):** gateway works on **SIM/4G data FIRST**, falls back to **WiFi**, then **LAN**.
**Source:** `Hardware/Data Audit of Sim.txt` (static audit) + live tests + `src/net/uplink.cpp`.
**Delivery:** ship via **OTA** once the OTA pipeline is proven (no cable). Hardware = A7672S
(TinyGSM), W5500 LAN, WiFi STA+AP.

---

## A. Current state (confirmed in code)
- Uplink priority today = **`4G > LAN > WiFi`** (`uplink.cpp:39-60` `probe_transports()`).
  User wants **`4G > WiFi > LAN`** → swap WiFi above LAN.
- Device currently runs on **WiFi** only because 4G never reaches CONNECTED (modem bugs below)
  and LAN is unplugged.
- `modem4g_step()` (the modem state machine) is called **only** inside `probe_transports()`,
  which runs **only every 30 s** (`UPLINK_CHECK_INTERVAL_MS`) **and only when the active
  transport is dead** (`uplink.cpp:82-102`). So the modem barely advances.

## B. Root causes (from audit, mapped to fixes)
| # | Root cause | Sev | Fix |
|---|---|---|---|
| S1 | **30 s state-machine cadence** — PWR_KEY hold, AT probe, network polls all stretched to minutes (`uplink.cpp:86`, `defaults.h:40`) | CRIT | Run modem bring-up on a **fast cadence (~1 s)**, decoupled from the 30 s transport-preference check |
| S2 | **Wrong modem profile** — `TINY_GSM_MODEM_SIM7600` forced but HW is **A7672S** (`platformio.ini:21`, `modem4g.cpp:15`); TinyGSM has a dedicated `A7672X` driver with different CREG/PDP/attach flow | CRIT | Switch to **`TINY_GSM_MODEM_A7672X`**; re-verify attach/registration calls compile against that driver |
| S3 | **4G warm-standby stalls when WiFi/LAN active** — `modem4g_step()` never called once another transport is alive (`uplink.cpp:39,99`) | HIGH | Keep the modem state machine **always running to CONNECTED**, even when WiFi/LAN is the active uplink (instant failover + SMS/call backup) |
| S4 | **operator/signal hidden until PDP CONNECTED** — `modem4g_operator()`→"N/A", `signal_dbm()`→0 unless CONNECTED (`modem4g.cpp:181`); SIM panel reports before registration (`simsvc.cpp:31`) | HIGH | Expose **raw** CPIN/CREG/CGREG/CEREG/COPS/CSQ/CGATT/CGDCONT/IP regardless of PDP state |
| S5 | **No SIM readiness gate** — jumps testAT()→RAT/APN→net wait, no CPIN/SIM_READY check (`modem4g.cpp:84`) | HIGH | Add a boot-time **CPIN READY** gate before RAT/APN. NOTE: SIM is **set-once in the field** (per owner) — NO hot-swap / removed-inserted handling needed; a reboot re-reads the SIM if ever changed. |
| S6 | **APN/RAT unsafe defaults** — APN blank (`defaults.h:29`), LTE-only false; JIO needs APN preloaded before LTE attach (`modem4g.cpp:99`) | HIGH | Treat APN + RAT as **mandatory provisioning**; ship per-operator presets (Airtel `airtelgprs.com` auto; JIO `jionet` + LTE-only) |
| S7 | **60 s registration timeout too short** — first attach can take minutes (TinyGSM README:310) (`modem4g.cpp:35`) | MED | Raise first-attach budget to **~3-5 min**; don't power-cycle the modem during a valid operator search |
| S8 | **SIM debug only via MQTT** — dies with cellular (`mqtt.cpp:60`, `simsvc.cpp:26`) | MED | Add **local** SIM diagnostics (WebUI page / serial) that works with cellular down |

## C. Uplink priority — CONFIGURABLE from the dashboard (per-gateway)
Field reality varies per site and isn't in our control, so priority is a **per-gateway setting
pushed from the dashboard** over the existing `config/set` MQTT pipe (same mechanism as SMS
numbers / register map), stored in NVS. This removes the "SIM-first vs WiFi-first" guess — the
installer picks per site. Default = **SIM-first**.

**Config field (ordered list; omit a transport to DISABLE it):**
```
uplinkOrder: ["4g","wifi","lan"]   // probe in this order
```
Covers every case with one field:
- SIM-first: `["4g","wifi","lan"]`  · WiFi/LAN-first (data-saver): `["wifi","lan","4g"]`
- SIM-only: `["4g"]`  · WiFi-only: `["wifi"]`  · LAN-only: `["lan"]`

`probe_transports()` loops over the configured order instead of the hardcoded `4G > LAN > WiFi`.

**Dashboard UX:** preset dropdown (SIM first / WiFi-LAN first / SIM only / WiFi only / LAN only /
Custom…), Custom = drag-to-reorder + on/off toggles.

**Behavior defaults:**
- **Preemptive with hold-down** — switch back to a higher-priority link only after it's stably
  CONNECTED ~30s (avoids flapping). Failover down is immediate.
- **Keep 4G warm regardless** (even if 4G is low-priority or disabled-for-data) so SMS / missed-call
  fire alerts always work (S3). Warm modem = instant failover.

## D. Implementation order (all deliverable via OTA)
1. **S2 modem profile → A7672X** (biggest single fix) + compile-verify against the A7672X driver.
2. **S1+S3 cadence** — dedicated fast modem task (~1 s), always-on to CONNECTED.
3. **S5 SIM gate** + **S7 longer timeout / no mid-search power-cycle**.
4. **S6 APN/RAT provisioning** presets + WebUI enforcement.
5. **S4 raw status** exposure + **S8 local WebUI SIM diagnostics**.
6. **C. configurable priority** — `uplinkOrder` config field + `probe_transports()` loop +
   dashboard control (pushed via `config/set`), default SIM-first, with hold-down + keep-4G-warm.
7. Field-validate on **Airtel SIM** (auto RAT) first, then JIO (LTE-only) — over the real unit.

## E. Sequencing vs OTA
This overhaul rides on OTA. Order: **(1) finish proving OTA** (WebUI 1.0.5→1.0.6, then remote
MQTT 1.0.6→1.0.7) → **(2)** implement Section D as the next firmware (v1.1.0) → **(3)** push it
over-the-air. No further cable flashes needed once OTA is green.
