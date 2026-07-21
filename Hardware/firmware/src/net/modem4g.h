#pragma once
// ============================================================
// FireGuard 4G modem (SIMCOM A7672S via TinyGSM A7672X)
// Non-blocking state machine: call modem4g_step() each uplink tick.
// ============================================================
#include <Arduino.h>

enum class Modem4gState : uint8_t {
    OFF = 0,
    POWERING,
    POWERING_DOWN,
    WAIT_AT,
    WAIT_NETWORK,
    CONNECTING_GPRS,
    CONNECTED,
    FAILED
};

Modem4gState modem4g_step(const char* apn);
bool modem4g_is_connected();
void modem4g_maintain();
void modem4g_report_broker_fail(int mqttRc);

int modem4g_signal_dbm();
String modem4g_operator();
const char* modem4g_state_str();
String modem4g_ip();   // modem's data-plane IP (empty if not connected)
bool modem4g_get_time(struct tm* out);

bool modem4g_is_registered();
bool modem4g_send_sms(const char* number, const char* text);

String modem4g_iccid();
String modem4g_imsi();
int modem4g_signal_csq();
String modem4g_own_number();
String modem4g_ussd(const char* code);
String modem4g_read_sms_raw();
String modem4g_send_sms_diag(const char* number, const char* text);
bool modem4g_call(const char* number);

class Client;
Client* modem4g_get_client();
Client* modem4g_get_http_client();
