// ============================================================
// FireGuard Gateway Firmware — main.cpp
// Board: Vajruino VVM401 (ESP32 classic, 4 MB flash, 520 kB RAM)
// setup(): strict init order per §5 / §10 of firmware plan
// loop():  millis scheduler only — no blocking delay()
// ============================================================
#include <Arduino.h>
#include <Wire.h>
#include <esp_task_wdt.h>
#include <ArduinoJson.h>

#include "config/pins.h"
#include "config/build_info.h"
#include "config/defaults.h"
#include "config/config.h"
#include "util/log.h"
#include <Preferences.h>
#include "util/scheduler.h"
#include "util/health.h"
#include "net/uplink.h"
#include "net/apiclient.h"
#include "mqttc/mqtt.h"
#include "mqttc/topics.h"
#include "modbus/registers.h"
#include "io/dio.h"
#include "alarms/engine.h"
#include "store/rtc.h"
#include "store/sdbuffer.h"
#include "webui/server.h"
#include "ota/ota.h"

// ---- Millis tasks -------------------------------------------
static Task tTelemetry  = {0, TELEMETRY_INTERVAL_MS};
static Task tStatus     = {0, STATUS_INTERVAL_MS};
static Task tModbus     = {0, MODBUS_POLL_INTERVAL_MS};
static Task tAlarms     = {0, 2000};    // alarm eval every 2 s
static Task tUplink     = {0, UPLINK_CHECK_INTERVAL_MS};
static Task tOta        = {0, OTA_CHECK_INTERVAL_MS};
static Task tLed        = {0, 500};     // status LED heartbeat
static Task tTimeSync   = {0, 3600000UL}; // try time sync hourly (rtc_maybe_sync guards 23h)
static Task tReboot     = {0, 60000};  // auto-reboot check every minute
static Task tDi1Guard   = {0, 100};    // DI1 long-press factory reset detector

// ---- LED heartbeat ------------------------------------------
static bool s_ledState = false;

static void led_tick() {
    bool alarm = alarms_any_active();
    if (alarm) {
        // Solid on during active alarm
        digitalWrite(PIN_LED, HIGH);
        return;
    }
    s_ledState = !s_ledState;
    // Fast blink = no uplink; slow blink = OK
    if (!uplink_is_up()) {
        // always toggle on 500ms tick = fast
        digitalWrite(PIN_LED, s_ledState ? HIGH : LOW);
    } else {
        // slow: only apply state every other tick (1 Hz effectively)
        static uint8_t skip = 0;
        if (++skip >= 2) { skip = 0; digitalWrite(PIN_LED, s_ledState ? HIGH : LOW); }
    }
}

// ---- DI1 held-low 5 s → factory reset ----------------------
static uint32_t s_di1LowMs   = 0;
static bool     s_di1WasLow  = false;
#define FACTORY_RESET_HOLD_MS 5000

static void check_factory_reset_pin() {
    bool low = di_read(0);  // DI1 = index 0, active-low = true when pressed
    if (low && !s_di1WasLow) {
        s_di1LowMs  = millis();
        s_di1WasLow = true;
    } else if (!low) {
        s_di1WasLow = false;
    } else if (low && s_di1WasLow) {
        if ((millis() - s_di1LowMs) >= FACTORY_RESET_HOLD_MS) {
            LOG_W("MAIN", "DI1 held 5s — factory reset triggered");
            config_reset_to_defaults();
            Preferences p;
            p.begin("fg_wifi", false); p.clear(); p.end();
            p.begin("fg_adm",  false); p.clear(); p.end();
            delay(300);
            esp_restart();
        }
    }
}

// ---- Daily auto-reboot check --------------------------------
static void check_auto_reboot() {
    uint8_t h = getConfig().autoRebootHour;
    if (h > 23) return;  // 255 = disabled

    uint32_t ep = rtc_epoch();
    if (ep == 0) return;  // RTC not set

    // Get current hour from epoch (UTC; site is responsible for setting autoRebootHour in UTC)
    struct tm t;
    time_t tt = (time_t)ep;
    gmtime_r(&tt, &t);

    // Only reboot once: detect transition into the target hour
    static uint8_t s_lastHour = 255;
    if (t.tm_hour == h && s_lastHour != h && health_uptime_s() > 120) {
        s_lastHour = h;
        LOG_W("MAIN", "Daily auto-reboot at %02d:00 UTC", h);
        delay(200);
        esp_restart();
    }
    s_lastHour = t.tm_hour;
}

// ---- Alarm publish callback ---------------------------------
static void on_alarm_event(const AlarmEvent& ev) {
    StaticJsonDocument<256> doc;
    char alarmId[40];
    snprintf(alarmId, sizeof(alarmId), "%s_%lu", ev.tag, (unsigned long)ev.timestamp);
    doc["alarmId"]   = alarmId;
    doc["siteId"]    = getConfig().siteId;
    doc["gatewayId"] = getConfig().gatewayId;
    doc["deviceId"]  = ev.tag;
    doc["parameter"] = ev.parameter;
    doc["value"]     = ev.value;
    doc["severity"]  = (ev.severity == AlarmSeverity::CRITICAL) ? "critical" : "warning";
    doc["timestamp"] = ev.timestamp;
    doc["active"]    = ev.active;

    if (!mqtt_publish_json(topic_alarm().c_str(), doc)) {
        LOG_W("MAIN", "Alarm MQTT publish failed — trying HTTP fallback");
        // HTTP alarm fallback
        char buf[256];
        serializeJson(doc, buf, sizeof(buf));
        mqtt_http_fallback_alarm(buf);
    }
}

// ---- Telemetry builder --------------------------------------
static void publish_telemetry() {
    GatewayConfig& cfg = getConfig();
    StaticJsonDocument<1024> doc;

    doc["pid"]       = PRODUCT_ID;
    doc["gatewayId"] = cfg.gatewayId;
    doc["siteId"]    = cfg.siteId;
    doc["timestamp"] = rtc_epoch();

    JsonObject sys = doc.createNestedObject("system");
    sys["uptime"]    = health_uptime_s();
    sys["heap"]      = health_free_heap();
    sys["fw"]        = FW_VERSION;
    sys["releaseDate"] = RELEASE_DATE;
    sys["uplink"]    = uplink_type_str();
    sys["signal4g"]  = uplink_signal_4g_dbm();
    sys["signalLan"] = uplink_signal_lan();
    sys["rssi"]      = uplink_signal_4g_dbm();
    sys["mqtt"]      = mqtt_connected() ? "connected" : "disconnected";
    sys["cloud"]     = uplink_is_up()   ? "online"    : "offline";
    sys["rs485"]     = modbus_is_bus_ok() ? "ok"       : "error";
    sys["wifi"]      = (strcmp(uplink_type_str(), "wifi") == 0) ? "online" : "offline";

    JsonObject devs = doc.createNestedObject("devices");
    RegReading* readings = modbus_readings();
    for (uint8_t i = 0; i < cfg.regCount; i++) {
        JsonObject d = devs.createNestedObject(readings[i].tag);
        d["value"]  = readings[i].value;
        d["online"] = readings[i].online;
    }

    JsonObject di = devs.createNestedObject("digitalInputs");
    di["di0"] = di_read(0);
    di["di1"] = di_read(1);
    di["di2"] = di_read(2);
    di["di3"] = di_read(3);

    JsonObject doo = devs.createNestedObject("digitalOutputs");
    doo["do0"] = do_get(0);
    doo["do1"] = do_get(1);

    char buf[1024];
    size_t n = serializeJson(doc, buf, sizeof(buf));
    if (n == 0 || n >= sizeof(buf)) {
        LOG_E("MAIN", "Telemetry JSON overflow");
        return;
    }

    if (mqtt_connected()) {
        mqtt_publish(topic_telemetry().c_str(), buf);
    } else {
        if (!sdbuf_write(buf)) {
            LOG_W("MAIN", "SD buffer write failed — record lost");
        }
        mqtt_http_fallback_telemetry(buf);
    }
}

// ---- Status publish -----------------------------------------
static void publish_status() {
    GatewayConfig& cfg = getConfig();
    StaticJsonDocument<512> doc;
    doc["gatewayId"] = cfg.gatewayId;
    doc["siteId"]    = cfg.siteId;
    doc["online"]    = true;
    doc["fw"]        = FW_VERSION;
    doc["uplink"]    = uplink_type_str();
    doc["signal4g"]  = uplink_signal_4g_dbm();
    doc["signalLan"] = uplink_signal_lan();
    doc["uptime"]    = health_uptime_s();
    doc["heap"]      = health_free_heap();
    doc["reset"]     = health_reset_reason();
    doc["alarmsActive"] = alarms_active_count();

    mqtt_publish_json(topic_status().c_str(), doc, true);
}

// ---- SD replay on reconnect ---------------------------------
static void replay_sd_buffer() {
    if (!sdbuf_has_pending() || !mqtt_connected()) return;
    char buf[1024];
    uint8_t replayed = 0;
    while (replayed < 5 && sdbuf_replay_next(buf, sizeof(buf))) {
        mqtt_publish(topic_telemetry().c_str(), buf);
        replayed++;
    }
    if (replayed > 0) {
        LOG_I("MAIN", "Replayed %d SD records", replayed);
    }
}

// =============================================================
// setup()
// =============================================================
void setup() {
    Serial.begin(115200);
    uint32_t t = millis();
    while (!Serial && (millis() - t) < 2000) { yield(); }

    LOG_I("MAIN", "=== FireGuard %s (%s) hw=%s ===",
          FW_VERSION, RELEASE_DATE, HW_REVISION);

    // 1. Health init
    health_init();

    // 2. Status LED
    pinMode(PIN_LED, OUTPUT);
    digitalWrite(PIN_LED, HIGH);

    // 3. NVS config
    config_load();

    // 4. RTC (I2C)
    rtc_init();

    // 5. SD
    sdbuf_init();

    // 6. DIO
    dio_init();

    // 7. Modbus master
    modbus_init();

    // 8. Alarm engine
    alarms_init();
    alarms_set_publish_cb(on_alarm_event);

    // 9. API client (generates device token if first boot)
    api_init();

    // 10. Uplink failover
    uplink_init();

    // 11. Time sync — attempt on first uplink (modem or NTP)
    rtc_maybe_sync();

    // 12. MQTT
    mqtt_init();

    // 13. WebUI + OTA
    webui_init();
    ota_init();

    // 14. Watchdog (30 s)
    esp_task_wdt_init(30, false);
    esp_task_wdt_add(NULL);

    digitalWrite(PIN_LED, LOW);
    LOG_I("MAIN", "Setup complete.  FreeHeap=%u", ESP.getFreeHeap());
}

// =============================================================
// loop()  — millis scheduler only, NO blocking delay()
// =============================================================
void loop() {
    esp_task_wdt_reset();

    // Uplink maintenance
    uplink_loop();

    // MQTT keepalive / reconnect
    mqtt_loop();

    // Replay SD buffer when MQTT reconnects
    replay_sd_buffer();

    // WebUI + OTA validation tick
    webui_loop();

    // Modbus: one device per tick
    if (task_due(tModbus)) {
        modbus_poll();
    }

    // Alarm evaluation
    if (task_due(tAlarms)) {
        alarms_evaluate();
    }

    // Telemetry publish
    if (task_due(tTelemetry)) {
        tTelemetry.intervalMs = getConfig().telemetryIntervalMs;
        publish_telemetry();
    }

    // Status publish
    if (task_due(tStatus)) {
        tStatus.intervalMs = getConfig().statusIntervalMs;
        publish_status();
    }

    // OTA periodic manifest check
    if (task_due(tOta)) {
        tOta.intervalMs = getConfig().otaCheckIntervalMs;
        ota_check_manifest();
    }

    // Time sync (hourly attempt; rtc_maybe_sync guards 23h internally)
    if (task_due(tTimeSync)) {
        rtc_maybe_sync();
    }

    // LED heartbeat
    if (task_due(tLed)) {
        led_tick();
    }

    // Auto-reboot check (once per minute)
    if (task_due(tReboot)) {
        check_auto_reboot();
    }

    // DI1 factory-reset long-press (every 100 ms)
    if (task_due(tDi1Guard)) {
        check_factory_reset_pin();
    }

    // OTA mark valid once everything is stable
    static bool s_validated = false;
    if (!s_validated && mqtt_connected() && uplink_is_up()) {
        ota_mark_valid();
        s_validated = true;
    }

    yield();
}
