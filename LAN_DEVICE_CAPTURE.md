# FireGuard — Multi-protocol Data Capture + LAN-accessible WebUI (roadmap)

Goal: a **professional gateway** that ingests field data over **RS485 (Modbus RTU)** *and*
**Ethernet/TCP-IP (Modbus TCP + others)**, and whose **local WebUI is reachable over the LAN**,
not only the WiFi AP. All deliverable via OTA. Status: **roadmap / not yet built.**

---

## 1. Data capture from LAN devices (Modbus TCP + more)

Today the gateway polls sensors over **RS485 Modbus RTU** with a configurable register map
(Device Management UI → pushed via `config/set`). Extend the SAME pipeline to LAN devices.

**Primary: Modbus TCP master.** Most industrial gear (PLCs, meters, fire panels, controllers)
also speaks Modbus TCP. Gateway connects to `IP:502`, reads the same register-map shape, and
pushes up the **existing** pipeline (tags → thresholds → alarms → telemetry → cloud). ~90% code
reuse — only a TCP transport is added under the existing Modbus layer.

**UI change:** add **connection type = `RS485` | `Modbus TCP`** to each device; TCP adds
`host/IP` + `port` (default 502) + `unitId` next to the register map already defined.

**How capture works (important):** the gateway captures by **actively polling** a device (Modbus
TCP / HTTP / SNMP) or by **being pushed to** (device posts to a gateway endpoint). It CANNOT
passively sniff traffic between *other* machines — the W5500 is a single port with no
mirroring/switching.

**Single LAN port does both jobs:** the W5500 gets one DHCP IP and can simultaneously reach the
VPS (uplink) AND poll local devices, as long as they share the subnet.

**Other protocols (per-need, later):** device→gateway push (raw TCP / HTTP / local MQTT),
HTTP/REST pull, SNMP, BACnet/IP. Each is a small protocol client feeding the same tag pipeline.

**Capacity limits:** W5500 has ~8 TCP sockets (a few used by uplink/WebUI); ESP32 heap is modest.
Good for a **handful** of TCP devices per gateway — scale out with more gateways for large sites.

**Implementation sketch:**
- `src/modbus/` gains a TCP client path selectable per device (RS485 vs TCP).
- Device schema (firmware NVS + backend `Device` model + config/set payload) gains
  `conn: 'rs485'|'tcp'`, `host`, `port`, `unitId`.
- Device Management UI: conn-type toggle + host/port fields.
- Poll scheduler iterates all devices regardless of transport; same alarm/telemetry output.

---

## 2. Local WebUI over the LAN (Ethernet), not just WiFi AP

Want: plug a laptop into the same switch / the gateway's LAN and open the WebUI at the gateway's
**Ethernet IP** — no need to join the `JNX-FG-xxxx` WiFi hotspot. Great for panel-mounted units.

**It's possible, with one architectural change.** The WebUI is `ESPAsyncWebServer` (AsyncTCP) which
runs on the ESP32 **lwIP** stack — so it already serves over **WiFi AP (192.168.4.1)** and the
**WiFi STA LAN IP**. But the W5500 currently uses the **Arduino `Ethernet.h` (Wiznet) stack**, which
is SEPARATE from lwIP — so AsyncWebServer does NOT serve over the Ethernet port today.

**Fix (professional path): move the W5500 onto the ESP32 lwIP stack** via the ESP-IDF SPI-Ethernet
driver (`ETH.h` / `esp_eth` + `esp_eth_mac_new_w5500`). Once the W5500 is an lwIP netif:
- The **existing** AsyncWebServer serves the WebUI on the **Ethernet IP automatically** (one server,
  all interfaces — WiFi AP + WiFi STA + Ethernet).
- Bonus: the uplink layer simplifies — a plain `WiFiClient` works over any lwIP interface, so the
  separate `EthernetClient` handling (and the D9 per-transport client juggling for LAN) can collapse.
- MQTT/HTTP uplink over Ethernet also rides lwIP, consistent with WiFi.

**Cost:** rewrite `src/net/ethernet.cpp` from Arduino `Ethernet.h` to `ETH.h`/`esp_eth` (SPI W5500,
same CS/RST/INT pins). Medium effort, well-contained. Verify W5500 SPI pins map to the esp_eth SPI
config. After this, LAN uplink + LAN WebUI + LAN device polling all share one stack.

**Security note:** exposing the WebUI on a customer LAN → keep the admin password gate (already
present) and consider binding provisioning-sensitive actions behind it; optionally a setting to
disable WebUI on the uplink LAN.

---

## 3. Suggested sequencing
These are independent of the SIM overhaul (`SIM_UPLINK_PLAN.md`) and OTA (done). Rough order:
1. **Modbus TCP capture** (highest product value, ~90% reuse) — item 1.
2. **W5500 → lwIP (`ETH.h`)** — unlocks LAN WebUI (item 2) AND simplifies uplink; do before/with
   heavy LAN use.
3. Extra push/pull protocols as specific customers need them.
All ship via **OTA**.
