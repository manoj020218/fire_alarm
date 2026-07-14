#pragma once
// ============================================================
// FireGuard — MQTT topic builders
// Canonical tree: fireguard/{siteId}/{gatewayId}/{leaf}
// Matches the backend MQTT handler expectations (CLAUDE.md §4).
// ============================================================
#include <Arduino.h>
#include "../config/config.h"

inline String topic(const char* leaf) {
    GatewayConfig& c = getConfig();
    String t = "fireguard/";
    t += c.siteId;
    t += '/';
    t += c.gatewayId;
    t += '/';
    t += leaf;
    return t;
}

// Publish topics (gateway → broker)
inline String topic_telemetry() { return topic("telemetry"); }
inline String topic_status()    { return topic("status");    }
inline String topic_alarm()     { return topic("alarm");     }
inline String topic_config_get(){ return topic("config/get");}

// Subscribe topics (broker → gateway)
inline String topic_config_set(){ return topic("config/set");}
inline String topic_command()   { return topic("command");   }
inline String topic_ota()       { return topic("ota");       }
