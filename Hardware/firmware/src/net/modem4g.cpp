// ============================================================
// FireGuard 4G modem state machine (A7672S / TinyGSM A7672X)
// Serial1: RX=27 TX=26  PWR_KEY=4
// ============================================================
#include <TinyGsmClient.h>
#include "modem4g.h"
#include "../config/config.h"
#include "../config/pins.h"
#include "../util/log.h"
#include <esp_task_wdt.h>
#include <cstring>

#define MODEM_MQTT_CONNECT_TIMEOUT_S 12
#define MODEM_HTTP_CONNECT_TIMEOUT_S 10

static bool data_service_is_open();
static bool open_data_service();

static int wait_for_cipopen_result(TinyGsm& modem, uint8_t mux, uint32_t timeoutMs) {
    String data;
    data.reserve(96);

    const String okRsp    = String(AT_NL "+CIPOPEN: ") + mux + ",0" + AT_NL;
    const String failRsp1 = String(AT_NL "+CIPOPEN: ") + mux + ",1" + AT_NL;
    const String failRsp4 = String(AT_NL "+CIPOPEN: ") + mux + ",4" + AT_NL;

    uint32_t start = millis();
    do {
        TINY_GSM_YIELD();
        while (modem.stream.available() > 0) {
            TINY_GSM_YIELD();
            int a = modem.stream.read();
            if (a <= 0) continue;
            data += static_cast<char>(a);

            if (data.endsWith(okRsp)) return 1;
            if (data.endsWith(failRsp1)) return 2;
            if (data.endsWith(failRsp4)) return 3;
            if (data.endsWith("ERROR" AT_NL)) return 4;
            if (data.endsWith("CLOSE OK" AT_NL)) return 5;
            if (modem.handleURCs(data)) data = "";
        }
    } while (millis() - start < timeoutMs);

    return 0;
}

class BoundedTinyGsmClient : public TinyGsmClient {
public:
    BoundedTinyGsmClient(TinyGsm& modem, uint8_t mux, int timeoutS)
        : TinyGsmClient(modem, mux), m_timeoutS(timeoutS) {}

    int connect(const char* host, uint16_t port, int timeout_s) override {
        stop();
        TINY_GSM_YIELD();
        rx.clear();
        sock_available = 0;
        got_data = false;
        at->streamClear();

        // A7672X must be in manual receive mode or PubSubClient never sees
        // the broker CONNACK through the CIPRXGET-based read path.
        at->sendAT(GF("+CIPRXGET=1"));
        if (at->waitResponse(2000L) != 1) {
            sock_connected = false;
            return false;
        }

        if (!data_service_is_open() && !open_data_service()) {
            sock_connected = false;
            return false;
        }

        at->sendAT(GF("+CIPOPEN="), mux, GF(",\"TCP\",\""), host, GF("\","), port);
        sock_connected =
            (wait_for_cipopen_result(*at, mux, static_cast<uint32_t>(timeout_s) * 1000UL) == 1);
        return sock_connected;
    }

    int connect(const char* host, uint16_t port) override {
        return connect(host, port, m_timeoutS);
    }

    int connect(IPAddress ip, uint16_t port) override {
        String host = TinyGsmClient::TinyGsmStringFromIp(ip);
        return connect(host.c_str(), port, m_timeoutS);
    }

private:
    int m_timeoutS;
};

static TinyGsm       s_modem(Serial1);
static BoundedTinyGsmClient s_client(s_modem, 0, MODEM_MQTT_CONNECT_TIMEOUT_S);      // MQTT - mux 0
static BoundedTinyGsmClient s_httpClient(s_modem, 1, MODEM_HTTP_CONNECT_TIMEOUT_S);  // HTTP/API - mux 1

static Modem4gState s_state = Modem4gState::OFF;
static uint32_t s_stateTs = 0;
static uint32_t s_netDeadline = 0;
static bool s_keyReleased = false;
static bool s_keyPulseActive = false;
static bool s_forcePowerOn = false;
static bool s_powerDownIssued = false;
static bool s_runtimeLteOnly = false;
static const char* s_failReason = "";
static uint32_t s_gprsRetryTs = 0;
static uint8_t s_regRecoveryStage = 0;
static uint8_t s_dataRecoveryStage = 0;
static char s_effectiveApn[32] = {0};
static uint32_t s_lastBrokerRecoveryMs = 0;
static char s_lastCallError[96] = {0};

#define POWERING_HOLD_MS       1200
#define POWERING_SETTLE_MS     3000
#define POWERING_DOWN_WAIT_MS 12000
#define WAIT_AT_TIMEOUT_MS     8000
#define WAIT_SIM_READY_MS     20000
#define WAIT_NETWORK_TOTAL_MS 300000
#define FAILED_RETRY_MS       30000

static uint32_t elapsed() {
    return millis() - s_stateTs;
}

static void set_call_error_text(const char* text) {
    snprintf(s_lastCallError, sizeof(s_lastCallError), "%s", text ? text : "");
}

static bool modem_at_ready() {
    return s_state == Modem4gState::WAIT_NETWORK ||
           s_state == Modem4gState::CONNECTING_GPRS ||
           s_state == Modem4gState::CONNECTED;
}

static void enter(Modem4gState ns) {
    s_state = ns;
    s_stateTs = millis();

    if (ns != Modem4gState::POWERING && ns != Modem4gState::POWERING_DOWN) {
        s_keyReleased = false;
        s_keyPulseActive = false;
        s_powerDownIssued = false;
    }
    if (ns == Modem4gState::CONNECTING_GPRS) {
        s_gprsRetryTs = 0;
    }
    if (ns == Modem4gState::WAIT_NETWORK) {
        s_netDeadline = millis() + WAIT_NETWORK_TOTAL_MS;
    }
    if (ns == Modem4gState::CONNECTED) {
        s_regRecoveryStage = 0;
        s_dataRecoveryStage = 0;
        s_lastBrokerRecoveryMs = 0;
    }
    if (ns == Modem4gState::OFF) {
        s_regRecoveryStage = 0;
        s_dataRecoveryStage = 0;
        s_effectiveApn[0] = 0;
        s_runtimeLteOnly = false;
        s_lastBrokerRecoveryMs = 0;
    }
}

static void start_pwr_key_pulse() {
    pinMode(PIN_4G_PWR_KEY, OUTPUT);
    digitalWrite(PIN_4G_PWR_KEY, LOW);
    s_keyPulseActive = true;
    s_keyReleased = false;
}

static bool apn_is_jio(const char* apn) {
    return apn && apn[0] && strcmp(apn, "jionet") == 0;
}

static bool wants_lte_only(const char* requestedApn) {
    return getConfig().lteOnly ||
           s_runtimeLteOnly ||
           apn_is_jio(requestedApn) ||
           apn_is_jio(s_effectiveApn);
}

static void set_effective_apn(const char* apn) {
    if (!apn) {
        s_effectiveApn[0] = 0;
        return;
    }
    snprintf(s_effectiveApn, sizeof(s_effectiveApn), "%s", apn);
}

static const char* apn_from_operator(String op) {
    op.trim();
    op.toUpperCase();
    if (op.indexOf("JIO") >= 0) return "jionet";
    if (op.indexOf("AIRTEL") >= 0) return "airtelgprs.com";
    if (op.indexOf("VODAFONE") >= 0 || op.indexOf("IDEA") >= 0 ||
        op.startsWith("VI") || op.indexOf(" VI") >= 0) {
        return "www";
    }
    if (op.indexOf("BSNL") >= 0 || op.indexOf("CELLONE") >= 0) return "bsnlnet";
    return "";
}

static const char* resolve_apn(const char* requestedApn, bool allowOperatorQuery) {
    if (requestedApn && requestedApn[0]) {
        set_effective_apn(requestedApn);
        return s_effectiveApn;
    }
    if (s_effectiveApn[0]) return s_effectiveApn;
    if (!allowOperatorQuery || !modem_at_ready()) return "";

    String op = s_modem.getOperator();
    const char* derived = apn_from_operator(op);
    if (derived[0]) {
        set_effective_apn(derived);
        LOG_I("4G", "Auto APN %s for operator %s", s_effectiveApn, op.c_str());
        return s_effectiveApn;
    }
    return "";
}

static bool apply_default_bearer_apn(const char* apn) {
    if (!apn || !apn[0]) return false;
    String cgd = "+CGDCONT=1,\"IP\",\"";
    cgd += apn;
    cgd += "\"";
    s_modem.sendAT(cgd.c_str());
    int ok = s_modem.waitResponse(5000L);
    if (ok == 1) {
        LOG_I("4G", "Default bearer APN set: %s", apn);
        return true;
    }
    LOG_W("4G", "Failed to set default bearer APN: %s", apn);
    return false;
}

// Bounded AT waits so a single modem step can never freeze the main loop for
// long (WiFi/MQTT must keep running). Commands still take effect; we just don't
// block for the full worst-case timeout.
static void reset_data_plane() {
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+NETCLOSE"));
    s_modem.waitResponse(3000L);
    s_modem.sendAT(GF("+CGACT=0,1"));
    s_modem.waitResponse(3000L);
    s_modem.sendAT(GF("+CGATT=0"));
    s_modem.waitResponse(3000L);
    esp_task_wdt_reset();
}

static bool attach_data_plane(const char* apn) {
    if (!apn || !apn[0]) return false;

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CGDCONT=1,\"IP\",\""), apn, '"');
    if (s_modem.waitResponse(5000L) != 1) return false;

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CGACT=1,1"));
    if (s_modem.waitResponse(15000L) != 1) return false;

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CGATT=1"));
    if (s_modem.waitResponse(15000L) != 1) return false;

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CIPRXGET=1"));
    if (s_modem.waitResponse(3000L) != 1) return false;

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CGPADDR=1"));
    if (s_modem.waitResponse(10000L) != 1) return false;

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CDNSCFG=\"8.8.8.8\",\"8.8.4.4\""));
    if (s_modem.waitResponse(5000L) != 1) return false;

    // Apply the known-good SIMCOM TCP socket settings used by the mature
    // SIM7600 path. The A7672X driver does not configure these itself.
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CIPMODE=0"));
    s_modem.waitResponse(3000L);

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CIPSENDMODE=0"));
    s_modem.waitResponse(3000L);

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CIPCCFG=10,0,0,0,1,0,75000"));
    s_modem.waitResponse(5000L);

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CIPTIMEOUT=75000,15000,15000"));
    s_modem.waitResponse(5000L);

    esp_task_wdt_reset();
    return true;
}

// Open the modem's embedded TCP/IP service (NETOPEN) so TinyGsmClient sockets
// (CIPOPEN) actually work. The "isGprsConnected() shortcut" only confirms the PDP
// context (CGATT) is up — without NETOPEN every socket connect fails, which is why
// MQTT+HTTP both failed over 4G on JIO AND Airtel. Best-effort: issue it and move
// on (if already open, the modem returns a harmless error).
static bool data_service_is_open() {
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+NETOPEN?"));
    int rsp = s_modem.waitResponse(3000L, GF(AT_NL "+NETOPEN: 1"),
                                   GF(AT_NL "+NETOPEN: 0"), GF("ERROR"));
    s_modem.waitResponse(300L);
    esp_task_wdt_reset();
    if (rsp != 1) return false;

    // Mirror the working SIM7600/SIM5360 logic: socket service is only useful if
    // the modem also reports a socket-PDP address after NETOPEN is active.
    s_modem.sendAT(GF("+IPADDR"));
    int ipRsp = s_modem.waitResponse(3000L);
    esp_task_wdt_reset();
    return ipRsp == 1;
}

static bool open_data_service() {
    if (data_service_is_open()) return true;

    esp_task_wdt_reset();
    s_modem.sendAT(GF("+NETOPEN"));
    // SIMCOM returns an immediate OK, then later emits +NETOPEN: 0 when the
    // socket service is actually ready. Ignore the immediate OK and wait for
    // the URC, otherwise NETOPEN? is polled too early and we false-fail.
    int rsp = s_modem.waitResponse(25000L, GF(AT_NL "+NETOPEN: 0"), GF("ERROR"));
    esp_task_wdt_reset();
    if (rsp == 1 && data_service_is_open()) return true;

    // Some firmware revisions report success late or return a generic error when
    // the service is already up. Final state verification is what matters.
    return data_service_is_open();
}

static bool close_data_service() {
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+NETCLOSE"));
    int rsp = s_modem.waitResponse(15000L, GF(AT_NL "+NETCLOSE: 0"), GF("ERROR"));
    esp_task_wdt_reset();
    if (rsp == 1) return true;
    return !data_service_is_open();
}

static void ensure_data_service_legacy() {
    esp_task_wdt_reset();
    String r;
    s_modem.sendAT(GF("+NETOPEN?"));
    s_modem.waitResponse(3000, r);
    if (r.indexOf("+NETOPEN: 1") < 0) {      // not already open → open it
        s_modem.sendAT(GF("+NETOPEN"));
        s_modem.waitResponse(12000L);        // wait for OK/URC; tolerate any result
        LOG_I("4G", "NETOPEN issued (TCP/IP service)");
    }
    esp_task_wdt_reset();
}

static bool ensure_data_service() {
    if (data_service_is_open()) return true;

    LOG_I("4G", "Opening TCP/IP service (NETOPEN)");
    if (open_data_service()) return true;

    LOG_W("4G", "NETOPEN did not verify - restarting TCP/IP service");
    close_data_service();
    if (open_data_service()) return true;

    LOG_W("4G", "NETOPEN still not verified");
    return false;
}

static void auto_select_operator() {
    esp_task_wdt_reset();
    // COPS=0 returns OK quickly and the network scan continues in the background
    // (we poll CEREG separately), so a short wait is enough — don't block 30s.
    s_modem.sendAT(GF("+COPS=0"));
    s_modem.waitResponse(3000L);
    esp_task_wdt_reset();
}

static void request_cold_restart(const char* reason) {
    s_failReason = reason;
    s_forcePowerOn = true;
    LOG_W("4G", "Scheduling cold modem restart (%s)", reason);
    enter(Modem4gState::POWERING_DOWN);
}

static void recover_registration(const char* requestedApn) {
    const bool jioHint = apn_is_jio(requestedApn) || apn_is_jio(s_effectiveApn);
    if (jioHint && !getConfig().lteOnly && !s_runtimeLteOnly) {
        s_runtimeLteOnly = true;
        s_regRecoveryStage = 1;
        LOG_W("4G", "Registration timeout - retrying in LTE-only mode");
        enter(Modem4gState::WAIT_AT);
        return;
    }
    if (s_regRecoveryStage < 2) {
        s_regRecoveryStage = 2;
        LOG_W("4G", "Registration timeout - forcing operator auto-select");
        auto_select_operator();
        enter(Modem4gState::WAIT_AT);
        return;
    }
    request_cold_restart("reg_restart");
}

static void recover_data_attach() {
    if (s_dataRecoveryStage == 0) {
        s_dataRecoveryStage = 1;
        LOG_W("4G", "Data path recovery stage 1 - restarting TCP/IP service");
        close_data_service();
        enter(Modem4gState::CONNECTING_GPRS);
        return;
    }
    if (s_dataRecoveryStage == 1) {
        s_dataRecoveryStage = 2;
        LOG_W("4G", "Data path recovery stage 2 - resetting PDP session");
        reset_data_plane();
        enter(Modem4gState::WAIT_NETWORK);
        return;
    }
    if (s_dataRecoveryStage == 2) {
        s_dataRecoveryStage = 3;
        LOG_W("4G", "Data path recovery stage 3 - resetting PDP and reselecting operator");
        reset_data_plane();
        auto_select_operator();
        enter(Modem4gState::WAIT_AT);
        return;
    }
    request_cold_restart("gprs_restart");
}

Modem4gState modem4g_step(const char* apn) {
    switch (s_state) {
        case Modem4gState::OFF:
            LOG_I("4G", "Initialising Serial1 RX=%d TX=%d", PIN_4G_RX, PIN_4G_TX);
            Serial1.begin(115200, SERIAL_8N1, PIN_4G_RX, PIN_4G_TX);
            if (!s_forcePowerOn && s_modem.testAT(300)) {
                LOG_I("4G", "Modem already awake - skipping power pulse");
                enter(Modem4gState::WAIT_AT);
                break;
            }
            LOG_I("4G", "PWR_KEY pulse start (pin %d)", PIN_4G_PWR_KEY);
            s_forcePowerOn = false;
            start_pwr_key_pulse();
            enter(Modem4gState::POWERING);
            break;

        case Modem4gState::POWERING:
            if (elapsed() < POWERING_HOLD_MS) break;
            if (s_keyPulseActive && !s_keyReleased) {
                digitalWrite(PIN_4G_PWR_KEY, HIGH);
                s_keyReleased = true;
                LOG_I("4G", "PWR_KEY released - settling %d ms", POWERING_SETTLE_MS);
            }
            if (elapsed() < POWERING_HOLD_MS + POWERING_SETTLE_MS) break;
            LOG_I("4G", "Modem settling done - probing AT");
            enter(Modem4gState::WAIT_AT);
            break;

        case Modem4gState::POWERING_DOWN:
            if (!s_powerDownIssued) {
                s_powerDownIssued = true;
                if (s_modem.testAT(300)) {
                    LOG_W("4G", "Requesting clean modem power-off");
                    esp_task_wdt_reset();
                    if (!s_modem.poweroff()) {
                        LOG_W("4G", "AT+CPOF failed - falling back to PWR_KEY");
                        start_pwr_key_pulse();
                    }
                    esp_task_wdt_reset();
                } else {
                    LOG_W("4G", "Modem not AT-responsive - using PWR_KEY restart");
                    start_pwr_key_pulse();
                }
            }
            if (s_keyPulseActive && !s_keyReleased && elapsed() >= POWERING_HOLD_MS) {
                digitalWrite(PIN_4G_PWR_KEY, HIGH);
                s_keyReleased = true;
            }
            if (elapsed() >= 2000 && !s_modem.testAT(300)) {
                LOG_I("4G", "Modem power-off complete");
                enter(Modem4gState::OFF);
                break;
            }
            if (elapsed() > POWERING_DOWN_WAIT_MS) {
                LOG_W("4G", "Modem power-off timeout - forcing cold start");
                enter(Modem4gState::OFF);
            }
            break;

        case Modem4gState::WAIT_AT:
            if (s_modem.testAT(1500)) {
                SimStatus sim = s_modem.getSimStatus(1500);
                if (sim == SIM_LOCKED) {
                    LOG_W("4G", "SIM is PIN-locked");
                    s_failReason = "sim_pin";
                    enter(Modem4gState::FAILED);
                    break;
                }
                if (sim != SIM_READY) {
                    if (elapsed() > WAIT_SIM_READY_MS) {
                        LOG_W("4G", "SIM not ready after AT came up");
                        s_failReason = "sim_ready";
                        enter(Modem4gState::FAILED);
                    }
                    break;
                }

                s_modem.sendAT(GF("+CMEE=2"));
                s_modem.waitResponse(500);
                if (wants_lte_only(apn)) {
                    s_modem.sendAT(GF("+CNMP=38"));
                } else {
                    s_modem.sendAT(GF("+CNMP=2"));
                }
                s_modem.waitResponse(3000);
                s_modem.sendAT(GF("+CVOLTE=1"));
                s_modem.waitResponse(3000);

                const char* selectedApn = resolve_apn(apn, false);
                if (selectedApn[0]) apply_default_bearer_apn(selectedApn);

                LOG_I("4G", "AT OK, mode=%s - waiting for registration",
                      wants_lte_only(apn) ? "LTE-only" : "auto");
                enter(Modem4gState::WAIT_NETWORK);
            } else if (elapsed() > WAIT_AT_TIMEOUT_MS) {
                LOG_W("4G", "No AT response - scheduling retry");
                s_failReason = "no_at";
                enter(Modem4gState::FAILED);
            }
            break;

        case Modem4gState::WAIT_NETWORK:
            if (modem4g_is_registered()) {
                const char* selectedApn = resolve_apn(apn, true);
                if (!selectedApn[0]) {
                    LOG_W("4G", "Network registered but APN is still unknown");
                    break;
                }
                if (!getConfig().lteOnly && !s_runtimeLteOnly && apn_is_jio(selectedApn)) {
                    s_runtimeLteOnly = true;
                    LOG_I("4G", "Detected JIO profile - reconfiguring LTE-only before PDP attach");
                    enter(Modem4gState::WAIT_AT);
                    break;
                }
                apply_default_bearer_apn(selectedApn);
                LOG_I("4G", "Network registered - attempting data attach");
                enter(Modem4gState::CONNECTING_GPRS);
            } else if ((int32_t)(millis() - s_netDeadline) >= 0) {
                recover_registration(apn);
            }
            break;

        case Modem4gState::CONNECTING_GPRS:
            esp_task_wdt_reset();
            if (s_modem.isGprsConnected()) {
                if (ensure_data_service()) {
                    LOG_I("4G", "Data active - IP %s Signal %d dBm Op %s",
                          s_modem.localIP().toString().c_str(),
                          modem4g_signal_dbm(), modem4g_operator().c_str());
                    enter(Modem4gState::CONNECTED);
                } else {
                    LOG_W("4G", "PDP attached but TCP/IP service not verified");
                    recover_data_attach();
                }
                break;
            }
            if (s_gprsRetryTs == 0 || (millis() - s_gprsRetryTs) > 5000) {
                const char* selectedApn = resolve_apn(apn, true);
                if (!selectedApn[0]) {
                    LOG_W("4G", "Skipping data attach - APN unresolved");
                    break;
                }
                s_gprsRetryTs = millis();
                LOG_I("4G", "Data attach APN='%s'", selectedApn);
                esp_task_wdt_reset();
                bool ok = attach_data_plane(selectedApn);
                esp_task_wdt_reset();
                if (ok || s_modem.isGprsConnected()) {
                    if (ensure_data_service()) {
                        LOG_I("4G", "Data connected. IP %s Signal %d dBm Op %s",
                              s_modem.localIP().toString().c_str(),
                              modem4g_signal_dbm(), modem4g_operator().c_str());
                        enter(Modem4gState::CONNECTED);
                    } else {
                        LOG_W("4G", "PDP up but TCP/IP service still not verified");
                        recover_data_attach();
                    }
                    break;
                }
                LOG_W("4G", "Data attach attempt failed - will retry");
            }
            if (elapsed() > 60000) {
                recover_data_attach();
            }
            break;

        case Modem4gState::CONNECTED:
            break;

        case Modem4gState::FAILED:
            if (elapsed() > FAILED_RETRY_MS) {
                LOG_I("4G", "Retrying modem init");
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
    static char buf[24];
    switch (s_state) {
        case Modem4gState::OFF:             return "off";
        case Modem4gState::POWERING:        return "powering";
        case Modem4gState::POWERING_DOWN:   return "powering_down";
        case Modem4gState::WAIT_AT:         return "wait_at";
        case Modem4gState::WAIT_NETWORK:    return "wait_net";
        case Modem4gState::CONNECTING_GPRS: return "connecting";
        case Modem4gState::CONNECTED:       return "connected";
        case Modem4gState::FAILED:
            snprintf(buf, sizeof(buf), "failed:%s", s_failReason[0] ? s_failReason : "?");
            return buf;
    }
    return "?";
}

void modem4g_maintain() {
    if (s_state == Modem4gState::CONNECTED && !s_modem.isGprsConnected()) {
        LOG_W("4G", "GPRS dropped - starting recovery");
        recover_data_attach();
    }
}

void modem4g_report_broker_fail(int mqttRc) {
    if (s_state != Modem4gState::CONNECTED) return;
    if (mqttRc != -2 && mqttRc != -4) return;
    if (s_lastBrokerRecoveryMs != 0 &&
        (millis() - s_lastBrokerRecoveryMs) < 20000UL) return;
    s_lastBrokerRecoveryMs = millis();
    LOG_W("4G", "Broker connect failed rc=%d - starting data-path recovery", mqttRc);
    recover_data_attach();
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

String modem4g_ip() {
    if (s_state != Modem4gState::CONNECTED) return "";
    IPAddress ip = s_modem.localIP();
    return ip.toString();
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

bool modem4g_is_registered() {
    if (s_state == Modem4gState::OFF ||
        s_state == Modem4gState::POWERING ||
        s_state == Modem4gState::POWERING_DOWN ||
        s_state == Modem4gState::WAIT_AT ||
        s_state == Modem4gState::FAILED) {
        return false;
    }

    const char* regCmds[2] = { "+CREG?", "+CEREG?" };
    for (int i = 0; i < 2; i++) {
        String r;
        esp_task_wdt_reset();
        s_modem.sendAT(regCmds[i]);
        if (s_modem.waitResponse(1500, r) == 1) {
            int comma = r.indexOf(',');
            if (comma > 0) {
                int st = r.substring(comma + 1).toInt();
                if (st == 1 || st == 5) return true;
            }
        }
    }
    return false;
}

bool modem4g_call(const char* number) {
    if (!modem4g_call_begin(number)) return false;
    for (int i = 0; i < 12; i++) {
        delay(1000);
        esp_task_wdt_reset();
    }
    modem4g_call_hangup();
    return true;
}

bool modem4g_call_begin(const char* number) {
    if (!number || !number[0]) return false;
    if (!modem4g_is_registered()) {
        set_call_error_text("modem not registered");
        LOG_W("4G", "Call skipped - modem not registered");
        return false;
    }
    esp_task_wdt_reset();
    String cmd = "D";
    cmd += number;
    cmd += ";";
    String resp;
    s_modem.sendAT(cmd.c_str());
    int r = s_modem.waitResponse(15000L, resp);
    esp_task_wdt_reset();
    if (r == 1) {
        set_call_error_text("");
        LOG_I("4G", "Call started to %s", number);
        return true;
    }

    resp.replace("\r", " ");
    resp.replace("\n", " ");
    while (resp.indexOf("  ") >= 0) resp.replace("  ", " ");
    resp.trim();

    if (resp.length() == 0) {
        snprintf(s_lastCallError, sizeof(s_lastCallError),
                 "ATD failed (waitResponse=%d, no modem text)", r);
    } else {
        snprintf(s_lastCallError, sizeof(s_lastCallError), "%s", resp.c_str());
    }

    LOG_W("4G", "Call start failed for %s: %s", number, s_lastCallError);
    return false;
}

void modem4g_call_hangup() {
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CHUP"));
    s_modem.waitResponse(3000L);
    esp_task_wdt_reset();
}

const char* modem4g_call_last_error() {
    return s_lastCallError;
}

bool modem4g_send_sms(const char* number, const char* text) {
    if (!number || !text || !number[0] || !text[0]) return false;
    if (!modem4g_is_registered()) {
        LOG_W("4G", "SMS skipped - modem not registered");
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

String modem4g_iccid() {
    if (!modem_at_ready()) return "";
    esp_task_wdt_reset();
    String v = s_modem.getSimCCID();
    esp_task_wdt_reset();
    return v;
}

String modem4g_imsi() {
    if (!modem_at_ready()) return "";
    esp_task_wdt_reset();
    String v = s_modem.getIMSI();
    esp_task_wdt_reset();
    return v;
}

String modem4g_imei() {
    if (!modem_at_ready()) return "";
    esp_task_wdt_reset();
    String v = s_modem.getIMEI();
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
    int p = res.indexOf("+CNUM:");
    if (p < 0) return "";
    int c = res.indexOf(',', p);
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
    s_modem.waitResponse(15000, res, GF("+CUSD:"));
    esp_task_wdt_reset();
    int q1 = res.indexOf('"');
    int q2 = res.lastIndexOf('"');
    if (q1 >= 0 && q2 > q1) return res.substring(q1 + 1, q2);
    return res;
}

String modem4g_read_sms_raw() {
    String res;
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CMGF=1"));
    s_modem.waitResponse(1000);
    s_modem.sendAT(GF("+CMGL=\"ALL\""));
    s_modem.waitResponse(8000, res);
    esp_task_wdt_reset();
    return res;
}

String modem4g_read_sms_unread_raw() {
    String res;
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CMGF=1"));
    s_modem.waitResponse(1000L);
    s_modem.sendAT(GF("+CMGL=\"REC UNREAD\""));
    s_modem.waitResponse(8000L, res);
    esp_task_wdt_reset();
    return res;
}

bool modem4g_delete_sms(int index) {
    if (index < 0) return false;
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CMGD="), index, GF(",0"));
    int r = s_modem.waitResponse(3000L);
    esp_task_wdt_reset();
    return r == 1;
}

String modem4g_send_sms_diag(const char* number, const char* text) {
    if (!number || !number[0]) return "no number";
    esp_task_wdt_reset();
    s_modem.sendAT(GF("+CMGF=1"));
    s_modem.waitResponse(1000);
    s_modem.sendAT(GF("+CSMP=17,167,0,0"));
    s_modem.waitResponse(1000);
    String cmd = "+CMGS=\"";
    cmd += number;
    cmd += "\"";
    s_modem.sendAT(cmd.c_str());
    if (s_modem.waitResponse(5000, GF(">")) != 1) {
        return "no > prompt (SMS not ready)";
    }
    s_modem.stream.print(text);
    s_modem.stream.write((char)0x1A);
    s_modem.stream.flush();
    String resp;
    int r = s_modem.waitResponse(60000L, resp);
    esp_task_wdt_reset();
    if (r == 1) return "";
    int p = resp.indexOf("+CMS ERROR");
    if (p >= 0) {
        int end = resp.indexOf('\r', p);
        return resp.substring(p, end < 0 ? resp.length() : end);
    }
    return "send failed (no CMS code)";
}

Client* modem4g_get_client()      { return &s_client; }
Client* modem4g_get_http_client() { return &s_httpClient; }
