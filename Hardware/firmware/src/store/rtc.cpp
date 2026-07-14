// ============================================================
// FireGuard — DS3231 RTC implementation (RTClib)
// Time sync: 4G modem (primary) → NTP (fallback on LAN/WiFi)
// ============================================================
#include "rtc.h"
#include "../config/pins.h"
#include "../net/modem4g.h"
#include "../net/uplink.h"
#include "../util/log.h"
#include <Wire.h>
#include <RTClib.h>
#include <time.h>   // configTime, getLocalTime

static RTC_DS3231 s_rtc;
static bool       s_rtcOk   = false;
static uint32_t   s_lastSyncMs = 0;
static const uint32_t SYNC_INTERVAL_MS = 23UL * 3600UL * 1000UL; // 23 h

bool rtc_init() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    if (!s_rtc.begin(&Wire)) {
        LOG_W("RTC", "DS3231 not found at 0x68");
        s_rtcOk = false;
        return false;
    }
    if (s_rtc.lostPower()) {
        LOG_W("RTC", "RTC lost power — clock may be wrong");
    }
    s_rtcOk = true;
    DateTime now = s_rtc.now();
    LOG_I("RTC", "Init OK  %04d-%02d-%02d %02d:%02d:%02d",
          now.year(), now.month(), now.day(),
          now.hour(), now.minute(), now.second());
    return true;
}

uint32_t rtc_epoch() {
    if (!s_rtcOk) return 0;
    return s_rtc.now().unixtime();
}

String rtc_iso() {
    if (!s_rtcOk) return String("1970-01-01T00:00:00");
    DateTime n = s_rtc.now();
    char buf[20];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d",
             n.year(), n.month(), n.day(), n.hour(), n.minute(), n.second());
    return String(buf);
}

bool rtc_sync_from_tm(const struct tm* t) {
    if (!s_rtcOk || !t) return false;
    DateTime dt(t->tm_year + 1900, t->tm_mon + 1, t->tm_mday,
                t->tm_hour, t->tm_min, t->tm_sec);
    s_rtc.adjust(dt);
    s_lastSyncMs = millis();
    LOG_I("RTC", "Synced to %04d-%02d-%02d %02d:%02d:%02d",
          dt.year(), dt.month(), dt.day(),
          dt.hour(), dt.minute(), dt.second());
    return true;
}

// ---- Sync from 4G modem clock -------------------------------
bool rtc_sync_from_modem() {
    struct tm t = {};
    if (!modem4g_get_time(&t)) {
        LOG_W("RTC", "Modem time unavailable");
        return false;
    }
    // Basic sanity: year must be >= 2024
    if (t.tm_year + 1900 < 2024) {
        LOG_W("RTC", "Modem time looks invalid: year=%d", t.tm_year + 1900);
        return false;
    }
    bool ok = rtc_sync_from_tm(&t);
    if (ok) LOG_I("RTC", "Synced from 4G modem");
    return ok;
}

// ---- Sync via SNTP ------------------------------------------
bool rtc_sync_from_ntp(const char* ntpServer) {
    // configTime uses the system SNTP client (lwIP).
    // IST = UTC+5:30 = 19800 s offset; pass 0 and let RTC store UTC.
    configTime(0, 0, ntpServer, "time.cloudflare.com");

    struct tm t = {};
    // Wait up to 3 s for NTP to resolve
    uint32_t t0 = millis();
    while ((millis() - t0) < 3000) {
        if (getLocalTime(&t, 0) && t.tm_year + 1900 >= 2024) break;
        delay(100);
    }

    if (t.tm_year + 1900 < 2024) {
        LOG_W("RTC", "NTP failed — no valid time");
        return false;
    }

    bool ok = rtc_sync_from_tm(&t);
    if (ok) LOG_I("RTC", "Synced from NTP (%s)", ntpServer);
    return ok;
}

// ---- Daily sync decision ------------------------------------
void rtc_maybe_sync() {
    if (s_lastSyncMs > 0 && (millis() - s_lastSyncMs) < SYNC_INTERVAL_MS) {
        return;  // not yet time
    }

    // Priority: 4G modem → NTP
    if (uplink_active_type() == UplinkType::G4) {
        if (rtc_sync_from_modem()) return;
    }
    // LAN or WiFi: use NTP
    if (uplink_is_up()) {
        rtc_sync_from_ntp();
    }
}
