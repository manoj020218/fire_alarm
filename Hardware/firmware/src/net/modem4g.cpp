// ============================================================
// FireGuard — 4G modem state machine (A7672S / TinyGSM A7672X driver)
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
#include "../config/config.h"
#include "../config/pins.h"
#include "../util/log.h"
#include <esp_task_wdt.h>

static TinyGsm       s_modem(Serial1);
static TinyGsmClient s_client(s_modem, 0);      // MQTT — mux 0
static TinyGsmClient s_httpClient(s_modem, 1);  // HTTP/api — mux 1 (separate socket)

static Modem4gState  s_state        = Modem4gState::OFF;
static uint32_t      s_stateTs      = 0;   // millis() when we entered current state
static uint32_t      s_netDeadline  = 0;   // absolute deadline for network registration
static bool          s_keyReleased  = false; // tracks PWR_KEY release within POWERING state

// How long to wait in each state before declaring failure
#define POWERING_HOLD_MS     1200   // PWR_KEY LOW duration
#define POWERING_SETTLE_MS   3000   // post-key settle
#define WAIT_AT_TIMEOUT_MS   8000   // testAT window
#define WAIT_NETWORK_TOTAL_MS 300000 // per-attempt network registration budget
                                     // (JIO LTE first attach can take minutes)
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
            // Network mode: LTE-only when the 'JIO / LTE-only' toggle is ON (JIO is
            // LTE/VoLTE-only and won't attach in auto mode); otherwise automatic
            // (2G/3G/4G) for Airtel/VI/BSNL. VoLTE always enabled (needed for JIO
            // SMS/calls, harmless elsewhere).
            if (getConfig().lteOnly) {
                s_modem.sendAT(GF("+CNMP=38"));   // 38 = LTE only
            } else {
                s_modem.sendAT(GF("+CNMP=2"));    // 2 = automatic (all RATs)
            }
            s_modem.waitResponse(3000);
            s_modem.sendAT(GF("+CVOLTE=1"));      // enable VoLTE (SMS/calls over IMS)
            s_modem.waitResponse(3000);
            // Set the LTE default-bearer APN (CID 1) BEFORE attach. JIO won't complete
            // LTE data registration without the APN in the default context (e.g. jionet).
            {
                const char* apnCfg = getConfig().apn;
                if (apnCfg && apnCfg[0]) {
                    String cgd = "+CGDCONT=1,\"IP\",\"";
                    cgd += apnCfg;
                    cgd += "\"";
                    s_modem.sendAT(cgd.c_str());
                    s_modem.waitResponse(2000);
                    LOG_I("4G", "Default bearer APN set: %s", apnCfg);
                }
            }
            s_netDeadline = millis() + WAIT_NETWORK_TOTAL_MS;
            LOG_I("4G", "AT OK, mode=%s +VoLTE — waiting for registration",
                  getConfig().lteOnly ? "LTE-only" : "auto");
            enter(Modem4gState::WAIT_NETWORK);
        } else if (elapsed() > WAIT_AT_TIMEOUT_MS) {
            LOG_W("4G", "No AT response — scheduling retry");
            enter(Modem4gState::FAILED);
        }
        break;

    // --------------------------------------------------------
    case Modem4gState::WAIT_NETWORK:
        // Poll registration via CREG/CEREG (CS or LTE/EPS), NOT isNetworkConnected()
        // (which checks packet/GPRS registration and stays false on JIO LTE-only).
        if (modem4g_is_registered()) {
            LOG_I("4G", "Network registered — attempting data attach");
            enter(Modem4gState::CONNECTING_GPRS);
        } else if ((int32_t)(millis() - s_netDeadline) >= 0) {
            // Do NOT power-cycle mid-search (audit S7). Re-issue RAT/APN config and
            // extend the search instead of dropping the modem.
            LOG_W("4G", "Registration still pending — re-issuing config (no power-cycle)");
            enter(Modem4gState::WAIT_AT);
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

const char* modem4g_state_str() {
    switch (s_state) {
        case Modem4gState::OFF:             return "off";
        case Modem4gState::POWERING:        return "powering";
        case Modem4gState::WAIT_AT:         return "wait_at";
        case Modem4gState::WAIT_NETWORK:    return "wait_net";
        case Modem4gState::CONNECTING_GPRS: return "connecting";
        case Modem4gState::CONNECTED:       return "connected";
        case Modem4gState::FAILED:          return "failed";
    }
    return "?";
}

void modem4g_maintain() {
    if (s_state == Modem4gState::CONNECTED && !s_modem.isGprsConnected()) {
        LOG_W("4G", "GPRS dropped — will retry");
        enter(Modem4gState::FAILED);
    }
}

// True once the modem is powered and AT-responsive (past power-up / AT probe),
// so signal / operator / registration can be read even before a data (PDP)
// connection exists. (S4 — don't hide status behind CONNECTED.)
static bool modem_at_ready() {
    return s_state == Modem4gState::WAIT_NETWORK ||
           s_state == Modem4gState::CONNECTING_GPRS ||
           s_state == Modem4gState::CONNECTED;
}

int modem4g_signal_dbm() {
    if (!modem_at_ready()) return 0;
    int16_t sq = s_modem.getSignalQuality();
    if (sq == 99 || sq <= 0) return 0;
    return -113 + sq * 2;
}

String modem4g_operator() {
    if (!modem_at_ready()) return "N/A";
    String op = s_modem.getOperator();
    return op.length() ? op : "N/A";
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

// ---- SMS (Change 3) -----------------------------------------

bool modem4g_is_registered() {
    // Network registration is independent of GPRS data.
    // Any state at or past WAIT_NETWORK means the modem is at least polling.
    // We check directly: isNetworkConnected() is fast (sends AT+CREG? or similar).
    if (s_state == Modem4gState::OFF ||
        s_state == Modem4gState::POWERING ||
        s_state == Modem4gState::WAIT_AT ||
        s_state == Modem4gState::FAILED) {
        return false;
    }
    // Query the modem's actual network registration (CS + EPS/LTE), NOT the data
    // (GPRS) session — the gateway may use WiFi/LAN for data while the SIM is still
    // registered for SMS/voice. Registered = home(1) or roaming(5) on either CREG/CEREG.
    const char* regCmds[2] = { "+CREG?", "+CEREG?" };
    for (int i = 0; i < 2; i++) {
        String r;
        esp_task_wdt_reset();
        s_modem.sendAT(regCmds[i]);
        if (s_modem.waitResponse(1500, r) == 1) {
            int comma = r.indexOf(',');       // +CREG: <n>,<stat>[,...]
            if (comma > 0) {
                int st = r.substring(comma + 1).toInt();
                if (st == 1 || st == 5) return true;
            }
        }
    }
    return false;
}

// Place a short voice call (missed-call alert): dial, ring ~12 s, hang up.
// Returns true if the call was initiated (modem accepted ATD).
bool modem4g_call(const char* number) {
    if (!number || !number[0]) return false;
    esp_task_wdt_reset();
    String cmd = "ATD";
    cmd += number;
    cmd += ";";                       // ';' = voice call
    s_modem.sendAT(cmd.c_str());
    int r = s_modem.waitResponse(10000L);   // OK once the call is placed
    if (r == 1) {
        for (int i = 0; i < 12; i++) { delay(1000); esp_task_wdt_reset(); }  // let it ring
    }
    s_modem.sendAT(GF("+CHUP"));       // hang up
    s_modem.waitResponse(3000);
    esp_task_wdt_reset();
    return r == 1;
}

bool modem4g_send_sms(const char* number, const char* text) {
    if (!number || !text || !number[0] || !text[0]) return false;
    if (!modem4g_is_registered()) {
        LOG_W("4G", "SMS skipped — modem not registered");
        return false;
    }
    LOG_I("4G", "Sending SMS to %s", number);
    esp_task_wdt_reset();
    bool ok = s_modem.sendSMS(number, text);
    esp_task_wdt_reset();
    if (ok) {
        LOG_I("4G", "SMS sent OK");
    } else {
        LOG_W("4G", "SMS send failed");
    }
    return ok;
}

// ── SIM / cellular info ───────────────────────────────────────────────────────
// NOTE: raw-AT parsers (CNUM/CUSD/CMGL) can vary by modem firmware — verify on
// the actual A7672 and tweak the substring parsing if a field comes back empty.

String modem4g_iccid() {
    esp_task_wdt_reset();
    String v = s_modem.getSimCCID();
    esp_task_wdt_reset();
    return v;
}

String modem4g_imsi() {
    esp_task_wdt_reset();
    String v = s_modem.getIMSI();
    esp_task_wdt_reset();
    return v;
}

int modem4g_signal_csq() {
    return s_modem.getSignalQuality();
}

String modem4g_own_number() {
    String res;
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CNUM"));
    if (s_modem.waitResponse(3000, res) != 1) return "";
    esp_task_wdt_reset();
    // +CNUM: "name","+9198XXXXXXXX",129
    int p = res.indexOf("+CNUM:");
    if (p < 0) return "";
    int c = res.indexOf(',', p);                  // after the name field
    int q1 = res.indexOf('"', c);
    int q2 = res.indexOf('"', q1 + 1);
    if (q1 < 0 || q2 < 0) return "";
    return res.substring(q1 + 1, q2);
}

String modem4g_ussd(const char* code) {
    if (!code || !code[0]) return "";
    String res;
    esp_task_wdt_reset();
    String at = "+CUSD=1,\"";
    at += code;
    at += "\",15";
    s_modem.sendAT(at.c_str());
    // USSD reply arrives as an unsolicited +CUSD: line — wait for it.
    s_modem.waitResponse(15000, res, GF("+CUSD:"));
    esp_task_wdt_reset();
    // +CUSD: 0,"Your balance is Rs 50 ...",15  → extract the quoted text
    int q1 = res.indexOf('"');
    int q2 = res.lastIndexOf('"');
    if (q1 >= 0 && q2 > q1) return res.substring(q1 + 1, q2);
    return res;
}

String modem4g_read_sms_raw() {
    String res;
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CMGF=1"));                 // text mode
    s_modem.waitResponse(1000);
    s_modem.sendAT(GF("+CMGL=\"ALL\""));
    s_modem.waitResponse(8000, res);
    esp_task_wdt_reset();
    return res;
}

String modem4g_send_sms_diag(const char* number, const char* text) {
    if (!number || !number[0]) return "no number";
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CMGF=1"));                  // text mode
    s_modem.waitResponse(1000);
    s_modem.sendAT(GF("+CSMP=17,167,0,0"));         // standard SMS params
    s_modem.waitResponse(1000);
    String cmd = "+CMGS=\"";
    cmd += number;
    cmd += "\"";
    s_modem.sendAT(cmd.c_str());
    if (s_modem.waitResponse(5000, GF(">")) != 1) {
        return "no > prompt (SMS not ready)";
    }
    s_modem.stream.print(text);
    s_modem.stream.write((char)0x1A);              // Ctrl-Z sends the message
    s_modem.stream.flush();
    String resp;
    int r = s_modem.waitResponse(60000L, resp);
    esp_task_wdt_reset();
    if (r == 1) return "";                          // OK / +CMGS ref = success
    int p = resp.indexOf("+CMS ERROR");
    if (p >= 0) {
        int end = resp.indexOf('\r', p);
        return resp.substring(p, end < 0 ? resp.length() : end);
    }
    return "send failed (no CMS code)";
}

Client* modem4g_get_client()      { return &s_client; }
Client* modem4g_get_http_client() { return &s_httpClient; }
