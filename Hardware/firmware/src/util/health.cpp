// ============================================================
// FireGuard — Health implementation
// ============================================================
#include "health.h"
#include "log.h"
#include <esp_system.h>

static HealthCounters s_counters = {};
static uint32_t       s_bootMs   = 0;
static uint32_t       s_minHeap  = 0xFFFFFFFFu;

void health_init() {
    s_bootMs  = millis();
    s_minHeap = ESP.getFreeHeap();
    LOG_I("HEALTH", "Init. ResetReason: %s  FreeHeap: %u",
          health_reset_reason().c_str(), s_minHeap);
}

uint32_t health_uptime_s() {
    return (millis() - s_bootMs) / 1000;
}

uint32_t health_free_heap() {
    uint32_t h = ESP.getFreeHeap();
    if (h < s_minHeap) s_minHeap = h;
    return h;
}

uint32_t health_min_free_heap() { return s_minHeap; }

String health_reset_reason() {
    switch (esp_reset_reason()) {
        case ESP_RST_POWERON:  return "power_on";
        case ESP_RST_EXT:      return "external";
        case ESP_RST_SW:       return "software";
        case ESP_RST_PANIC:    return "panic";
        case ESP_RST_INT_WDT:  return "int_wdt";
        case ESP_RST_TASK_WDT: return "task_wdt";
        case ESP_RST_WDT:      return "wdt";
        case ESP_RST_DEEPSLEEP:return "deep_sleep";
        case ESP_RST_BROWNOUT: return "brownout";
        case ESP_RST_SDIO:     return "sdio";
        default:               return "unknown";
    }
}

HealthCounters& health_counters() { return s_counters; }

void health_inc_mqtt_reconnect()  { s_counters.mqttReconnects++; }
void health_inc_uplink_switch()   { s_counters.uplinkSwitches++;  }
void health_inc_modbus_timeout()  { s_counters.modbusTimeouts++;  }
void health_inc_modbus_crc()      { s_counters.modbusCrcErrors++; }
void health_inc_alarm_raised()    { s_counters.alarmsRaised++;    }
void health_inc_sd_write_error()  { s_counters.sdWriteErrors++;   }
void health_inc_ota_attempt()     { s_counters.otaAttempts++;     }
