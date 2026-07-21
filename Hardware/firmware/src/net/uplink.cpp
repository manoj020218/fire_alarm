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
                                             // loop — hammering AT stalls registration)
static bool       s_wifiInited = false;

// Build the WiFi AP SSID from the gateway ID
static String ap_ssid() {
    const char* gw = getConfig().gatewayId;
    if (strlen(gw) >= 4) {
        return String(gw);
    }
    return String(WIFI_AP_SSID_PREFIX) + "0000";
}

// ---- non-blocking probe — returns best available transport ---
// The modem state machine is driven every loop() in uplink_loop() (fast cadence
// + kept warm), so here we only CHECK its status. Priority: 4G > WiFi > LAN
// (SIM-first; will become configurable via uplinkOrder).
static UplinkType probe_transports() {
    if (modem4g_is_connected()) {
        return UplinkType::G4;
    }

    // WiFi STA: just poll (WiFi.begin was called in uplink_init)
    if (wifi_sta_connected()) {
        return UplinkType::WIFI;
    }

    // LAN: advance state machine one step
    eth_step();
    if (eth_is_connected()) {
        return UplinkType::LAN;
    }

    return UplinkType::NONE;
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
    // Drive the 4G state machine on a ~1.5s cadence (not every 30s, not every
    // loop). Fast enough that bring-up steps run at their real durations; slow
    // enough that we don't flood the modem's AT port during registration. Runs
    // even when WiFi/LAN is active → 4G stays warm for instant failover + SMS.
    if (task_due(s_modemTask)) {
        modem4g_step(getConfig().apn);
    }

    // Periodic maintenance (non-blocking)
    modem4g_maintain();
    eth_maintain();
    wifi_maintain();

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

bool uplink_is_up() { return s_active != UplinkType::NONE && s_client != nullptr; }

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
