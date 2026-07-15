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
static Client*    s_client     = nullptr;
static Task       s_checkTask  = {0, UPLINK_CHECK_INTERVAL_MS};
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
static UplinkType probe_transports() {
    GatewayConfig& cfg = getConfig();

    // --- 4G: advance state machine one step ---
    modem4g_step(cfg.apn);
    if (modem4g_is_connected()) {
        return UplinkType::G4;
    }

    // --- LAN: advance state machine one step ---
    eth_step();
    if (eth_is_connected()) {
        return UplinkType::LAN;
    }

    // --- WiFi STA: just poll (WiFi.begin was called in uplink_init) ---
    if (wifi_sta_connected()) {
        return UplinkType::WIFI;
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
    // Periodic maintenance (non-blocking)
    modem4g_maintain();
    eth_maintain();
    wifi_maintain();

    if (!task_due(s_checkTask)) return;

    UplinkType prev = s_active;

    // Check if current transport is still alive
    bool currentAlive = false;
    switch (s_active) {
        case UplinkType::G4:   currentAlive = modem4g_is_connected(); break;
        case UplinkType::LAN:  currentAlive = eth_is_connected();     break;
        case UplinkType::WIFI: currentAlive = wifi_sta_connected();   break;
        default: break;
    }

    if (!currentAlive) {
        // Re-probe all transports (each step call is non-blocking)
        s_active = probe_transports();
    }

    // Update client pointer
    switch (s_active) {
        case UplinkType::G4:   s_client = modem4g_get_client(); break;
        case UplinkType::LAN:  s_client = eth_get_client();     break;
        case UplinkType::WIFI: s_client = wifi_get_client();    break;
        default:               s_client = nullptr;              break;
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

int  uplink_signal_4g_dbm() { return modem4g_signal_dbm(); }
bool uplink_signal_lan()     { return eth_signal_ok(); }
