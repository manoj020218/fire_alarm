// ============================================================
// FireGuard — Config NVS persistence (Preferences)
// Namespace "fg_cfg".  All primitives stored individually so
// the struct can grow without invalidating old NVS blobs.
// ============================================================
#include "config.h"
#include "../util/log.h"
#include <Preferences.h>
#include <WiFi.h>   // ESP.getEfuseMac()

static GatewayConfig s_cfg;
static Preferences   s_prefs;

GatewayConfig& getConfig() { return s_cfg; }

static uint64_t esp32_mac_raw() {
    return ESP.getEfuseMac();
}

static void format_gateway_id_from_mac(uint64_t mac, char* out, size_t outLen) {
    if (!out || outLen == 0) return;
    snprintf(out, outLen, "%s%04X", GATEWAY_ID_PREFIX,
             static_cast<uint16_t>(mac >> 32) ^ static_cast<uint16_t>(mac));
}

// ---- helper macros -----------------------------------------
#define STR_GET(k, dst, def)  strlcpy(dst, s_prefs.getString(k, def).c_str(), sizeof(dst))
#define INT_GET(k, dst, def)  dst = s_prefs.getUInt(k, def)

static void save_struct_arrays() {
    s_prefs.putUChar("regCnt", s_cfg.regCount);
    if (s_cfg.regCount > 0) {
        s_prefs.putBytes("regs", s_cfg.regs, s_cfg.regCount * sizeof(ModbusRegEntry));
    } else {
        s_prefs.remove("regs");
    }

    s_prefs.putUChar("thrCnt", s_cfg.thresholdCount);
    if (s_cfg.thresholdCount > 0) {
        s_prefs.putBytes("thrs", s_cfg.thresholds, s_cfg.thresholdCount * sizeof(AlarmThreshold));
    } else {
        s_prefs.remove("thrs");
    }
}

static void load_struct_arrays() {
    uint8_t regCount = s_prefs.getUChar("regCnt", s_cfg.regCount);
    if (regCount > CONFIG_MAX_REGISTERS) regCount = CONFIG_MAX_REGISTERS;
    size_t regBytes = s_prefs.getBytesLength("regs");
    if (regCount > 0 && regBytes >= regCount * sizeof(ModbusRegEntry)) {
        memset(s_cfg.regs, 0, sizeof(s_cfg.regs));
        s_prefs.getBytes("regs", s_cfg.regs, regCount * sizeof(ModbusRegEntry));
        s_cfg.regCount = regCount;
    }

    uint8_t thrCount = s_prefs.getUChar("thrCnt", s_cfg.thresholdCount);
    if (thrCount > CONFIG_MAX_REGISTERS) thrCount = CONFIG_MAX_REGISTERS;
    size_t thrBytes = s_prefs.getBytesLength("thrs");
    if (thrCount > 0 && thrBytes >= thrCount * sizeof(AlarmThreshold)) {
        memset(s_cfg.thresholds, 0, sizeof(s_cfg.thresholds));
        s_prefs.getBytes("thrs", s_cfg.thresholds, thrCount * sizeof(AlarmThreshold));
        s_cfg.thresholdCount = thrCount;
    }
}

static void load_defaults() {
    strlcpy(s_cfg.env,       DEFAULT_ENV,          sizeof(s_cfg.env));
    bool prod = (strcmp(s_cfg.env, "prod") == 0);
    strlcpy(s_cfg.mqttHost,  prod ? MQTT_HOST_PROD : MQTT_HOST_DEV, sizeof(s_cfg.mqttHost));
    s_cfg.mqttPort = MQTT_PORT_DEFAULT;
    strlcpy(s_cfg.mqttUser,  MQTT_USER_DEFAULT,    sizeof(s_cfg.mqttUser));
    strlcpy(s_cfg.mqttPass,  MQTT_PASS_DEFAULT,    sizeof(s_cfg.mqttPass));
    strlcpy(s_cfg.apiHost,   prod ? API_HOST_PROD : API_HOST_DEV, sizeof(s_cfg.apiHost));
    strlcpy(s_cfg.siteId,    SITE_ID_DEFAULT,      sizeof(s_cfg.siteId));
    strlcpy(s_cfg.gatewayId, "",                   sizeof(s_cfg.gatewayId));
    strlcpy(s_cfg.apn,       APN_DEFAULT,          sizeof(s_cfg.apn));
    s_cfg.modbusBaud             = MODBUS_BAUD_DEFAULT;
    s_cfg.modbusParity           = ModbusParity::NONE;  // SERIAL_8N1
    s_cfg.telemetryIntervalMs    = TELEMETRY_INTERVAL_MS;
    s_cfg.statusIntervalMs       = STATUS_INTERVAL_MS;
    s_cfg.modbusPollIntervalMs   = MODBUS_POLL_INTERVAL_MS;
    s_cfg.otaCheckIntervalMs     = OTA_CHECK_INTERVAL_MS;
    s_cfg.autoRebootHour         = 255;   // disabled
    s_cfg.otaAuto                = false;
    // SMS defaults (Change 3)
    strlcpy(s_cfg.smsNumbers, SMS_NUMBERS_DEFAULT, sizeof(s_cfg.smsNumbers));
    s_cfg.smsEnabled             = SMS_ENABLED_DEFAULT;
    s_cfg.callEnabled            = CALL_ENABLED_DEFAULT;
    s_cfg.lteOnly                = LTE_ONLY_DEFAULT;
    s_cfg.uplinkPref             = UPLINK_PREF_DEFAULT;
    s_cfg.regCount               = 0;
    s_cfg.thresholdCount         = 0;

    // Default thresholds
    s_cfg.thresholdCount = 2;
    memset(&s_cfg.thresholds[0], 0, sizeof(s_cfg.thresholds[0]));
    strlcpy(s_cfg.thresholds[0].tag, "sprinklerPressure", sizeof(s_cfg.thresholds[0].tag));
    s_cfg.thresholds[0].warnLow  = THRESHOLD_PRESSURE_LOW_WARN;
    s_cfg.thresholds[0].critLow  = THRESHOLD_PRESSURE_LOW_CRIT;
    s_cfg.thresholds[0].warnHigh = THRESHOLD_PRESSURE_HIGH_WARN;
    s_cfg.thresholds[0].critHigh = THRESHOLD_PRESSURE_HIGH_CRIT;
    s_cfg.thresholds[0].enabled  = true;

    memset(&s_cfg.thresholds[1], 0, sizeof(s_cfg.thresholds[1]));
    strlcpy(s_cfg.thresholds[1].tag, "waterTankLevel", sizeof(s_cfg.thresholds[1].tag));
    s_cfg.thresholds[1].warnLow  = THRESHOLD_TANK_LEVEL_LOW_WARN;
    s_cfg.thresholds[1].critLow  = THRESHOLD_TANK_LEVEL_LOW_CRIT;
    s_cfg.thresholds[1].warnHigh = 0;
    s_cfg.thresholds[1].critHigh = 0;
    s_cfg.thresholds[1].enabled  = true;
}

void config_load() {
    load_defaults();
    s_prefs.begin("fg_cfg", true);   // read-only first

    STR_GET("env",       s_cfg.env,       DEFAULT_ENV);
    bool prod = (strcmp(s_cfg.env, "prod") == 0);
    STR_GET("mqttHost",  s_cfg.mqttHost,  prod ? MQTT_HOST_PROD : MQTT_HOST_DEV);
    s_cfg.mqttPort = (uint16_t)s_prefs.getUInt("mqttPort", MQTT_PORT_DEFAULT);
    STR_GET("mqttUser",  s_cfg.mqttUser,  MQTT_USER_DEFAULT);
    STR_GET("mqttPass",  s_cfg.mqttPass,  MQTT_PASS_DEFAULT);
    STR_GET("apiHost",   s_cfg.apiHost,   prod ? API_HOST_PROD : API_HOST_DEV);
    STR_GET("siteId",    s_cfg.siteId,    SITE_ID_DEFAULT);
    STR_GET("gatewayId", s_cfg.gatewayId, "");
    STR_GET("apn",       s_cfg.apn,       APN_DEFAULT);
    INT_GET("modBaud",   s_cfg.modbusBaud,   MODBUS_BAUD_DEFAULT);
    s_cfg.modbusParity = (ModbusParity)s_prefs.getUChar("modParity", (uint8_t)ModbusParity::NONE);
    INT_GET("telMs",     s_cfg.telemetryIntervalMs,   TELEMETRY_INTERVAL_MS);
    INT_GET("statusMs",  s_cfg.statusIntervalMs,      STATUS_INTERVAL_MS);
    INT_GET("mbPollMs",  s_cfg.modbusPollIntervalMs,  MODBUS_POLL_INTERVAL_MS);
    INT_GET("otaMs",     s_cfg.otaCheckIntervalMs,    OTA_CHECK_INTERVAL_MS);
    s_cfg.autoRebootHour = s_prefs.getUChar("autoRbtH", 255);
    s_cfg.otaAuto        = s_prefs.getBool("otaAuto",  false);
    // SMS (Change 3)
    STR_GET("smsNums",   s_cfg.smsNumbers, SMS_NUMBERS_DEFAULT);
    s_cfg.smsEnabled  = s_prefs.getBool("smsEn", SMS_ENABLED_DEFAULT);
    s_cfg.callEnabled = s_prefs.getBool("callEn", CALL_ENABLED_DEFAULT);
    s_cfg.lteOnly     = s_prefs.getBool("lteOnly", LTE_ONLY_DEFAULT);
    s_cfg.uplinkPref  = s_prefs.getUChar("uplinkPref", UPLINK_PREF_DEFAULT);
    load_struct_arrays();

    s_prefs.end();

    config_derive_gateway_id();
    LOG_I("CFG", "Loaded. env=%s gw=%s site=%s mqtt=%s:%d",
          s_cfg.env, s_cfg.gatewayId, s_cfg.siteId,
          s_cfg.mqttHost, s_cfg.mqttPort);
}

void config_save() {
    s_prefs.begin("fg_cfg", false);  // read-write
    s_prefs.putString("env",       s_cfg.env);
    s_prefs.putString("mqttHost",  s_cfg.mqttHost);
    s_prefs.putUInt  ("mqttPort",  s_cfg.mqttPort);
    s_prefs.putString("mqttUser",  s_cfg.mqttUser);
    s_prefs.putString("mqttPass",  s_cfg.mqttPass);
    s_prefs.putString("apiHost",   s_cfg.apiHost);
    s_prefs.putString("siteId",    s_cfg.siteId);
    s_prefs.putString("gatewayId", s_cfg.gatewayId);
    s_prefs.putString("apn",       s_cfg.apn);
    s_prefs.putUInt  ("modBaud",   s_cfg.modbusBaud);
    s_prefs.putUChar ("modParity", (uint8_t)s_cfg.modbusParity);
    s_prefs.putUInt  ("telMs",     s_cfg.telemetryIntervalMs);
    s_prefs.putUInt  ("statusMs",  s_cfg.statusIntervalMs);
    s_prefs.putUInt  ("mbPollMs",  s_cfg.modbusPollIntervalMs);
    s_prefs.putUInt  ("otaMs",     s_cfg.otaCheckIntervalMs);
    s_prefs.putUChar ("autoRbtH",  s_cfg.autoRebootHour);
    s_prefs.putBool  ("otaAuto",   s_cfg.otaAuto);
    // SMS (Change 3)
    s_prefs.putString("smsNums",   s_cfg.smsNumbers);
    s_prefs.putBool  ("smsEn",     s_cfg.smsEnabled);
    s_prefs.putBool  ("callEn",    s_cfg.callEnabled);
    s_prefs.putBool  ("lteOnly",   s_cfg.lteOnly);
    s_prefs.putUChar ("uplinkPref", s_cfg.uplinkPref);
    save_struct_arrays();
    s_prefs.end();
    LOG_I("CFG", "Saved to NVS");
}

void config_reset_to_defaults() {
    s_prefs.begin("fg_cfg", false);
    s_prefs.clear();
    s_prefs.end();
    load_defaults();
    config_derive_gateway_id();
    LOG_W("CFG", "Factory reset — NVS cleared");
}

void config_derive_gateway_id() {
    if (strlen(s_cfg.gatewayId) == 0) {
        format_gateway_id_from_mac(esp32_mac_raw(), s_cfg.gatewayId, sizeof(s_cfg.gatewayId));
        LOG_I("CFG", "Derived gatewayId: %s", s_cfg.gatewayId);
    }
}

String config_factory_gateway_id() {
    char buf[24];
    format_gateway_id_from_mac(esp32_mac_raw(), buf, sizeof(buf));
    return String(buf);
}

String config_esp32_mac() {
    uint64_t mac = esp32_mac_raw();
    char buf[18];
    snprintf(buf, sizeof(buf), "%02X:%02X:%02X:%02X:%02X:%02X",
             static_cast<uint8_t>(mac >> 40), static_cast<uint8_t>(mac >> 32),
             static_cast<uint8_t>(mac >> 24), static_cast<uint8_t>(mac >> 16),
             static_cast<uint8_t>(mac >> 8), static_cast<uint8_t>(mac));
    return String(buf);
}

String config_ap_ssid() {
    if (strlen(s_cfg.gatewayId) >= 4) return String(s_cfg.gatewayId);
    return config_factory_gateway_id();
}

bool config_gateway_id_matches_factory() {
    return String(s_cfg.gatewayId) == config_factory_gateway_id();
}

// Apply SMS config pushed from the cloud (config/set) and persist to NVS.
void config_set_sms(const char* numbers, bool enabled) {
    if (numbers) strlcpy(s_cfg.smsNumbers, numbers, sizeof(s_cfg.smsNumbers));
    s_cfg.smsEnabled = enabled;
    config_save();
}

// Apply a pushed Modbus register map (from config/set customSettings.registers).
void config_set_registers(JsonArrayConst regs) {
    uint8_t n = 0;
    for (JsonObjectConst r : regs) {
        if (n >= CONFIG_MAX_REGISTERS) break;
        ModbusRegEntry& e = s_cfg.regs[n];
        e.slaveId = (uint8_t)(r["slaveId"] | 1);
        e.fc      = (uint8_t)(r["fc"]      | 3);
        e.regAddr = (uint16_t)(r["regAddr"] | 0);
        e.count   = (uint8_t)(r["count"]   | 1);
        e.scale   = (float)(r["scale"]     | 1.0);
        e.enabled = r["enabled"] | true;
        strlcpy(e.unit, r["unit"] | "raw", sizeof(e.unit));
        strlcpy(e.tag,  r["tag"]  | "",    sizeof(e.tag));
        n++;
    }
    s_cfg.regCount = n;
    config_save();
    LOG_I("CFG", "config/set: register map updated (%d devices)", n);
}
