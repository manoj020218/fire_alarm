// ============================================================
// FireGuard — WiFi STA + provisioning AP
// AP SSID: JNX-FG-XXXX  (always on for provisioning access)
// STA credentials stored in NVS / config struct.
//
// NON-BLOCKING DESIGN
// -------------------
// wifi_begin() starts softAP + WiFi.begin() and returns immediately.
// WiFi.begin() is async; the ESP32 SDK reconnects in the background.
// wifi_sta_connected() / wifi_maintain() poll WiFi.status() — no loop.
// ============================================================
#include "wifiap.h"
#include "../config/defaults.h"
#include "../util/log.h"
#include <WiFi.h>
#include <WiFiClient.h>

static WiFiClient s_client;      // MQTT (persistent connection)
static WiFiClient s_httpClient;  // HTTP/api calls — MUST be separate from MQTT's
static bool       s_staUp  = false;
static bool       s_apUp   = false;

bool wifi_begin(const char* ssid, const char* pass, const char* apSsid) {
    // Start AP for provisioning (always, even if STA connects)
    if (!s_apUp) {
        WiFi.softAP(apSsid, nullptr, WIFI_AP_CHANNEL);
        s_apUp = true;
        LOG_I("WIFI", "AP started  SSID=%s  IP=%s",
              apSsid, WiFi.softAPIP().toString().c_str());
    }

    if (ssid && strlen(ssid) > 0) {
        LOG_I("WIFI", "STA begin '%s' (async — polls via wifi_sta_connected)", ssid);
        WiFi.begin(ssid, pass);
        // Do NOT wait here — connection result polled by wifi_sta_connected()
    } else {
        LOG_W("WIFI", "No STA credentials — AP-only mode");
    }

    // Return true immediately; caller checks wifi_sta_connected() later
    return true;
}

bool wifi_sta_connected() {
    return WiFi.status() == WL_CONNECTED;
}

void wifi_maintain() {
    bool now = wifi_sta_connected();
    if (s_staUp && !now) {
        LOG_W("WIFI", "STA dropped");
        s_staUp = false;
    } else if (!s_staUp && now) {
        LOG_I("WIFI", "STA connected  IP=%s  RSSI=%d",
              WiFi.localIP().toString().c_str(), WiFi.RSSI());
        s_staUp = true;
    }
}

int wifi_rssi() {
    return wifi_sta_connected() ? (int)WiFi.RSSI() : 0;
}

Client* wifi_get_client()      { return &s_client; }
Client* wifi_get_http_client() { return &s_httpClient; }
