// ============================================================
// FireGuard — Alarm engine implementation
// Thresholds from GatewayConfig.  State persisted in NVS.
// One AlarmEvent slot per threshold tag.
// ============================================================
#include "engine.h"
#include "../config/config.h"
#include "../modbus/registers.h"
#include "../util/log.h"
#include "../util/health.h"
#include <Preferences.h>

#define MAX_ALARMS CONFIG_MAX_REGISTERS
static AlarmEvent   s_alarms[MAX_ALARMS] = {};
static uint8_t      s_count  = 0;
static Preferences  s_prefs;
static void (*s_publishCb)(const AlarmEvent& ev) = nullptr;
static bool        s_ready = false;

static bool has_enabled_registers() {
    GatewayConfig& cfg = getConfig();
    for (uint8_t i = 0; i < cfg.regCount; i++) {
        if (cfg.regs[i].enabled && cfg.regs[i].tag[0]) return true;
    }
    return false;
}

static bool threshold_has_enabled_register(const char* tag) {
    if (!tag || !tag[0]) return false;
    GatewayConfig& cfg = getConfig();
    for (uint8_t i = 0; i < cfg.regCount; i++) {
        if (cfg.regs[i].enabled && strcmp(cfg.regs[i].tag, tag) == 0) return true;
    }
    return false;
}

// ---- NVS persistence ----------------------------------------
static void save_state() {
    s_prefs.begin("fg_alm", false);
    for (uint8_t i = 0; i < s_count; i++) {
        char key[16];
        snprintf(key, sizeof(key), "a%d_ack", i);
        s_prefs.putBool(key, s_alarms[i].acknowledged);
        snprintf(key, sizeof(key), "a%d_act", i);
        s_prefs.putBool(key, s_alarms[i].active);
    }
    s_prefs.end();
}

static void load_state() {
    s_prefs.begin("fg_alm", true);
    for (uint8_t i = 0; i < s_count; i++) {
        char key[16];
        snprintf(key, sizeof(key), "a%d_ack", i);
        s_alarms[i].acknowledged = s_prefs.getBool(key, false);
        snprintf(key, sizeof(key), "a%d_act", i);
        s_alarms[i].active = s_prefs.getBool(key, false);
    }
    s_prefs.end();
}

// ---- Alarm slot management ----------------------------------
static AlarmEvent* find_or_create(const char* tag) {
    for (uint8_t i = 0; i < s_count; i++) {
        if (strcmp(s_alarms[i].tag, tag) == 0) return &s_alarms[i];
    }
    if (s_count >= MAX_ALARMS) return nullptr;
    AlarmEvent& a = s_alarms[s_count++];
    memset(&a, 0, sizeof(a));
    strlcpy(a.tag, tag, 24);
    return &a;
}

static void raise_alarm(AlarmEvent* a, const char* param,
                        float value, AlarmSeverity sev, uint32_t ts) {
    bool wasActive = a->active;
    a->active     = true;
    a->value      = value;
    a->severity   = sev;
    a->timestamp  = ts;
    a->acknowledged = false;
    strlcpy(a->parameter, param, 32);

    if (!wasActive) {
        // First-fire: publish immediately
        health_inc_alarm_raised();
        LOG_W("ALM", "ALARM %s  param=%s  val=%.2f  sev=%s",
              a->tag, param, value,
              sev == AlarmSeverity::CRITICAL ? "critical" : "warning");
        if (s_publishCb) s_publishCb(*a);
        save_state();
    }
}

static void clear_alarm(AlarmEvent* a, uint32_t ts) {
    if (!a->active) return;
    a->active    = false;
    a->timestamp = ts;
    LOG_I("ALM", "Cleared %s", a->tag);
    if (s_publishCb) s_publishCb(*a);
    save_state();
}

// ---- Public API ---------------------------------------------

void alarms_init() {
    GatewayConfig& cfg = getConfig();
    s_ready = false;
    s_count = 0;
    // Pre-create slots for configured thresholds
    for (uint8_t i = 0; i < cfg.thresholdCount; i++) {
        find_or_create(cfg.thresholds[i].tag);
    }
    // Also add system alarm slots
    find_or_create("rs485_bus");
    find_or_create("gateway_offline");

    load_state();
    if (!has_enabled_registers()) {
        LOG_I("ALM", "Field alarm monitoring disabled - no register map configured");
    }
    LOG_I("ALM", "Init  slotCount=%d", s_count);
}

void alarms_evaluate() {
    GatewayConfig& cfg = getConfig();
    uint32_t now = millis();  // RTC epoch injected in PART B
    RegReading* readings = modbus_readings();
    bool haveEnabledRegs = has_enabled_registers();

    for (uint8_t ti = 0; ti < cfg.thresholdCount; ti++) {
        AlarmThreshold& th = cfg.thresholds[ti];
        if (!th.enabled) continue;

        // Find matching reading
        float val  = 0;
        bool  online = false;
        bool  matched = false;
        for (uint8_t ri = 0; ri < cfg.regCount; ri++) {
            if (!cfg.regs[ri].enabled) continue;
            if (strcmp(readings[ri].tag, th.tag) == 0) {
                val    = readings[ri].value;
                online = readings[ri].online;
                matched = true;
                break;
            }
        }

        AlarmEvent* a = find_or_create(th.tag);
        if (!a) continue;

        if (!matched || !threshold_has_enabled_register(th.tag)) {
            clear_alarm(a, now);
            continue;
        }

        if (!online) {
            // Device offline alarm
            raise_alarm(a, "device_offline", 0, AlarmSeverity::CRITICAL, now);
            continue;
        }

        // Check thresholds (critical takes priority over warning)
        if (th.critLow  > 0 && val < th.critLow) {
            raise_alarm(a, "value_low_critical", val, AlarmSeverity::CRITICAL, now);
        } else if (th.warnLow > 0 && val < th.warnLow) {
            raise_alarm(a, "value_low_warning", val, AlarmSeverity::WARNING, now);
        } else if (th.critHigh > 0 && val > th.critHigh) {
            raise_alarm(a, "value_high_critical", val, AlarmSeverity::CRITICAL, now);
        } else if (th.warnHigh > 0 && val > th.warnHigh) {
            raise_alarm(a, "value_high_warning", val, AlarmSeverity::WARNING, now);
        } else {
            clear_alarm(a, now);
        }
    }

    // RS485 bus offline alarm
    AlarmEvent* busAlm = find_or_create("rs485_bus");
    if (busAlm) {
        if (!haveEnabledRegs) {
            clear_alarm(busAlm, now);
        } else {
            bool busOk = modbus_is_bus_ok();
            if (!busOk) raise_alarm(busAlm, "rs485_offline", 0, AlarmSeverity::CRITICAL, now);
            else         clear_alarm(busAlm, now);
        }
    }
    s_ready = true;
}

void alarms_ack(const char* tag) {
    for (uint8_t i = 0; i < s_count; i++) {
        if (strcmp(s_alarms[i].tag, tag) == 0) {
            s_alarms[i].acknowledged = true;
            LOG_I("ALM", "Ack'd %s", tag);
            save_state();
            return;
        }
    }
}

bool alarms_ready() {
    return s_ready;
}

bool alarms_any_active() {
    for (uint8_t i = 0; i < s_count; i++) {
        if (s_alarms[i].active) return true;
    }
    return false;
}

bool alarms_any_critical_active() {
    for (uint8_t i = 0; i < s_count; i++) {
        if (s_alarms[i].active && s_alarms[i].severity == AlarmSeverity::CRITICAL) {
            return true;
        }
    }
    return false;
}

bool alarms_any_unacknowledged_critical_active() {
    for (uint8_t i = 0; i < s_count; i++) {
        if (s_alarms[i].active &&
            s_alarms[i].severity == AlarmSeverity::CRITICAL &&
            !s_alarms[i].acknowledged) {
            return true;
        }
    }
    return false;
}

uint8_t alarms_active_count() {
    uint8_t n = 0;
    for (uint8_t i = 0; i < s_count; i++) {
        if (s_alarms[i].active) n++;
    }
    return n;
}

void alarms_set_publish_cb(void (*cb)(const AlarmEvent& ev)) { s_publishCb = cb; }

void alarms_fill_json(JsonArray& arr) {
    for (uint8_t i = 0; i < s_count; i++) {
        if (!s_alarms[i].active) continue;
        JsonObject o = arr.createNestedObject();
        // alarmId: tag + underscore + timestamp
        char id[40];
        snprintf(id, sizeof(id), "%s_%lu", s_alarms[i].tag, (unsigned long)s_alarms[i].timestamp);
        o["alarmId"]   = id;
        o["tag"]       = s_alarms[i].tag;
        o["parameter"] = s_alarms[i].parameter;
        o["value"]     = s_alarms[i].value;
        o["severity"]  = (s_alarms[i].severity == AlarmSeverity::CRITICAL) ? "critical" : "warning";
        o["timestamp"] = s_alarms[i].timestamp;
        o["acknowledged"] = s_alarms[i].acknowledged;
    }
}
