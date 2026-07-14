// ============================================================
// FireGuard — Uplink failover manager implementation
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

static UplinkType s_active = UplinkType::NONE;
static Client*    s_client = nullptr;
static Task       s_checkTask = {0, UPLINK_CHECK_INTERVAL_MS};
static bool       s_4gInited  = false;
static bool       s_ethInited = false;
static bool       s_wifiInited= false;

// Build the WiFi AP SSID from the gateway ID
static String ap_ssid() {
    const char* gw = getConfig().gatewayId;
    if (strlen(gw) >= 4) {
        return String(gw);  // already "JNX-FG-XXXX"
    }
    return String(WIFI_AP_SSID_PREFIX) + "0000";
}

static UplinkType try_connect() {
    GatewayConfig& cfg = getConfig();

    // --- 4G (highest priority) ---
    if (!s_4gInited) {
        s_4gInited = modem4g_init(cfg.apn);
    }
    if (s_4gInited && modem4g_is_connected()) {
        return UplinkType::G4;
    }

    // --- LAN ---
    if (!s_ethInited) {
        s_ethInited = eth_init();
    }
    if (s_ethInited && eth_is_connected()) {
        return UplinkType::LAN;
    }

    // --- WiFi STA (creds from NVS "fg_wifi" namespace) ---
    if (!s_wifiInited) {
        Preferences wprefs;
        wprefs.begin("fg_wifi", true);
        String wssid = wprefs.getString("ssid", "");
        String wpass = wprefs.getString("pass", "");
        wprefs.end();
        s_wifiInited = wifi_begin(
            wssid.c_str(),
            wpass.c_str(),
            ap_ssid().c_str()
        );
    }
    if (wifi_sta_connected()) {
        return UplinkType::WIFI;
    }

    return UplinkType::NONE;
}

void uplink_init() {
    // Kick off AP immediately so provisioning works even before 4G
    String ssid = ap_ssid();
    wifi_begin("", "", ssid.c_str());
    s_wifiInited = true;

    // Force immediate uplink check
    task_trigger_now(s_checkTask);
    uplink_loop();
}

void uplink_loop() {
    // Periodic maintenance
    modem4g_maintain();
    eth_maintain();
    wifi_maintain();

    if (!task_due(s_checkTask)) return;

    UplinkType prev = s_active;

    // Check current transport still alive
    bool currentAlive = false;
    switch (s_active) {
        case UplinkType::G4:   currentAlive = modem4g_is_connected(); break;
        case UplinkType::LAN:  currentAlive = eth_is_connected();     break;
        case UplinkType::WIFI: currentAlive = wifi_sta_connected();   break;
        default: break;
    }

    if (!currentAlive) {
        // Re-probe in priority order
        s_active = try_connect();
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
