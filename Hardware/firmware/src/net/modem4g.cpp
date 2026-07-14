// ============================================================
// FireGuard — 4G modem implementation (A7672S / TinyGSM SIM7600)
// Serial1: RX=27 TX=26  PWR_KEY=4
// ============================================================
#define TINY_GSM_MODEM_SIM7600
#include <TinyGsmClient.h>
#include "modem4g.h"
#include "../config/pins.h"
#include "../util/log.h"

static TinyGsm       s_modem(Serial1);
static TinyGsmClient s_client(s_modem);
static bool          s_ready = false;

static void power_cycle() {
    LOG_I("4G", "Power cycling modem (PWR_KEY=%d)", PIN_4G_PWR_KEY);
    pinMode(PIN_4G_PWR_KEY, OUTPUT);
    digitalWrite(PIN_4G_PWR_KEY, LOW);
    // A7672S: hold PWR_KEY LOW for ~1 s to toggle power
    uint32_t t = millis();
    while (millis() - t < 1200) { yield(); }
    digitalWrite(PIN_4G_PWR_KEY, HIGH);
    t = millis();
    while (millis() - t < 3000) { yield(); }
}

bool modem4g_init(const char* apn) {
    LOG_I("4G", "Initialising Serial1 RX=%d TX=%d", PIN_4G_RX, PIN_4G_TX);
    Serial1.begin(115200, SERIAL_8N1, PIN_4G_RX, PIN_4G_TX);

    power_cycle();

    LOG_I("4G", "Waiting for modem response...");
    if (!s_modem.testAT(6000)) {
        LOG_W("4G", "No AT response after power cycle");
        s_ready = false;
        return false;
    }
    s_modem.sendAT(GF("+CMEE=2"));  // verbose error codes
    s_modem.waitResponse();

    LOG_I("4G", "Waiting for SIM...");
    if (!s_modem.waitForNetwork(20000)) {
        LOG_W("4G", "Network registration timeout");
        s_ready = false;
        return false;
    }

    LOG_I("4G", "GPRS connect APN='%s'", apn);
    if (!s_modem.gprsConnect(apn, "", "")) {
        LOG_W("4G", "GPRS connect failed");
        s_ready = false;
        return false;
    }

    s_ready = true;
    LOG_I("4G", "Connected. Signal: %d dBm  Op: %s",
          modem4g_signal_dbm(), modem4g_operator().c_str());
    return true;
}

bool modem4g_is_connected() {
    if (!s_ready) return false;
    return s_modem.isGprsConnected();
}

void modem4g_maintain() {
    // Non-blocking check; called from uplink manager
    if (s_ready && !s_modem.isGprsConnected()) {
        LOG_W("4G", "GPRS dropped — marking not ready");
        s_ready = false;
    }
}

int modem4g_signal_dbm() {
    if (!s_ready) return 0;
    int16_t sq = s_modem.getSignalQuality();
    if (sq == 99 || sq <= 0) return 0;
    // SIM7600 CSQ: dBm = -113 + (csq * 2)
    return -113 + sq * 2;
}

String modem4g_operator() {
    if (!s_ready) return "N/A";
    return s_modem.getOperator();
}

bool modem4g_get_time(struct tm* out) {
    if (!s_ready || !out) return false;
    int y, mo, d, h, mi, s, tz;
    float ftz;
    if (s_modem.getNetworkTime(&y, &mo, &d, &h, &mi, &s, &ftz)) {
        out->tm_year = y - 1900;
        out->tm_mon  = mo - 1;
        out->tm_mday = d;
        out->tm_hour = h;
        out->tm_min  = mi;
        out->tm_sec  = s;
        return true;
    }
    return false;
}

Client* modem4g_get_client() { return &s_client; }
