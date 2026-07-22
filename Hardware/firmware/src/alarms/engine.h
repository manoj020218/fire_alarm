#pragma once
// ============================================================
// FireGuard — Alarm engine
// Evaluates thresholds from config, deduplicates, publishes
// immediately via MQTT, retains state in NVS.
// ============================================================
#include <Arduino.h>

enum class AlarmSeverity { WARNING, CRITICAL };

struct AlarmEvent {
    char     tag[24];
    char     parameter[32];
    float    value;
    AlarmSeverity severity;
    uint32_t timestamp;     // Unix epoch or millis if RTC unavailable
    bool     active;        // true = raised, false = cleared
    bool     acknowledged;
};

void   alarms_init();
void   alarms_evaluate();   // call from scheduler; checks modbus readings + DI state
void   alarms_ack(const char* tag);
bool   alarms_ready();
bool   alarms_any_active();
bool   alarms_any_critical_active();
bool   alarms_any_unacknowledged_critical_active();
uint8_t alarms_active_count();
void   alarms_set_publish_cb(void (*cb)(const AlarmEvent& ev));

// Fill a JSON array with all active alarms (used by WebUI)
#include <ArduinoJson.h>
void   alarms_fill_json(JsonArray& arr);
