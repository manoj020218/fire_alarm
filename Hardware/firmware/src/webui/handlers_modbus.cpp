// ============================================================
// FireGuard WebUI — Modbus handlers
// POST /api/modbus/scan    — probe slaves 1..N
// POST /api/modbus/read    — single read (fc/addr/count)
// GET  /api/modbus/registers — list register map
// POST /api/modbus/registers — replace register map → NVS
// ============================================================
#include "handlers_modbus.h"
#include "../config/config.h"
#include "../modbus/registers.h"
#include "../util/log.h"
#include <ArduinoJson.h>
#include <ModbusMaster.h>
#include <esp_task_wdt.h>
#include "../config/pins.h"

// ---- POST /api/modbus/scan ----------------------------------

static void handle_scan(AsyncWebServerRequest* req, uint8_t* data,
                         size_t len, size_t, size_t) {
    StaticJsonDocument<64> body;
    deserializeJson(body, data, len);
    uint8_t maxSlave = body["maxSlave"] | 16;
    if (maxSlave > 32) maxSlave = 32;  // safety cap

    StaticJsonDocument<256> resp;
    JsonArray found = resp.createNestedArray("found");

    ModbusMaster node;
    for (uint8_t id = 1; id <= maxSlave; id++) {
        node.begin(id, Serial2);
        uint8_t result = node.readHoldingRegisters(0, 1);
        if (result == node.ku8MBSuccess) {
            found.add(id);
        }
        esp_task_wdt_reset();
        delay(50);  // brief inter-device gap (scan is not called in steady-state)
    }

    char buf[256];
    serializeJson(resp, buf, sizeof(buf));
    req->send(200, "application/json", buf);
}

// ---- POST /api/modbus/read ----------------------------------

static void handle_read(AsyncWebServerRequest* req, uint8_t* data,
                         size_t len, size_t, size_t) {
    StaticJsonDocument<128> body;
    if (deserializeJson(body, data, len) != DeserializationError::Ok) {
        req->send(400, "application/json", "{\"error\":\"bad JSON\"}");
        return;
    }

    uint8_t  slave = body["slave"] | 1;
    uint8_t  fc    = body["fc"]    | 3;
    uint16_t addr  = body["addr"]  | 0;
    uint8_t  count = body["count"] | 1;
    if (count > 4) count = 4;

    ModbusMaster node;
    node.begin(slave, Serial2);

    uint8_t result;
    if (fc == 3) {
        result = node.readHoldingRegisters(addr, count);
    } else if (fc == 4) {
        result = node.readInputRegisters(addr, count);
    } else {
        req->send(400, "application/json", "{\"error\":\"unsupported FC\"}");
        return;
    }

    StaticJsonDocument<128> resp;
    resp["ok"] = (result == node.ku8MBSuccess);
    resp["result"] = result;

    JsonArray raw = resp.createNestedArray("raw");
    uint32_t combined = 0;
    if (result == node.ku8MBSuccess) {
        for (uint8_t i = 0; i < count; i++) {
            uint16_t v = node.getResponseBuffer(i);
            raw.add(v);
            combined = (combined << 16) | v;
        }
    }
    resp["value"] = (float)combined;

    char buf[128];
    serializeJson(resp, buf, sizeof(buf));
    req->send(200, "application/json", buf);
}

// ---- GET /api/modbus/registers ------------------------------

static void handle_get_regs(AsyncWebServerRequest* req) {
    GatewayConfig& cfg = getConfig();
    StaticJsonDocument<1024> doc;
    JsonArray arr = doc.createNestedArray("registers");
    for (uint8_t i = 0; i < cfg.regCount; i++) {
        JsonObject r = arr.createNestedObject();
        r["idx"]   = i;
        r["slave"] = cfg.regs[i].slaveId;
        r["fc"]    = cfg.regs[i].fc;
        r["addr"]  = cfg.regs[i].regAddr;
        r["count"] = cfg.regs[i].count;
        r["scale"] = cfg.regs[i].scale;
        r["unit"]  = cfg.regs[i].unit;
        r["tag"]   = cfg.regs[i].tag;
        r["en"]    = cfg.regs[i].enabled;

        // Include live reading
        RegReading* readings = modbus_readings();
        r["value"]  = readings[i].value;
        r["online"] = readings[i].online;
    }

    char buf[1024];
    serializeJson(doc, buf, sizeof(buf));
    req->send(200, "application/json", buf);
}

// ---- POST /api/modbus/registers (replace full map) ----------

static void handle_post_regs(AsyncWebServerRequest* req, uint8_t* data,
                              size_t len, size_t, size_t) {
    StaticJsonDocument<1024> doc;
    if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
        req->send(400, "application/json", "{\"error\":\"bad JSON\"}");
        return;
    }

    GatewayConfig& cfg = getConfig();
    JsonArray arr = doc["registers"].as<JsonArray>();
    uint8_t idx = 0;
    for (JsonObject r : arr) {
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
    config_save();

    req->send(200, "application/json", "{\"ok\":true}");
    LOG_I("WEBUI", "Register map updated via WebUI (%d entries)", idx);
}

// ---- Register all modbus routes -----------------------------

void webui_register_modbus(AsyncWebServer* srv) {
    srv->on("/api/modbus/scan", HTTP_POST,
        [](AsyncWebServerRequest* req){},
        nullptr,
        handle_scan);

    srv->on("/api/modbus/read", HTTP_POST,
        [](AsyncWebServerRequest* req){},
        nullptr,
        handle_read);

    srv->on("/api/modbus/registers", HTTP_GET, handle_get_regs);

    srv->on("/api/modbus/registers", HTTP_POST,
        [](AsyncWebServerRequest* req){},
        nullptr,
        handle_post_regs);
}
