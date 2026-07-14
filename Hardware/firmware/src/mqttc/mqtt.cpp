// ============================================================
// FireGuard — MQTT client implementation
// Single PubSubClient reused across all transport changes.
// Re-binds to the uplink's active Client on reconnect.
// HTTP fallbacks via API client (PART B).
// ============================================================
#include "mqtt.h"
#include "topics.h"
#include "../net/uplink.h"
#include "../net/apiclient.h"
#include "../config/config.h"
#include "../config/build_info.h"
#include "../config/defaults.h"
#include "../ota/ota.h"
#include "../alarms/engine.h"
#include "../util/log.h"
#include "../util/health.h"
#include "../util/scheduler.h"
#include <PubSubClient.h>
#include <ArduinoJson.h>

static PubSubClient  s_mqtt;
static MqttMessageCb s_userCb = nullptr;
static Task          s_reconnectTask = {0, 5000};  // retry every 5 s

// ---- Inbound command dispatch --------------------------------

static void dispatch_ota_cmd(const char* cmdJson, unsigned int len) {
    StaticJsonDocument<128> doc;
    if (deserializeJson(doc, cmdJson, len) != DeserializationError::Ok) return;
    const char* cmd = doc["cmd"] | "";
    if (strcmp(cmd, "check") == 0) {
        LOG_I("MQTT", "OTA check command received");
        ota_check_manifest();
    } else if (strcmp(cmd, "update") == 0) {
        LOG_I("MQTT", "OTA update command received");
        ota_begin_update();
    } else {
        LOG_W("MQTT", "Unknown OTA cmd: %s", cmd);
    }
}

static void dispatch_command(const char* cmdJson, unsigned int len) {
    StaticJsonDocument<128> doc;
    if (deserializeJson(doc, cmdJson, len) != DeserializationError::Ok) return;

    const char* type = doc["type"] | "";
    if (strcmp(type, "ack") == 0) {
        const char* tag = doc["tag"] | "";
        if (tag[0]) alarms_ack(tag);
    }
    // Additional commands can be added here
}

// --- Internal MQTT callback ----------------------------------
static void on_message(char* topic, byte* payload, unsigned int len) {
    LOG_I("MQTT", "RX topic=%s len=%u", topic, len);
    if (s_userCb) s_userCb(topic, payload, len);

    // OTA topic dispatch
    String otaTopic = topic_ota();
    String cmdTopic = topic_command();
    if (strcmp(topic, otaTopic.c_str()) == 0) {
        dispatch_ota_cmd((const char*)payload, len);
    } else if (strcmp(topic, cmdTopic.c_str()) == 0) {
        dispatch_command((const char*)payload, len);
    }
    // config/set handled by external callback if registered
}

// --- Subscribe all inbound topics ----------------------------
static void subscribe_all() {
    s_mqtt.subscribe(topic_config_set().c_str());
    s_mqtt.subscribe(topic_command().c_str());
    s_mqtt.subscribe(topic_ota().c_str());
    LOG_I("MQTT", "Subscribed: config/set command ota");
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
        LOG_I("MQTT", "Connected to %s:%d as %s",
              cfg.mqttHost, cfg.mqttPort, cfg.gatewayId);
        subscribe_all();
    } else {
        LOG_W("MQTT", "Connect failed rc=%d", s_mqtt.state());
    }
    return ok;
}

// --- Public API ----------------------------------------------

void mqtt_init() {
    task_trigger_now(s_reconnectTask);
}

void mqtt_loop() {
    if (s_mqtt.connected()) {
        s_mqtt.loop();
        return;
    }
    if (task_due(s_reconnectTask)) {
        do_connect();
    }
}

bool mqtt_connected() { return s_mqtt.connected(); }

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
