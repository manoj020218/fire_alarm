#pragma once
// ============================================================
// FireGuard — MQTT client wrapper (single PubSubClient)
// Bound to uplink's active Client; reconnects on transport change.
// ============================================================
#include <Arduino.h>
#include <ArduinoJson.h>

void mqtt_init();
void mqtt_loop();                       // call every loop(); reconnect + keepalive
bool mqtt_connected();
bool mqtt_publish(const char* topic, const char* payload, bool retain = false);
bool mqtt_publish_json(const char* topic, JsonDocument& doc, bool retain = false);

// HTTP /ingest fallback (when MQTT down and API reachable)
bool mqtt_http_fallback_telemetry(const char* jsonPayload);

// HTTP /alarm fallback (when MQTT down and API reachable)
bool mqtt_http_fallback_alarm(const char* jsonPayload);

// Subscription callbacks — wired internally
typedef void (*MqttMessageCb)(const char* topic, const uint8_t* payload, unsigned int len);
void mqtt_set_message_cb(MqttMessageCb cb);
