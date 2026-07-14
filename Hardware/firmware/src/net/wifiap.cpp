// ============================================================
// FireGuard — WiFi STA + provisioning AP
// AP SSID: JNX-FG-XXXX  (always on for provisioning access)
// STA credentials stored in NVS / config struct.
// ============================================================
#include "wifiap.h"
#include "../config/defaults.h"
#include "../util/log.h"
#include <WiFi.h>
#include <WiFiClient.h>

static WiFiClient s_client;
static bool       s_staUp  = false;
static bool       s_apUp   = false;

bool wifi_begin(const char* ssid, const char* pass, const char* apSsid) {
    // Start AP for provisioning (always, even if STA connects)
    WiFi.softAP(apSsid, nullptr, WIFI_AP_CHANNEL);
    s_apUp = true;
    LOG_I("WIFI", "AP started  SSID=%s  IP=%s",
          apSsid, WiFi.softAPIP().toString().c_str());

    if (ssid && strlen(ssid) > 0) {
        LOG_I("WIFI", "STA connecting to '%s'...", ssid);
        WiFi.begin(ssid, pass);
        uint32_t t  = millis();
        while (WiFi.status() != WL_CONNECTED && (millis() - t) < WIFI_STA_TIMEOUT_MS) {
            yield();
        }
        if (WiFi.status() == WL_CONNECTED) {
            s_staUp = true;
            LOG_I("WIFI", "STA connected  IP=%s  RSSI=%d",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
            return true;
        }
        LOG_W("WIFI", "STA connect failed — AP-only mode");
    } else {
        LOG_W("WIFI", "No STA credentials — AP-only mode");
    }
    s_staUp = false;
    return false;
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
        LOG_I("WIFI", "STA reconnected");
        s_staUp = true;
    }
}

int wifi_rssi() {
    return wifi_sta_connected() ? (int)WiFi.RSSI() : 0;
}

Client* wifi_get_client() { return &s_client; }
