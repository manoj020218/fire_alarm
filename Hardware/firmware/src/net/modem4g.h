#pragma once
// ============================================================
// FireGuard — 4G modem (SIMCOM A7672S via TinyGSM as SIM7600)
// Non-blocking state machine: call modem4g_step() each loop tick
// to advance the bring-up sequence without stalling loopTask.
// ============================================================
#include <Arduino.h>

// Modem bring-up states (informational; drives modem4g_step logic)
enum class Modem4gState : uint8_t {
    OFF = 0,
    POWERING,       // PWR_KEY pulse in progress
    WAIT_AT,        // waiting for AT response after power-up
    WAIT_NETWORK,   // polling isNetworkConnected()
    CONNECTING_GPRS,// gprsConnect() attempt (one-shot, bracketed with WDT reset)
    CONNECTED,
    FAILED          // back-off before retry
};

// Non-blocking step: call every uplink tick; returns current state.
// Internally advances state machine; never blocks > ~2 s per call.
Modem4gState modem4g_step(const char* apn);

// True when CONNECTED and PDP context is active.
bool modem4g_is_connected();

// Periodic maintenance (dropped-context detection); non-blocking.
void modem4g_maintain();

int    modem4g_signal_dbm();
String modem4g_operator();
bool   modem4g_get_time(struct tm* out);

// Access the underlying TinyGSM client (owned by uplink module)
class Client;
Client* modem4g_get_client();
