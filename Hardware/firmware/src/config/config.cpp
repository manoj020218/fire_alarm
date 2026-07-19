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

// ---- helper macros -----------------------------------------
#define STR_GET(k, dst, def)  strlcpy(dst, s_prefs.getString(k, def).c_str(), sizeof(dst))
#define INT_GET(k, dst, def)  dst = s_prefs.getUInt(k, def)

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
    s_cfg.regCount               = 0;
    s_cfg.thresholdCount         = 0;

    // Seed a small default register map
    s_cfg.regCount = 1;
    memset(&s_cfg.regs[0], 0, sizeof(s_cfg.regs[0]));
    s_cfg.regs[0].slaveId = 1;
    s_cfg.regs[0].fc      = 3;
    s_cfg.regs[0].regAddr = 0;
    s_cfg.regs[0].count   = 1;
    s_cfg.regs[0].scale   = 1.0f;
    s_cfg.regs[0].enabled = true;
    strlcpy(s_cfg.regs[0].unit, "raw",        sizeof(s_cfg.regs[0].unit));
    strlcpy(s_cfg.regs[0].tag,  "jockeyPump", sizeof(s_cfg.regs[0].tag));

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
    s_cfg.smsEnabled = s_prefs.getBool("smsEn", SMS_ENABLED_DEFAULT);

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
        uint64_t mac = ESP.getEfuseMac();
        snprintf(s_cfg.gatewayId, sizeof(s_cfg.gatewayId),
                 "%s%04X", GATEWAY_ID_PREFIX, (uint16_t)(mac >> 32) ^ (uint16_t)(mac));
        LOG_I("CFG", "Derived gatewayId: %s", s_cfg.gatewayId);
    }
}

// Apply SMS config pushed from the cloud (config/set) and persist to NVS.
void config_set_sms(const char* numbers, bool enabled) {
    if (numbers) strlcpy(s_cfg.smsNumbers, numbers, sizeof(s_cfg.smsNumbers));
    s_cfg.smsEnabled = enabled;
    config_save();
}
