#pragma once
// ============================================================
// FireGuard — 4G modem (SIMCOM A7672S via TinyGSM as SIM7600)
// ============================================================
#include <Arduino.h>

// Returns true if modem is ready and PDP context is active.
bool modem4g_init(const char* apn);
bool modem4g_is_connected();
void modem4g_maintain();          // call periodically from uplink manager
int  modem4g_signal_dbm();        // RSSI in dBm (negative), 0 = unknown
String modem4g_operator();        // operator name string
bool modem4g_get_time(struct tm* out);  // fill from modem clock

// Access the underlying TinyGSM client (owned by uplink module)
// Forward-declared to avoid including TinyGSM everywhere.
class Client;
Client* modem4g_get_client();
