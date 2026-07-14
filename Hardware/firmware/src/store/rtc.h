#pragma once
// ============================================================
// FireGuard — DS3231 RTC wrapper
// I2C SDA=21 SCL=22  address 0x68
// ============================================================
#include <Arduino.h>

bool rtc_init();
uint32_t rtc_epoch();           // Unix timestamp (seconds since 1970)
String   rtc_iso();             // "2026-07-14T08:30:00"
bool     rtc_sync_from_tm(const struct tm* t);   // sync from modem / NTP

// Sync from 4G modem clock (TinyGSM getNetworkTime).
// Returns true if modem time was valid and applied.
bool rtc_sync_from_modem();

// Sync via SNTP (WiFi/LAN path).
// Returns true if NTP succeeded (blocks ~2 s, call once after uplink up).
bool rtc_sync_from_ntp(const char* ntpServer = "pool.ntp.org");

// Trigger daily sync (call from main loop once uplink is available).
// Only actually syncs if >23 h since last sync. Non-blocking.
void rtc_maybe_sync();
