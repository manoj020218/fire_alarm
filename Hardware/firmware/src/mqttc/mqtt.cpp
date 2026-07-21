// ============================================================
// FireGuard — MQTT client implementation
// Single PubSubClient reused across all transport changes.
// Re-binds to the uplink's active Client on reconnect.
// HTTP fallbacks via API client (PART B).
// ============================================================
#include "mqtt.h"
#include "topics.h"
#include "../net/uplink.h"
#include "../net/modem4g.h"
#include "../net/apiclient.h"
#include "../config/config.h"
#include "../config/build_info.h"
#include "../config/defaults.h"
#include "../ota/ota.h"
#include "../alarms/engine.h"
#include "../sim/simsvc.h"
#include "../util/log.h"
#include "../util/health.h"
#include "../util/scheduler.h"
#include <PubSubClient.h>
#include <ArduinoJson.h>

static PubSubClient  s_mqtt;
static MqttMessageCb s_userCb = nullptr;
static Task          s_reconnectTask = {0, 5000};  // retry every 5 s
static UplinkType    s_lastUplink = UplinkType::NONE;  // transport we're bound to
static uint8_t       s_connectFails = 0;               // consecutive failed connects
static int           s_lastFailRc   = 0;               // last PubSubClient state() on fail

// ---- Inbound command dispatch --------------------------------

static void dispatch_ota_cmd(const char* cmdJson, unsigned int len) {
    StaticJsonDocument<128> doc;
    if (deserializeJson(doc, cmdJson, len) != DeserializationError::Ok) return;
    const char* cmd = doc["cmd"] | "";
    if (strcmp(cmd, "check") == 0) {
        LOG_I("MQTT", "OTA check command received (queued)");
        ota_request_check();   // deferred — runs in main loop, not this callback
    } else if (strcmp(cmd, "update") == 0) {
        LOG_I("MQTT", "OTA update command received (queued)");
        ota_request_update();  // deferred — check-then-apply in main loop
    } else {
        LOG_W("MQTT", "Unknown OTA cmd: %s", cmd);
    }
}

static void dispatch_command(const char* cmdJson, unsigned int len) {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, cmdJson, len) != DeserializationError::Ok) return;

    // Legacy in-band ack support
    const char* type = doc["type"] | "";
    if (strcmp(type, "ack") == 0) {
        const char* tag = doc["tag"] | "";
        if (tag[0]) alarms_ack(tag);
        return;
    }

    // Backend sends { command, params, issuedAt }
    const char* command = doc["command"] | "";
    if (!command[0]) return;

    // OTA over the (proven-reliable) command topic — belt & suspenders alongside
    // the dedicated `ota` topic. Deferred: runs in ota_service() on the loop.
    if (strcmp(command, "ota_check") == 0) {
        LOG_I("MQTT", "OTA check via command topic (queued)");
        ota_request_check();
        return;
    }
    if (strcmp(command, "ota_update") == 0) {
        LOG_I("MQTT", "OTA update via command topic (queued)");
        ota_request_update();
        return;
    }

    if (strcmp(command, "sim_info") == 0 || strcmp(command, "read_sms")  == 0 ||
        strcmp(command, "ussd")     == 0 || strcmp(command, "test_sms")  == 0 ||
        strcmp(command, "test_call") == 0) {
        const char* code   = doc["params"]["code"]   | "";
        const char* number = doc["params"]["number"] | "";
        simsvc_request(command, code, number);      // runs in the main loop
    }
    // Other commands (reboot / sync_time / test_alarm) can be added here.
}

// Apply pushed config from config/set — SMS alert numbers/operator + register map.
static void dispatch_config(const char* json, unsigned int len) {
    DynamicJsonDocument doc(4096);   // register maps can hold up to 32 devices
    if (deserializeJson(doc, json, len) != DeserializationError::Ok) return;

    JsonVariantConst sms = doc["customSettings"]["sms"];
    if (!sms.isNull()) {
        const char* numbers = sms["numbers"] | "";
        bool enabled        = sms["enabled"] | false;
        config_set_sms(numbers, enabled);
        LOG_I("MQTT", "config/set: SMS updated (enabled=%d)", enabled ? 1 : 0);
    }

    JsonArrayConst regs = doc["customSettings"]["registers"];
    if (!regs.isNull()) {
        config_set_registers(regs);
    }
}

// --- Internal MQTT callback ----------------------------------
static void on_message(char* topic, byte* payload, unsigned int len) {
    LOG_I("MQTT", "RX topic=%s len=%u", topic, len);
    if (s_userCb) s_userCb(topic, payload, len);

    // Topic dispatch
    String otaTopic = topic_ota();
    String cmdTopic = topic_command();
    String cfgTopic = topic_config_set();
    if (strcmp(topic, otaTopic.c_str()) == 0) {
        dispatch_ota_cmd((const char*)payload, len);
    } else if (strcmp(topic, cmdTopic.c_str()) == 0) {
        dispatch_command((const char*)payload, len);
    } else if (strcmp(topic, cfgTopic.c_str()) == 0) {
        dispatch_config((const char*)payload, len);
    }
}

// --- Subscribe all inbound topics ----------------------------
// Pump s_mqtt.loop() + a short delay between each subscribe. Firing several
// subscribe() calls back-to-back is a known PubSubClient failure mode: the later
// SUBSCRIBE packets are not flushed to the socket and silently never register at
// the broker — which is exactly why `command` (2nd) worked but `ota` (3rd) never
// received messages, blocking VPS-triggered OTA.
static void subscribe_all() {
    bool a = s_mqtt.subscribe(topic_config_set().c_str());
    s_mqtt.loop(); delay(30);
    bool b = s_mqtt.subscribe(topic_command().c_str());
    s_mqtt.loop(); delay(30);
    bool c = s_mqtt.subscribe(topic_ota().c_str());
    s_mqtt.loop(); delay(30);
    LOG_I("MQTT", "Subscribed config/set=%d command=%d ota=%d", (int)a, (int)b, (int)c);
}

// --- Connect (non-blocking attempt) --------------------------
static bool do_connect() {
    if (!uplink_is_up()) return false;

    GatewayConfig& cfg = getConfig();

    s_mqtt.setClient(uplink_get_client());
    s_mqtt.setServer(cfg.mqttHost, cfg.mqttPort);
    s_mqtt.setCallback(on_message);
    s_mqtt.setKeepAlive(60);
    s_mqtt.setSocketTimeout(5);

    String willTopic = topic_status();
    const char* willMsg = "{\"online\":false}";

    bool ok;
    if (strlen(cfg.mqttUser) > 0) {
        ok = s_mqtt.connect(cfg.gatewayId, cfg.mqttUser, cfg.mqttPass,
                            willTopic.c_str(), 1, true, willMsg);
    } else {
        ok = s_mqtt.connect(cfg.gatewayId,
                            willTopic.c_str(), 1, true, willMsg);
    }

    if (ok) {
        health_inc_mqtt_reconnect();
        s_lastUplink = uplink_active_type();   // remember the transport we bound to
        s_connectFails = 0;
        uplink_report_cloud_ok();
        LOG_I("MQTT", "Connected to %s:%d as %s over %s",
              cfg.mqttHost, cfg.mqttPort, cfg.gatewayId, uplink_type_str());
        subscribe_all();
    } else {
        s_lastFailRc = s_mqtt.state();
        LOG_W("MQTT", "Connect failed rc=%d over %s", s_lastFailRc, uplink_type_str());
        // On 4G, hand the rc to the modem so it can repair the SIM data path
        // (it classifies the code and runs its recovery ladder — PDP-attached does
        // NOT mean the broker socket can open).
        if (uplink_active_type() == UplinkType::G4) {
            modem4g_report_broker_fail(s_lastFailRc);
        }
        // Classify the failure (CODEX): only a TRANSPORT failure means "this uplink
        // can't reach the broker" → fail over to another transport.
        //   -2 MQTT_CONNECT_FAILED (socket)  -4 MQTT_CONNECTION_TIMEOUT  → transport
        //    4/5 credentials/unauthorized, 3 unavailable  → NOT a transport problem
        if (s_lastFailRc == -2 || s_lastFailRc == -4) {
            if (++s_connectFails >= 4) {
                s_connectFails = 0;
                uplink_report_cloud_fail();
            }
        } else {
            s_connectFails = 0;   // auth/broker issue — don't blacklist the transport
        }
    }
    return ok;
}

// --- Public API ----------------------------------------------

void mqtt_init() {
    task_trigger_now(s_reconnectTask);
}

void mqtt_loop() {
    if (s_mqtt.connected()) {
        // If the uplink switched transports (e.g. WiFi -> 4G), the current socket
        // is on the old transport — drop it so we reconnect over the new one.
        if (uplink_active_type() != s_lastUplink && uplink_is_up()) {
            LOG_I("MQTT", "Uplink changed %d->%d — reconnecting over new transport",
                  (int)s_lastUplink, (int)uplink_active_type());
            s_mqtt.disconnect();
            task_trigger_now(s_reconnectTask);
            return;
        }
        s_mqtt.loop();
        return;
    }
    if (task_due(s_reconnectTask)) {
        do_connect();
    }
}

bool mqtt_connected() { return s_mqtt.connected(); }

int  mqtt_last_fail_rc() { return s_lastFailRc; }

bool mqtt_publish(const char* topic, const char* payload, bool retain) {
    if (!s_mqtt.connected()) return false;
    bool ok = s_mqtt.publish(topic, payload, retain);
    if (!ok) LOG_W("MQTT", "Publish failed topic=%s", topic);
    return ok;
}

bool mqtt_publish_json(const char* topic, JsonDocument& doc, bool retain) {
    char buf[MQTT_MAX_PACKET_SIZE];
    size_t n = serializeJson(doc, buf, sizeof(buf));
    if (n == 0 || n >= sizeof(buf)) {
        LOG_E("MQTT", "JSON serialize overflow on topic %s", topic);
        return false;
    }
    return mqtt_publish(topic, buf, retain);
}

// ---- HTTP fallback: POST /ingest ----------------------------
bool mqtt_http_fallback_telemetry(const char* jsonPayload) {
    if (!uplink_is_up()) return false;
    LOG_I("MQTT", "HTTP fallback → POST /ingest");
    ApiResponse resp = api_post("/ingest", jsonPayload);
    if (resp.status == 200 || resp.status == 201) {
        LOG_I("MQTT", "HTTP ingest OK");
        return true;
    }
    LOG_W("MQTT", "HTTP ingest failed: %d", resp.status);
    return false;
}

// ---- HTTP fallback: POST /alarm -----------------------------
bool mqtt_http_fallback_alarm(const char* jsonPayload) {
    if (!uplink_is_up()) return false;
    LOG_I("MQTT", "HTTP alarm fallback → POST /alarm");
    ApiResponse resp = api_post("/alarm", jsonPayload);
    if (resp.status == 200 || resp.status == 201) {
        LOG_I("MQTT", "HTTP alarm OK");
        return true;
    }
    LOG_W("MQTT", "HTTP alarm failed: %d", resp.status);
    return false;
}

void mqtt_set_message_cb(MqttMessageCb cb) { s_userCb = cb; }
