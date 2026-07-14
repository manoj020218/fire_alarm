#pragma once
// ============================================================
// FireGuard — System health counters (uptime, heap, resets)
// ============================================================
#include <Arduino.h>

struct HealthCounters {
    uint32_t mqttReconnects;
    uint32_t uplinkSwitches;
    uint32_t modbusTimeouts;
    uint32_t modbusCrcErrors;
    uint32_t alarmsRaised;
    uint32_t sdWriteErrors;
    uint32_t otaAttempts;
};

void     health_init();
uint32_t health_uptime_s();
uint32_t health_free_heap();
uint32_t health_min_free_heap();
String   health_reset_reason();
HealthCounters& health_counters();

// Increment helpers
void health_inc_mqtt_reconnect();
void health_inc_uplink_switch();
void health_inc_modbus_timeout();
void health_inc_modbus_crc();
void health_inc_alarm_raised();
void health_inc_sd_write_error();
void health_inc_ota_attempt();
