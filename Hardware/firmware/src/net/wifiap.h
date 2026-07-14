#pragma once
// ============================================================
// FireGuard — WiFi STA + AP-portal fallback
// ============================================================
#include <Arduino.h>

// Try STA first; if it fails start AP (JNX-FG-XXXX).
// Returns true when STA is connected; AP is always started
// so provisioning is accessible even when STA is up.
bool wifi_begin(const char* ssid, const char* pass, const char* apSsid);
bool wifi_sta_connected();
void wifi_maintain();
int  wifi_rssi();

class Client;
Client* wifi_get_client();
