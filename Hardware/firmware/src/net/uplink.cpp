// ============================================================
// FireGuard — Uplink failover manager implementation
// Priority: 4G > LAN > WiFi
//
// NON-BLOCKING DESIGN
// -------------------
// Each transport exposes a step() / is_connected() pair.
// uplink_loop() is called every main loop() iteration and
// calls modem4g_step(), eth_step(), wifi_maintain() — all
// return quickly.  No blocking waits anywhere in this file.
// ============================================================
#include "uplink.h"
#include "modem4g.h"
#include "ethernet.h"
#include "wifiap.h"
#include "../config/config.h"
#include "../config/defaults.h"
#include "../util/log.h"
#include "../util/scheduler.h"
#include "../util/health.h"
#include <WiFiClient.h>
#include <Preferences.h>

static UplinkType s_active     = UplinkType::NONE;
static Client*    s_client     = nullptr;   // MQTT
static Client*    s_httpClient = nullptr;   // HTTP/api — separate socket from MQTT
static Task       s_checkTask  = {0, UPLINK_CHECK_INTERVAL_MS};
static Task       s_modemTask  = {0, 1500};  // drive modem ~every 1.5s (not every
                                             // loop - hammering AT stalls registration)
static bool       s_wifiInited = false;
// Per-transport "cloud unreachable" cooldown (indexed by UplinkType). While a
// transport is avoided we don't prefer it, so the gateway fails over to one that
// actually reaches the broker instead of stranding online-but-offline.
static uint32_t   s_avoidUntil[4] = {0, 0, 0, 0};

static bool avoided(UplinkType t) {
    uint32_t until = s_avoidUntil[(int)t];
    return until != 0 && (int32_t)(millis() - until) < 0;
}

static bool transport_connected(UplinkType t) {
    switch (t) {
        case UplinkType::G4:   return modem4g_is_connected();
        case UplinkType::LAN:  return eth_is_connected();
        case UplinkType::WIFI: return wifi_sta_connected();
        default:               return false;
    }
}

// Build the WiFi AP SSID from the gateway ID
static String ap_ssid() {
    const char* gw = getConfig().gatewayId;
    if (strlen(gw) >= 4) {
        return String(gw);
    }
    return String(WIFI_AP_SSID_PREFIX) + "0000";
}

// ---- non-blocking probe — returns best available transport ---
// Honors the configured uplink preference (cfg.uplinkPref):
//   0 = Auto (SIM-first): 4G > WiFi > LAN, with cloud failover
//   1 = WiFi/LAN first:   WiFi > LAN > 4G
//   2 = SIM only:         4G only
//   3 = WiFi only:        WiFi only
// A transport that MQTT reported cloud-unreachable is skipped (unless it's the
// only thing up). The modem SM is driven in uplink_loop(); here we only check.
static UplinkType probe_transports() {
    eth_step();  // keep LAN DHCP advancing
    const bool up4g  = modem4g_is_connected();
    const bool upWifi = wifi_sta_connected();
    const bool upLan  = eth_is_connected();

    UplinkType order[3];
    int n = 0;
    switch (getConfig().uplinkPref) {
        case 3: order[n++] = UplinkType::WIFI; break;                                  // WiFi only
        case 2: order[n++] = UplinkType::G4;   break;                                  // SIM only
        case 1: order[n++] = UplinkType::WIFI; order[n++] = UplinkType::LAN;
                order[n++] = UplinkType::G4;   break;                                  // WiFi/LAN first
        default: order[n++] = UplinkType::G4;  order[n++] = UplinkType::WIFI;
                 order[n++] = UplinkType::LAN; break;                                  // Auto SIM-first
    }
    auto isUp = [&](UplinkType t) {
        return (t == UplinkType::G4 && up4g) || (t == UplinkType::WIFI && upWifi) ||
               (t == UplinkType::LAN && upLan);
    };
    // Pass 1: first up transport that isn't cloud-avoided.
    for (int i = 0; i < n; i++) if (isUp(order[i]) && !avoided(order[i])) return order[i];
    // Pass 2: ignore the avoid list rather than strand with nothing.
    for (int i = 0; i < n; i++) if (isUp(order[i])) return order[i];
    return UplinkType::NONE;
}

void uplink_report_cloud_fail() {
    if (s_active == UplinkType::NONE) return;
    s_avoidUntil[(int)s_active] = millis() + UPLINK_CLOUD_AVOID_MS;
    LOG_W("UPLINK", "Cloud unreachable over %s — failing over", uplink_type_str());
    task_trigger_now(s_checkTask);   // re-select immediately
}

void uplink_report_cloud_ok() {
    if (s_active != UplinkType::NONE) s_avoidUntil[(int)s_active] = 0;
}

void uplink_init() {
    // Start AP immediately so provisioning works even before 4G
    String ssid = ap_ssid();
    GatewayConfig& cfg = getConfig();

    // Load WiFi STA creds and start (non-blocking)
    Preferences wprefs;
    wprefs.begin("fg_wifi", true);
    String wssid = wprefs.getString("ssid", "");
    String wpass = wprefs.getString("pass", "");
    wprefs.end();
    wifi_begin(wssid.c_str(), wpass.c_str(), ssid.c_str());
    s_wifiInited = true;

    // Force immediate uplink check on first loop
    task_trigger_now(s_checkTask);
}

void uplink_loop() {
    // Decide whether to drive the modem at all. Modem AT calls can block for a
    // few seconds, so we DON'T run it when the user picked WiFi, or when a WiFi/
    // LAN path is already up in WiFi-first mode — that keeps the loop (and the
    // live WiFi uplink) responsive instead of stalling on 4G bring-up.
    //   0 Auto (SIM-first) / 2 SIM-only → always drive modem
    //   1 WiFi/LAN first  → drive modem only when WiFi AND LAN are down
    //   3 WiFi only        → never drive the modem
    bool needModem;
    switch (getConfig().uplinkPref) {
        case 3:  needModem = false; break;
        case 1:  needModem = !(wifi_sta_connected() || eth_is_connected()); break;
        default: needModem = true; break;
    }
    if (needModem && task_due(s_modemTask)) {
        modem4g_step(getConfig().apn);
    }

    // Periodic maintenance (non-blocking)
    modem4g_maintain();
    eth_maintain();
    wifi_maintain();

    // If the selected transport has dropped out underneath us, force an immediate
    // re-probe so cloud traffic stops using a stale path.
    if (s_active != UplinkType::NONE && !transport_connected(s_active)) {
        task_trigger_now(s_checkTask);
    }

    if (!task_due(s_checkTask)) return;

    UplinkType prev = s_active;

    // PREEMPTIVE selection: always pick the highest-priority transport that is up,
    // so when 4G finishes attaching it TAKES OVER from WiFi (SIM-first), and if it
    // later drops we fail back down the order. (Was sticky: only re-probed when the
    // current transport died, so a higher-priority link coming up was ignored.)
    s_active = probe_transports();

    // Update client pointers — MQTT and HTTP get SEPARATE sockets so an HTTP
    // request never clobbers the live MQTT connection.
    switch (s_active) {
        case UplinkType::G4:
            s_client = modem4g_get_client();  s_httpClient = modem4g_get_http_client(); break;
        case UplinkType::LAN:
            s_client = eth_get_client();      s_httpClient = eth_get_http_client();     break;
        case UplinkType::WIFI:
            s_client = wifi_get_client();     s_httpClient = wifi_get_http_client();    break;
        default:
            s_client = nullptr;               s_httpClient = nullptr;                   break;
    }

    if (s_active != prev) {
        health_inc_uplink_switch();
        LOG_I("UPLINK", "Active transport: %s", uplink_type_str());
    }
}

bool uplink_is_up() {
    return s_active != UplinkType::NONE && s_client != nullptr && transport_connected(s_active);
}

UplinkType uplink_active_type() { return s_active; }

const char* uplink_type_str() {
    switch (s_active) {
        case UplinkType::G4:   return "4g";
        case UplinkType::LAN:  return "lan";
        case UplinkType::WIFI: return "wifi";
        default:               return "none";
    }
}

Client& uplink_get_client() {
    static WiFiClient dummy;
    return s_client ? *s_client : dummy;
}

Client& uplink_get_http_client() {
    static WiFiClient dummy;
    return s_httpClient ? *s_httpClient : dummy;
}

int  uplink_signal_4g_dbm() { return modem4g_signal_dbm(); }
bool uplink_signal_lan()     { return eth_signal_ok(); }
