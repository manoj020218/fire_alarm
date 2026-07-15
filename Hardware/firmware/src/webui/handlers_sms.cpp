// ============================================================
// FireGuard WebUI — SMS test endpoint (Change 3)
// POST /api/sms/test  — admin-gated; sends a test SMS to the
//                        first number in smsNumbers config field.
// ============================================================
#include "handlers_sms.h"
#include "auth.h"
#include "../config/config.h"
#include "../net/modem4g.h"
#include "../util/log.h"
#include <ArduinoJson.h>

static void deny_sms(AsyncWebServerRequest* req) {
    req->send(401, "application/json", "{\"error\":\"unauthorized\"}");
}

// Extract first comma-separated token from a string into `out` (max outLen).
static bool first_number(const char* src, char* out, size_t outLen) {
    if (!src || !src[0]) return false;
    size_t i = 0;
    while (src[i] && src[i] != ',' && i < outLen - 1) {
        out[i] = src[i];
        i++;
    }
    out[i] = '\0';
    return (i > 0);
}

// POST /api/sms/test
static void handle_sms_test(AsyncWebServerRequest* req) {
    if (!webui_check_admin(req)) { deny_sms(req); return; }

    GatewayConfig& cfg = getConfig();
    if (!cfg.smsEnabled) {
        req->send(400, "application/json", "{\"error\":\"SMS not enabled\"}");
        return;
    }

    char num[24] = {};
    if (!first_number(cfg.smsNumbers, num, sizeof(num))) {
        req->send(400, "application/json", "{\"error\":\"no SMS number configured\"}");
        return;
    }

    // Build test message
    char msg[80];
    snprintf(msg, sizeof(msg), "FireGuard %s: test SMS OK", cfg.siteId);

    bool ok = modem4g_send_sms(num, msg);
    LOG_I("WEBUI", "SMS test to %s: %s", num, ok ? "ok" : "failed");

    if (ok) {
        req->send(200, "application/json", "{\"ok\":true}");
    } else {
        req->send(200, "application/json",
                  "{\"ok\":false,\"error\":\"send failed or modem not registered\"}");
    }
}

void webui_register_sms(AsyncWebServer* srv) {
    srv->on("/api/sms/test", HTTP_POST,
        [](AsyncWebServerRequest* req) { handle_sms_test(req); });
}
