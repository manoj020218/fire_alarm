// ============================================================
// FireGuard — 4G modem state machine (A7672S / TinyGSM SIM7600)
// Serial1: RX=27 TX=26  PWR_KEY=4
//
// NON-BLOCKING DESIGN
// -------------------
// modem4g_step() is called from uplink_loop() each tick (every
// UPLINK_CHECK_INTERVAL_MS or sooner via uplink_init).  Each call
// does ONE piece of work and returns immediately.  The only call
// that may block is gprsConnect() which is a single TinyGSM
// library call; it is bracketed with esp_task_wdt_reset() so the
// watchdog is fed before and after, keeping worst-case hold < 15s
// (well under the 30s watchdog).
// ============================================================
#define TINY_GSM_MODEM_SIM7600
#include <TinyGsmClient.h>
#include "modem4g.h"
#include "../config/pins.h"
#include "../util/log.h"
#include <esp_task_wdt.h>

static TinyGsm       s_modem(Serial1);
static TinyGsmClient s_client(s_modem);

static Modem4gState  s_state        = Modem4gState::OFF;
static uint32_t      s_stateTs      = 0;   // millis() when we entered current state
static uint32_t      s_netDeadline  = 0;   // absolute deadline for network registration
static bool          s_keyReleased  = false; // tracks PWR_KEY release within POWERING state

// How long to wait in each state before declaring failure
#define POWERING_HOLD_MS     1200   // PWR_KEY LOW duration
#define POWERING_SETTLE_MS   3000   // post-key settle
#define WAIT_AT_TIMEOUT_MS   8000   // testAT window
#define WAIT_NETWORK_TOTAL_MS 60000 // total network registration budget
#define FAILED_RETRY_MS      30000  // back-off before next attempt

// ---- internal helpers ----------------------------------------

static void enter(Modem4gState ns) {
    s_state        = ns;
    s_stateTs      = millis();
    // Reset POWERING sub-flag whenever we leave that state
    if (ns != Modem4gState::POWERING) s_keyReleased = false;
}

static uint32_t elapsed() { return millis() - s_stateTs; }

// ---- public API ----------------------------------------------

Modem4gState modem4g_step(const char* apn) {
    switch (s_state) {

    // --------------------------------------------------------
    case Modem4gState::OFF:
        LOG_I("4G", "Initialising Serial1 RX=%d TX=%d", PIN_4G_RX, PIN_4G_TX);
        Serial1.begin(115200, SERIAL_8N1, PIN_4G_RX, PIN_4G_TX);
        // Start power-key pulse
        LOG_I("4G", "PWR_KEY pulse start (pin %d)", PIN_4G_PWR_KEY);
        pinMode(PIN_4G_PWR_KEY, OUTPUT);
        digitalWrite(PIN_4G_PWR_KEY, LOW);
        enter(Modem4gState::POWERING);
        break;

    // --------------------------------------------------------
    case Modem4gState::POWERING:
        // Phase 1: hold PWR_KEY LOW for POWERING_HOLD_MS
        if (elapsed() < POWERING_HOLD_MS) break;
        // Phase 2: release key once, then wait for modem to settle
        if (!s_keyReleased) {
            digitalWrite(PIN_4G_PWR_KEY, HIGH);
            s_keyReleased = true;
            LOG_I("4G", "PWR_KEY released — settling %d ms", POWERING_SETTLE_MS);
        }
        if (elapsed() < POWERING_HOLD_MS + POWERING_SETTLE_MS) break;
        LOG_I("4G", "Modem settling done — probing AT");
        enter(Modem4gState::WAIT_AT);
        break;

    // --------------------------------------------------------
    case Modem4gState::WAIT_AT:
        // testAT with a SHORT timeout so we don't block long
        // We poll repeatedly until our own deadline expires.
        if (s_modem.testAT(1500)) {
            s_modem.sendAT(GF("+CMEE=2"));
            s_modem.waitResponse(500);
            s_netDeadline = millis() + WAIT_NETWORK_TOTAL_MS;
            LOG_I("4G", "AT OK — waiting for network registration");
            enter(Modem4gState::WAIT_NETWORK);
        } else if (elapsed() > WAIT_AT_TIMEOUT_MS) {
            LOG_W("4G", "No AT response — scheduling retry");
            enter(Modem4gState::FAILED);
        }
        break;

    // --------------------------------------------------------
    case Modem4gState::WAIT_NETWORK:
        // Poll non-blockingly
        if (s_modem.isNetworkConnected()) {
            LOG_I("4G", "Network registered — attempting GPRS");
            enter(Modem4gState::CONNECTING_GPRS);
        } else if ((int32_t)(millis() - s_netDeadline) >= 0) {
            LOG_W("4G", "Network registration timeout");
            enter(Modem4gState::FAILED);
        }
        break;

    // --------------------------------------------------------
    case Modem4gState::CONNECTING_GPRS:
        // gprsConnect() is a blocking library call (~5-15 s typical).
        // We bracket it with WDT resets so the watchdog is satisfied.
        LOG_I("4G", "GPRS connect APN='%s'", apn);
        esp_task_wdt_reset();
        if (s_modem.gprsConnect(apn, "", "")) {
            esp_task_wdt_reset();
            LOG_I("4G", "Connected. Signal: %d dBm  Op: %s",
                  modem4g_signal_dbm(), modem4g_operator().c_str());
            enter(Modem4gState::CONNECTED);
        } else {
            esp_task_wdt_reset();
            LOG_W("4G", "GPRS connect failed");
            enter(Modem4gState::FAILED);
        }
        break;

    // --------------------------------------------------------
    case Modem4gState::CONNECTED:
        // modem4g_maintain() handles drop detection; nothing to do here
        break;

    // --------------------------------------------------------
    case Modem4gState::FAILED:
        if (elapsed() > FAILED_RETRY_MS) {
            LOG_I("4G", "Retrying modem init");
            // Reset the key-release flag for POWERING phase
            enter(Modem4gState::OFF);
        }
        break;
    }

    return s_state;
}

bool modem4g_is_connected() {
    return s_state == Modem4gState::CONNECTED;
}

void modem4g_maintain() {
    if (s_state == Modem4gState::CONNECTED && !s_modem.isGprsConnected()) {
        LOG_W("4G", "GPRS dropped — will retry");
        enter(Modem4gState::FAILED);
    }
}

int modem4g_signal_dbm() {
    if (s_state != Modem4gState::CONNECTED) return 0;
    int16_t sq = s_modem.getSignalQuality();
    if (sq == 99 || sq <= 0) return 0;
    return -113 + sq * 2;
}

String modem4g_operator() {
    if (s_state != Modem4gState::CONNECTED) return "N/A";
    return s_modem.getOperator();
}

bool modem4g_get_time(struct tm* out) {
    if (s_state != Modem4gState::CONNECTED || !out) return false;
    int y, mo, d, h, mi, s;
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
