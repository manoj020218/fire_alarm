#pragma once
// ============================================================
// FireGuard — Uplink failover manager
// Priority: 4G > LAN > WiFi
// Exposes the active Client& for MQTT / HTTP use.
// Re-evaluates on loss (every UPLINK_CHECK_INTERVAL_MS).
// ============================================================
#include <Arduino.h>
#include <Client.h>

enum class UplinkType { NONE, G4, LAN, WIFI };

void     uplink_init();
void     uplink_loop();         // call every loop(); non-blocking
bool     uplink_is_up();
UplinkType uplink_active_type();
const char* uplink_type_str();  // "4g" | "lan" | "wifi" | "none"
Client&  uplink_get_client();       // MQTT (persistent)
Client&  uplink_get_http_client();  // HTTP/api — separate socket, never shared with MQTT
// Cloud reachability feedback from MQTT: if the cloud can't be reached over the
// active transport, avoid it for a while and fail over (unless pref forbids).
void     uplink_report_cloud_fail();
void     uplink_report_cloud_ok();
int      uplink_signal_4g_dbm();
bool     uplink_signal_lan();
