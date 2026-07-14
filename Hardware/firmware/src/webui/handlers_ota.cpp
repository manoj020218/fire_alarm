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

    OtaResult r = ota_check_manifest();
    StaticJsonDocument<128> doc;
    doc["updateAvailable"] = ota_update_available();
    switch (r) {
        case OtaResult::UP_TO_DATE:
            doc["status"] = "up_to_date";
            break;
        case OtaResult::UPDATED:
            doc["status"] = "updated";
            break;
        case OtaResult::BACKUP_FAILED:
            doc["status"] = "backup_failed";
            break;
        case OtaResult::DOWNLOAD_FAILED:
            doc["status"] = "download_failed";
            break;
        default:
            doc["status"] = "unknown";
            break;
    }

    char buf[128];
    serializeJson(doc, buf, sizeof(buf));
    req->send(200, "application/json", buf);
}

static void handle_ota_update(AsyncWebServerRequest* req) {
    if (!check_admin_token_ota(req)) {
        req->send(401, "application/json", "{\"error\":\"unauthorized\"}");
        return;
    }

    // Respond first (update will reboot the device)
    req->send(200, "application/json", "{\"ok\":true,\"status\":\"starting\"}");

    // Small delay to let response flush
    delay(100);

    OtaResult r = ota_begin_update();
    // If we reach here, update did not reboot (error path)
    (void)r;  // result was published via MQTT in ota_begin_update
    LOG_W("WEBUI", "OTA update returned without reboot (error)");
}

void webui_register_ota(AsyncWebServer* srv) {
    srv->on("/api/ota/status", HTTP_GET, handle_ota_status);
    srv->on("/api/ota/check",  HTTP_POST,
        [](AsyncWebServerRequest* req){ handle_ota_check(req); });
    srv->on("/api/ota/update", HTTP_POST,
        [](AsyncWebServerRequest* req){ handle_ota_update(req); });
}
