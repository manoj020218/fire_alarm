// ============================================================
// FireGuard — WebUI server (AsyncWebServer :80)
// Registers all route handlers from sub-files.
// Auth: read-only endpoints open; mutating require X-Admin-Token.
// ============================================================
#include "server.h"
#include "page.h"
#include "handlers_config.h"
#include "handlers_modbus.h"
#include "handlers_ota.h"
#include "../ota/ota.h"
#include "../net/uplink.h"
#include "../config/config.h"
#include "../config/build_info.h"
#include "../util/health.h"
#include "../util/log.h"
#include "../alarms/engine.h"
#include "../modbus/registers.h"
#include <ESPAsyncWebServer.h>
#include <ElegantOTA.h>
#include <ArduinoJson.h>
#include <Preferences.h>

static AsyncWebServer s_server(80);

// ---- Shared admin-auth helper (also called by sub-handlers) -
bool webui_check_admin(AsyncWebServerRequest* req) {
    Preferences p;
    p.begin("fg_adm", true);
    String stored = p.getString("pass", "");
    p.end();
    if (stored.length() == 0) return true;  // no password set → open
    if (req->hasHeader("X-Admin-Token")) {
        return req->header("X-Admin-Token") == stored;
    }
    return false;
}

// ---- /api/status (open, read-only) --------------------------
static void handle_status(AsyncWebServerRequest* req) {
    StaticJsonDocument<512> doc;
    doc["fw"]       = FW_VERSION;
    doc["hw"]       = HW_REVISION;
    doc["pid"]      = PRODUCT_ID;
    doc["uptime"]   = health_uptime_s();
    doc["heap"]     = health_free_heap();
    doc["minHeap"]  = health_min_free_heap();
    doc["reset"]    = health_reset_reason();
    doc["uplink"]   = uplink_type_str();
    doc["signal4g"] = uplink_signal_4g_dbm();
    doc["signalLan"]= uplink_signal_lan();
    HealthCounters& hc = health_counters();
    doc["mqttReconns"]  = hc.mqttReconnects;
    doc["mbTimeouts"]   = hc.modbusTimeouts;
    doc["alarmsActive"] = alarms_active_count();

    char buf[512];
    serializeJson(doc, buf, sizeof(buf));
    req->send(200, "application/json", buf);
}

// ---- /api/alarms (GET open) ---------------------------------
static void handle_get_alarms(AsyncWebServerRequest* req) {
    StaticJsonDocument<640> doc;
    JsonArray arr = doc.to<JsonArray>();
    alarms_fill_json(arr);

    char buf[640];
    serializeJson(doc, buf, sizeof(buf));
    req->send(200, "application/json", buf);
}

// ---- /api/alarms/ack (POST — open, safety critical) ---------
static void handle_ack_alarm(AsyncWebServerRequest* req, uint8_t* data,
                              size_t len, size_t, size_t) {
    StaticJsonDocument<64> body;
    if (deserializeJson(body, data, len) != DeserializationError::Ok) {
        req->send(400, "application/json", "{\"error\":\"bad JSON\"}");
        return;
    }
    const char* id = body["alarmId"] | "";
    if (id[0]) {
        alarms_ack(id);
        req->send(200, "application/json", "{\"ok\":true}");
    } else {
        req->send(400, "application/json", "{\"error\":\"missing alarmId\"}");
    }
}

// ---- webui_init() -------------------------------------------
void webui_init() {
    // Root: full SPA
    s_server.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
        req->send(200, "text/html", FIREGUARD_PAGE);
    });

    // Status (public, auto-refreshed by UI)
    s_server.on("/api/status", HTTP_GET, handle_status);

    // Alarms
    s_server.on("/api/alarms", HTTP_GET, handle_get_alarms);
    s_server.on("/api/alarms/ack", HTTP_POST,
        [](AsyncWebServerRequest* req){},
        nullptr,
        handle_ack_alarm);

    // Config + factory-reset routes
    webui_register_config(&s_server);

    // Modbus scan/read/register-map routes
    webui_register_modbus(&s_server);

    // OTA REST routes
    webui_register_ota(&s_server);

    // ElegantOTA local .bin upload at /update
    ota_attach_elegant(&s_server);

    // 404 catch-all
    s_server.onNotFound([](AsyncWebServerRequest* req) {
        req->send(404, "text/plain", "Not found");
    });

    s_server.begin();
    LOG_I("WEBUI", "Server started on port 80");
}

void webui_loop() {
    ElegantOTA.loop();
    // Drive OTA validation timeout watchdog
    ota_validation_tick();
}
