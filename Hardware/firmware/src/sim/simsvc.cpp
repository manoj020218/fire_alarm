// ============================================================
// FireGuard — SIM/cellular on-demand service implementation.
// ============================================================
#include "simsvc.h"
#include <ArduinoJson.h>
#include "../net/modem4g.h"
#include "../call/callsvc.h"
#include "../mqttc/topics.h"
#include "../mqttc/mqtt.h"
#include "../util/log.h"

// Pending request state (single-slot; a new request overwrites an unhandled one).
static bool  s_pending = false;
static char  s_cmd[16]    = {0};
static char  s_code[24]   = {0};
static char  s_number[24] = {0};

void simsvc_request(const char* command, const char* code, const char* number) {
    if (!command) return;
    strlcpy(s_cmd,    command,        sizeof(s_cmd));
    strlcpy(s_code,   code   ? code   : "", sizeof(s_code));
    strlcpy(s_number, number ? number : "", sizeof(s_number));
    s_pending = true;
    LOG_I("SIM", "queued command: %s", s_cmd);
}

static void publishSim(JsonDocument& doc) {
    String t = topic_sim();
    mqtt_publish_json(t.c_str(), doc, false);
}

static void doSimInfo() {
    DynamicJsonDocument doc(1024);
    doc["type"]     = "sim_info";
    doc["iccid"]    = modem4g_iccid();
    doc["imsi"]     = modem4g_imsi();
    String num = modem4g_own_number();
    if (num.length()) doc["number"] = num;
    doc["operator"] = modem4g_operator();
    int csq = modem4g_signal_csq();
    doc["signal"]     = csq;
    bool reg = modem4g_is_registered();
    doc["registered"] = reg;
    doc["canSend"]    = reg && csq > 0 && csq != 99;
    doc["ok"]         = true;
    publishSim(doc);
}

static void doUssd() {
    DynamicJsonDocument doc(1024);
    doc["type"] = "ussd";
    if (!s_code[0]) { doc["ok"] = false; doc["error"] = "no USSD code"; publishSim(doc); return; }
    String r = modem4g_ussd(s_code);
    doc["balanceText"] = r;
    doc["ok"] = r.length() > 0;
    publishSim(doc);
}

static void doTestSms() {
    DynamicJsonDocument doc(512);
    doc["type"] = "test_sms";
    if (!s_number[0]) { doc["ok"] = false; doc["error"] = "no number"; publishSim(doc); return; }
    String err = modem4g_send_sms_diag(s_number, "FireGuard: SIM test SMS. If you received this, SMS alerts are working.");
    bool ok = (err.length() == 0);
    doc["ok"]      = ok;
    doc["canSend"] = ok;
    if (!ok) doc["error"] = err;   // exact +CMS ERROR code from the modem
    publishSim(doc);
}

static void doTestCall() {
    DynamicJsonDocument doc(512);
    doc["type"] = "test_call";
    if (!s_number[0]) { doc["ok"] = false; doc["error"] = "no number"; publishSim(doc); return; }
    if (callsvc_is_running()) {
        doc["ok"] = false;
        doc["error"] = "automatic alarm call cycle active - ack/disarm the incident before manual test";
        publishSim(doc);
        return;
    }
    bool ok = modem4g_call(s_number);
    doc["ok"] = ok;
    if (!ok) {
        const char* err = modem4g_call_last_error();
        doc["error"] = (err && err[0]) ? err : "call failed";
    }
    publishSim(doc);
}

static void doReadSms() {
    String raw = modem4g_read_sms_raw();
    DynamicJsonDocument doc(1024);
    doc["type"] = "sms_list";
    JsonArray arr = doc.createNestedArray("messages");

    int idx = 0;
    while (arr.size() < 3) {
        int h = raw.indexOf("+CMGL:", idx);
        if (h < 0) break;
        int lineEnd = raw.indexOf('\n', h);
        if (lineEnd < 0) break;
        String header = raw.substring(h, lineEnd);
        // +CMGL: i,"stat","sender",... → sender is the 3rd quoted field
        String sender;
        int q1 = header.indexOf('"');
        int q2 = header.indexOf('"', q1 + 1);
        int q3 = header.indexOf('"', q2 + 1);
        int q4 = header.indexOf('"', q3 + 1);
        if (q3 >= 0 && q4 > q3) sender = header.substring(q3 + 1, q4);

        int bodyStart = lineEnd + 1;
        int next = raw.indexOf("+CMGL:", bodyStart);
        int bodyEnd = (next < 0) ? raw.indexOf("\r\nOK", bodyStart) : next;
        if (bodyEnd < 0) bodyEnd = raw.length();
        String body = raw.substring(bodyStart, bodyEnd);
        body.trim();
        if (body.length()) {
            JsonObject m = arr.createNestedObject();
            if (sender.length()) m["from"] = sender;
            m["text"] = body.substring(0, 60);
        }
        idx = (next < 0) ? raw.length() : next;
    }
    doc["truncated"] = (arr.size() >= 3);
    doc["ok"] = true;
    publishSim(doc);
}

void simsvc_step() {
    if (!s_pending) return;
    s_pending = false;

    if      (strcmp(s_cmd, "sim_info")  == 0) doSimInfo();
    else if (strcmp(s_cmd, "ussd")      == 0) doUssd();
    else if (strcmp(s_cmd, "read_sms")  == 0) doReadSms();
    else if (strcmp(s_cmd, "test_sms")  == 0) doTestSms();
    else if (strcmp(s_cmd, "test_call") == 0) doTestCall();
}
