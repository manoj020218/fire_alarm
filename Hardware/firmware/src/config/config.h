#pragma once
// ============================================================
// FireGuard — Runtime config struct persisted to NVS
// All fields have compile-time defaults from defaults.h.
// WebUI + MQTT config/set can override at runtime.
// ============================================================
#include <Arduino.h>
#include <ArduinoJson.h>
#include "defaults.h"

// Maximum number of Modbus register map entries
#define CONFIG_MAX_REGISTERS  32

// Modbus parity codes (avoids storing raw SerialConfig enum which is platform-width)
enum class ModbusParity : uint8_t { NONE = 0, EVEN = 1, ODD = 2 };
// Map to SerialConfig: NONE→SERIAL_8N1, EVEN→SERIAL_8E1, ODD→SERIAL_8O1
inline uint32_t modbus_parity_to_serial_config(ModbusParity p) {
    switch (p) {
        case ModbusParity::EVEN: return SERIAL_8E1;
        case ModbusParity::ODD:  return SERIAL_8O1;
        default:                 return SERIAL_8N1;
    }
}

// ---- Modbus register map entry ------------------------------
struct ModbusRegEntry {
    uint8_t  slaveId;     // 1–247
    uint8_t  fc;          // 3 = Read Holding, 4 = Read Input
    uint16_t regAddr;     // register address (0-based)
    uint8_t  count;       // number of 16-bit registers
    float    scale;       // raw × scale = engineering value
    char     unit[8];     // "bar", "%", "V", etc.
    char     tag[24];     // e.g. "sprinklerPressure"
    bool     enabled;
};

// ---- Alarm threshold entry ----------------------------------
struct AlarmThreshold {
    char  tag[24];
    float warnLow;
    float critLow;
    float warnHigh;
    float critHigh;
    bool  enabled;
};

// ---- Main config struct -------------------------------------
struct GatewayConfig {
    // Environment profile
    char env[8];            // "dev" | "prod"

    // MQTT
    char mqttHost[64];
    uint16_t mqttPort;
    char mqttUser[32];
    char mqttPass[32];

    // VPS API
    char apiHost[64];

    // Identity
    char siteId[32];
    char gatewayId[24];

    // 4G / Uplink
    char apn[32];

    // Modbus
    uint32_t modbusBaud;
    ModbusParity modbusParity;  // stored as enum; mapped to SerialConfig in modbus_init()

    // WiFi STA (stored in fg_wifi NVS namespace to avoid config bloat)
    // wifiSsid / wifiPass live in NVS "fg_wifi" — not in this struct

    // SMS alerting (Change 3)
    char smsNumbers[64];  // comma-separated E.164 numbers, e.g. "+9172...,+9198..."
    bool smsEnabled;      // master switch; default false
    bool callEnabled;     // voice call alerts master switch; shares smsNumbers roster

    // Cellular: force LTE-only network mode. Turn ON for JIO (LTE/VoLTE-only —
    // won't attach in auto mode). Leave OFF (auto: 2G/3G/4G) for Airtel/VI/BSNL.
    bool lteOnly;         // default false

    // Uplink preference: 0=Auto (SIM-first, cloud-failover), 1=WiFi/LAN first,
    // 2=SIM(4G) only, 3=WiFi only. Applied by uplink probe.
    uint8_t uplinkPref;   // default 0 (Auto)

    // Hardening
    uint8_t  autoRebootHour;   // hour (0-23) for daily auto-reboot; 255 = disabled
    bool     otaAuto;          // auto-apply OTA when manifest has update

    // Intervals (ms)
    uint32_t telemetryIntervalMs;
    uint32_t statusIntervalMs;
    uint32_t modbusPollIntervalMs;
    uint32_t otaCheckIntervalMs;

    // Register map
    ModbusRegEntry regs[CONFIG_MAX_REGISTERS];
    uint8_t        regCount;

    // Thresholds
    AlarmThreshold thresholds[CONFIG_MAX_REGISTERS];
    uint8_t        thresholdCount;
};

// ---- Accessor -----------------------------------------------
// Call config_load() once at boot; config_save() after any change.
GatewayConfig& getConfig();
void config_load();                     // NVS → struct (fills defaults on first boot)
void config_save();                     // struct → NVS
void config_reset_to_defaults();        // factory reset (clears NVS namespace)
void config_derive_gateway_id();        // build "JNX-FG-XXXX" from MAC if blank
void config_set_sms(const char* numbers, bool enabled);  // apply pushed SMS config + persist
// Apply a pushed Modbus register map (config/set customSettings.registers) + persist.
void config_set_registers(JsonArrayConst regs);
