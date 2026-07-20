#pragma once
// ============================================================
// FireGuard — Compile-time defaults (overridable at runtime
// via WebUI → NVS).  Two profiles: dev / prod.
// Change DEFAULT_ENV to "prod" for production builds.
// ============================================================

// --- Environment profile ("dev" | "prod") -------------------
#define DEFAULT_ENV             "dev"

// --- MQTT broker --------------------------------------------
#define MQTT_HOST_PROD          "mqtt.iotsoft.in"
#define MQTT_HOST_DEV           "154.61.69.200"
#define MQTT_PORT_DEFAULT       1883
// Credentials: placeholders here; real creds in secrets.h or NVS
#define MQTT_USER_DEFAULT       ""
#define MQTT_PASS_DEFAULT       ""

// --- VPS API base -------------------------------------------
#define API_HOST_PROD           "fireguard.iotsoft.in"
#define API_HOST_DEV            "154.61.69.200"
#define API_BASE_PATH           "/api/fireguard"

// --- Gateway identity (derived from MAC at first boot) -------
#define GATEWAY_ID_PREFIX       "JNX-FG-"
#define SITE_ID_DEFAULT         "SITE001"

// --- Uplink / 4G --------------------------------------------
#define APN_DEFAULT             ""          // blank = modem auto

// --- WiFi AP provisioning portal ----------------------------
#define WIFI_AP_SSID_PREFIX     "JNX-FG-"  // + last 4 hex of MAC
#define WIFI_AP_CHANNEL         1
#define WIFI_STA_TIMEOUT_MS     15000

// --- Telemetry & status timers (ms) -------------------------
#define TELEMETRY_INTERVAL_MS   10000       // 10 s
#define STATUS_INTERVAL_MS      60000       // 60 s
#define MODBUS_POLL_INTERVAL_MS 5000        // 5 s
#define UPLINK_CHECK_INTERVAL_MS 30000      // 30 s reconnect check
#define OTA_CHECK_INTERVAL_MS   86400000UL  // daily (24 h)

// --- Modbus RS485 defaults ----------------------------------
#define MODBUS_BAUD_DEFAULT     9600
#define MODBUS_CONFIG_DEFAULT   SERIAL_8N1  // 8 data, none parity, 1 stop
#define MODBUS_TIMEOUT_MS       500
#define MODBUS_MAX_DEVICES      16

// --- Alarm thresholds (engineering units) -------------------
// These are firmware defaults; real thresholds live in NVS
// and are pushed from the cloud (config/set topic).
#define THRESHOLD_PRESSURE_LOW_WARN   2.5f   // bar
#define THRESHOLD_PRESSURE_LOW_CRIT   1.5f
#define THRESHOLD_PRESSURE_HIGH_WARN  10.0f
#define THRESHOLD_PRESSURE_HIGH_CRIT  12.0f
#define THRESHOLD_TANK_LEVEL_LOW_WARN 20.0f  // %
#define THRESHOLD_TANK_LEVEL_LOW_CRIT 10.0f
#define THRESHOLD_FUEL_LOW_WARN       20.0f  // %
#define THRESHOLD_FUEL_LOW_CRIT       10.0f
#define THRESHOLD_BATTERY_LOW_WARN    24.0f  // V
#define THRESHOLD_BATTERY_LOW_CRIT    22.0f

// --- SMS alerting defaults (Change 3) -----------------------
#define SMS_NUMBERS_DEFAULT     ""          // blank = none configured
#define SMS_ENABLED_DEFAULT     false       // off by default

// --- Cellular: LTE-only (JIO) mode --------------------------
#define LTE_ONLY_DEFAULT        false       // OFF = auto (all operators); ON = LTE-only (JIO)

// --- OTA / backup -------------------------------------------
#define OTA_VALIDATE_WINDOW_MS  300000      // 5 min self-validate window
#define HTTP_CLIENT_TIMEOUT_MS  15000
#define OTA_AUTO_DEFAULT        false       // require explicit trigger; manifest check is passive

// --- SD buffer ----------------------------------------------
#define SD_BUFFER_MAX_RECORDS   2000        // oldest-drop when full
