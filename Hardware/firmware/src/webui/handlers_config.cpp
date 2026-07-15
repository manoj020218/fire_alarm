// ============================================================
// FireGuard WebUI — Config / provisioning handlers
// POST /api/config       — save NVS, deferred reboot
// GET  /api/config       — return config (no secret echo)
// GET  /api/config/export — full JSON export
// POST /api/config/import — replace config from JSON
// POST /api/factory-reset — clear NVS, deferred reboot
// GET  /api/authinfo      — {"passwordSet": bool} for login gate
// Auth: X-Admin-Token header required for all mutating ops.
//
// FIX 2: Response is sent FIRST; esp_restart() is deferred ~1.5 s
// via a flag read in webui_loop() so the browser sees "Saved".
// ============================================================
#include "handlers_config.h"
#include "auth.h"
#include "../config/config.h"
#include "../config/build_info.h"
#include "../config/defaults.h"
#include "../net/apiclient.h"
#include "../util/log.h"
#include <ArduinoJson.h>
#include <Preferences.h>

#define check_admin_token(req) webui_check_admin(req)

// ---- Deferred reboot state ----------------------------------
static bool     s_rebootPending = false;
static uint32_t s_rebootAt      = 0;   // millis() target

void webui_config_schedule_reboot(uint32_t delayMs) {
    s_rebootPending = true;
    s_rebootAt      = millis() + delayMs;
}

void webui_config_reboot_tick() {
    if (s_rebootPending && (int32_t)(millis() - s_rebootAt) >= 0) {
        s_rebootPending = false;
        LOG_W("WEBUI", "Executing deferred reboot");
        esp_restart();
    }
}

// ---- helpers -------------------------------------------------
static void deny(AsyncWebServerRequest* req) {
    req->send(401, "application/json", "{\"error\":\"unauthorized\"}");
}

// ---- GET /api/authinfo (open — used by UI login gate) -------

static void handle_authinfo(AsyncWebServerRequest* req) {
    Preferences p;
    p.begin("fg_adm", true);
    bool pwSet = (p.getString("pass", "").length() > 0);
    p.end();
    String body = pwSet ? "{\"passwordSet\":true}" : "{\"passwordSet\":false}";
    req->send(200, "application/json", body);
}

// ---- GET /api/config ----------------------------------------

static void handle_get_config(AsyncWebServerRequest* req) {
    GatewayConfig& cfg = getConfig();
    StaticJsonDocument<768> doc;
    doc["env"]        = cfg.env;
    doc["siteId"]     = cfg.siteId;
    doc["gatewayId"]  = cfg.gatewayId;
    doc["mqttHost"]   = cfg.mqttHost;
    doc["mqttPort"]   = cfg.mqttPort;
    doc["mqttUser"]   = cfg.mqttUser;
    // mqttPass intentionally omitted
    doc["apiHost"]    = cfg.apiHost;
    doc["apn"]        = cfg.apn;
    doc["telMs"]      = cfg.telemetryIntervalMs;
    doc["statusMs"]   = cfg.statusIntervalMs;
    doc["otaMs"]      = cfg.otaCheckIntervalMs;
    doc["regCount"]   = cfg.regCount;
    doc["thrCount"]   = cfg.thresholdCount;
    doc["token"]      = api_get_token();
    // SMS config (Change 3)
    doc["smsNumbers"] = cfg.smsNumbers;
    doc["smsEnabled"] = cfg.smsEnabled;

    // WiFi STA SSID (stored separately)
    Preferences wprefs;
    wprefs.begin("fg_wifi", true);
    doc["wifiSsid"] = wprefs.getString("ssid", "").c_str();
    wprefs.end();

    char buf[768];
    serializeJson(doc, buf, sizeof(buf));
    req->send(200, "application/json", buf);
}

// ---- POST /api/config ---------------------------------------

static void handle_post_config(AsyncWebServerRequest* req, uint8_t* data,
                                size_t len, size_t, size_t) {
    if (!check_admin_token(req)) { deny(req); return; }

    StaticJsonDocument<512> doc;
    if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
        req->send(400, "application/json", "{\"error\":\"bad JSON\"}");
        return;
    }

    GatewayConfig& cfg = getConfig();
    if (doc.containsKey("env"))      strlcpy(cfg.env,      doc["env"],      sizeof(cfg.env));
    if (doc.containsKey("siteId"))   strlcpy(cfg.siteId,   doc["siteId"],   sizeof(cfg.siteId));
    if (doc.containsKey("gatewayId"))strlcpy(cfg.gatewayId,doc["gatewayId"],sizeof(cfg.gatewayId));
    if (doc.containsKey("mqttHost")) strlcpy(cfg.mqttHost, doc["mqttHost"], sizeof(cfg.mqttHost));
    if (doc.containsKey("mqttPort")) cfg.mqttPort = doc["mqttPort"].as<uint16_t>();
    if (doc.containsKey("mqttUser")) strlcpy(cfg.mqttUser, doc["mqttUser"], sizeof(cfg.mqttUser));
    // PASSWORD FIELDS: only update if the incoming string is NON-EMPTY.
    // Empty/absent = keep existing value (honours the "(unchanged)" placeholder).
    if (doc.containsKey("mqttPass")) {
        const char* v = doc["mqttPass"].as<const char*>();
        if (v && v[0] != '\0') strlcpy(cfg.mqttPass, v, sizeof(cfg.mqttPass));
    }
    if (doc.containsKey("apiHost"))  strlcpy(cfg.apiHost,  doc["apiHost"],  sizeof(cfg.apiHost));
    if (doc.containsKey("apn"))      strlcpy(cfg.apn,      doc["apn"],      sizeof(cfg.apn));
    if (doc.containsKey("telMs"))    cfg.telemetryIntervalMs = doc["telMs"].as<uint32_t>();
    if (doc.containsKey("statusMs")) cfg.statusIntervalMs    = doc["statusMs"].as<uint32_t>();
    if (doc.containsKey("otaMs"))    cfg.otaCheckIntervalMs  = doc["otaMs"].as<uint32_t>();

    // WiFi STA credentials stored in separate NVS namespace
    if (doc.containsKey("wifiSsid") || doc.containsKey("wifiPass")) {
        Preferences wprefs;
        wprefs.begin("fg_wifi", false);
        if (doc.containsKey("wifiSsid"))
            wprefs.putString("ssid", doc["wifiSsid"].as<const char*>());
        if (doc.containsKey("wifiPass")) {
            // PASSWORD FIELD: only write if non-empty
            const char* wp = doc["wifiPass"].as<const char*>();
            if (wp && wp[0] != '\0') wprefs.putString("pass", wp);
        }
        wprefs.end();
    }

    // Admin password update
    if (doc.containsKey("adminPass")) {
        const char* newPw = doc["adminPass"];
        if (newPw && strlen(newPw) >= 4) {
            Preferences ap;
            ap.begin("fg_adm", false);
            ap.putString("pass", newPw);
            ap.end();
            LOG_I("WEBUI", "Admin password updated");
        }
    }

    // SMS config (Change 3)
    if (doc.containsKey("smsNumbers"))
        strlcpy(cfg.smsNumbers, doc["smsNumbers"].as<const char*>(), sizeof(cfg.smsNumbers));
    if (doc.containsKey("smsEnabled"))
        cfg.smsEnabled = doc["smsEnabled"].as<bool>();

    config_save();

    // FIX 2: Send response FIRST, then schedule deferred reboot
    req->send(200, "application/json", "{\"ok\":true,\"rebooting\":true}");
    LOG_I("WEBUI", "Config saved via WebUI — reboot in 1.5 s");
    webui_config_schedule_reboot(1500);
}

// ---- GET /api/config/export ---------------------------------

static void handle_export(AsyncWebServerRequest* req) {
    GatewayConfig& cfg = getConfig();
    StaticJsonDocument<1536> doc;

    doc["fw"]      = FW_VERSION;
    doc["hw"]      = HW_REVISION;
    doc["env"]     = cfg.env;
    doc["siteId"]  = cfg.siteId;
    doc["gatewayId"]= cfg.gatewayId;
    doc["mqttHost"]= cfg.mqttHost;
    doc["mqttPort"]= cfg.mqttPort;
    doc["mqttUser"]= cfg.mqttUser;
    // mqttPass omitted from export
    doc["apiHost"] = cfg.apiHost;
    doc["apn"]     = cfg.apn;
    doc["telMs"]   = cfg.telemetryIntervalMs;

    JsonArray regs = doc.createNestedArray("registers");
    for (uint8_t i = 0; i < cfg.regCount; i++) {
        JsonObject r = regs.createNestedObject();
        r["slave"] = cfg.regs[i].slaveId;
        r["fc"]    = cfg.regs[i].fc;
        r["addr"]  = cfg.regs[i].regAddr;
        r["count"] = cfg.regs[i].count;
        r["scale"] = cfg.regs[i].scale;
        r["unit"]  = cfg.regs[i].unit;
        r["tag"]   = cfg.regs[i].tag;
        r["en"]    = cfg.regs[i].enabled;
    }

    JsonArray thr = doc.createNestedArray("thresholds");
    for (uint8_t i = 0; i < cfg.thresholdCount; i++) {
        JsonObject t = thr.createNestedObject();
        t["tag"]      = cfg.thresholds[i].tag;
        t["warnLow"]  = cfg.thresholds[i].warnLow;
        t["critLow"]  = cfg.thresholds[i].critLow;
        t["warnHigh"] = cfg.thresholds[i].warnHigh;
        t["critHigh"] = cfg.thresholds[i].critHigh;
        t["en"]       = cfg.thresholds[i].enabled;
    }

    char buf[1536];
    serializeJson(doc, buf, sizeof(buf));
    req->send(200, "application/json", buf);
}

// ---- POST /api/config/import --------------------------------

static void handle_import(AsyncWebServerRequest* req, uint8_t* data,
                           size_t len, size_t, size_t) {
    if (!check_admin_token(req)) { deny(req); return; }

    StaticJsonDocument<1536> doc;
    if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
        req->send(400, "application/json", "{\"error\":\"bad JSON\"}");
        return;
    }

    GatewayConfig& cfg = getConfig();
    if (doc.containsKey("env"))      strlcpy(cfg.env,       doc["env"],      sizeof(cfg.env));
    if (doc.containsKey("siteId"))   strlcpy(cfg.siteId,    doc["siteId"],   sizeof(cfg.siteId));
    if (doc.containsKey("gatewayId"))strlcpy(cfg.gatewayId, doc["gatewayId"],sizeof(cfg.gatewayId));
    if (doc.containsKey("mqttHost")) strlcpy(cfg.mqttHost,  doc["mqttHost"], sizeof(cfg.mqttHost));
    if (doc.containsKey("mqttPort")) cfg.mqttPort = doc["mqttPort"].as<uint16_t>();
    if (doc.containsKey("apiHost"))  strlcpy(cfg.apiHost,   doc["apiHost"],  sizeof(cfg.apiHost));

    if (doc.containsKey("registers")) {
        JsonArray regs = doc["registers"].as<JsonArray>();
        uint8_t idx = 0;
        for (JsonObject r : regs) {
            if (idx >= CONFIG_MAX_REGISTERS) break;
            cfg.regs[idx].slaveId = r["slave"] | 1;
            cfg.regs[idx].fc      = r["fc"]    | 3;
            cfg.regs[idx].regAddr = r["addr"]  | 0;
            cfg.regs[idx].count   = r["count"] | 1;
            cfg.regs[idx].scale   = r["scale"] | 1.0f;
            cfg.regs[idx].enabled = r["en"]    | true;
            strlcpy(cfg.regs[idx].unit, r["unit"] | "raw", sizeof(cfg.regs[idx].unit));
            strlcpy(cfg.regs[idx].tag,  r["tag"]  | "",    sizeof(cfg.regs[idx].tag));
            idx++;
        }
        cfg.regCount = idx;
    }

    if (doc.containsKey("thresholds")) {
        JsonArray thr = doc["thresholds"].as<JsonArray>();
        uint8_t idx = 0;
        for (JsonObject t : thr) {
            if (idx >= CONFIG_MAX_REGISTERS) break;
            strlcpy(cfg.thresholds[idx].tag, t["tag"] | "", sizeof(cfg.thresholds[idx].tag));
            cfg.thresholds[idx].warnLow  = t["warnLow"]  | 0.0f;
            cfg.thresholds[idx].critLow  = t["critLow"]  | 0.0f;
            cfg.thresholds[idx].warnHigh = t["warnHigh"] | 0.0f;
            cfg.thresholds[idx].critHigh = t["critHigh"] | 0.0f;
            cfg.thresholds[idx].enabled  = t["en"]       | true;
            idx++;
        }
        cfg.thresholdCount = idx;
    }

    config_save();
    req->send(200, "application/json", "{\"ok\":true,\"imported\":true}");
}

// ---- POST /api/factory-reset --------------------------------

static void handle_factory_reset(AsyncWebServerRequest* req) {
    if (!check_admin_token(req)) { deny(req); return; }
    config_reset_to_defaults();
    Preferences p;
    p.begin("fg_wifi", false); p.clear(); p.end();
    p.begin("fg_adm",  false); p.clear(); p.end();

    // FIX 2: Send response FIRST, then schedule deferred reboot
    req->send(200, "application/json", "{\"ok\":true,\"rebooting\":true}");
    LOG_W("WEBUI", "Factory reset via WebUI — reboot in 1.5 s");
    webui_config_schedule_reboot(1500);
}

// ---- Register all config routes -----------------------------

void webui_register_config(AsyncWebServer* srv) {
    srv->on("/api/authinfo", HTTP_GET, handle_authinfo);

    srv->on("/api/config", HTTP_GET, handle_get_config);

    srv->on("/api/config", HTTP_POST,
        [](AsyncWebServerRequest* req){},
        nullptr,
        handle_post_config);

    srv->on("/api/config/export", HTTP_GET, handle_export);

    srv->on("/api/config/import", HTTP_POST,
        [](AsyncWebServerRequest* req){},
        nullptr,
        handle_import);

    srv->on("/api/factory-reset", HTTP_POST,
        [](AsyncWebServerRequest* req){ handle_factory_reset(req); });
}
