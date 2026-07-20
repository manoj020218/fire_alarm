// ============================================================
// FireGuard WebUI — OTA handlers
// GET  /api/ota/status  — current FW + pending update info
// POST /api/ota/check   — trigger manifest check
// POST /api/ota/update  — trigger full backup+apply flow
// Auth required for POST.
// ============================================================
#include "handlers_ota.h"
#include "auth.h"
#include "../ota/ota.h"
#include "../config/build_info.h"
#include "../util/log.h"
#include <ArduinoJson.h>

#define check_admin_token_ota(req) webui_check_admin(req)

static void handle_ota_status(AsyncWebServerRequest* req) {
    StaticJsonDocument<128> doc;
    doc["fw"]          = FW_VERSION;
    doc["hw"]          = HW_REVISION;
    doc["updateAvail"] = ota_update_available();

    char buf[128];
    serializeJson(doc, buf, sizeof(buf));
    req->send(200, "application/json", buf);
}

static void handle_ota_check(AsyncWebServerRequest* req) {
    if (!check_admin_token_ota(req)) {
        req->send(401, "application/json", "{\"error\":\"unauthorized\"}");
        return;
    }

    // Deferred: the actual HTTP manifest fetch runs in the main loop, NOT on this
    // async WebServer task (whose small stack + shared uplink Client crashed the
    // device). The result appears on the OTA MQTT topic and in /api/ota/status.
    ota_request_check();
    req->send(200, "application/json",
              "{\"ok\":true,\"status\":\"queued\",\"note\":\"check running; refresh status in a few seconds\"}");
}

static void handle_ota_update(AsyncWebServerRequest* req) {
    if (!check_admin_token_ota(req)) {
        req->send(401, "application/json", "{\"error\":\"unauthorized\"}");
        return;
    }

    // Deferred: queue a check-then-apply that runs in the main loop (backup +
    // 1 MB download + reboot). Running it here on the async task overflowed the
    // stack. Progress/result is published on the OTA MQTT topic.
    ota_request_update();
    req->send(200, "application/json",
              "{\"ok\":true,\"status\":\"queued\",\"note\":\"backup+download running; device will reboot on success\"}");
}

void webui_register_ota(AsyncWebServer* srv) {
    srv->on("/api/ota/status", HTTP_GET, handle_ota_status);
    srv->on("/api/ota/check",  HTTP_POST,
        [](AsyncWebServerRequest* req){ handle_ota_check(req); });
    srv->on("/api/ota/update", HTTP_POST,
        [](AsyncWebServerRequest* req){ handle_ota_update(req); });
}
