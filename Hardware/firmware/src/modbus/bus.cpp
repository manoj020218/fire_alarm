// ============================================================
// FireGuard — Modbus RTU master (Serial2, ModbusMaster lib)
// RS485: RX=32 TX=33  DE/RE=PIN_RS485_DE_RE (default -1 = auto)
// One device polled per modbus_poll() call to avoid blocking loop.
// ============================================================
#include "registers.h"
#include "../config/pins.h"
#include "../config/config.h"
#include "../util/log.h"
#include "../util/health.h"
#include <ModbusMaster.h>

static ModbusMaster s_node;
static uint8_t      s_pollIdx   = 0;
static uint32_t     s_timeouts  = 0;
static uint32_t     s_crcErrors = 0;
static bool         s_busOk     = false;

// FIX 4: per-slot last-warn timestamp; throttle timeout log to once per 60 s per slot
#define MB_WARN_THROTTLE_MS 60000UL
static uint32_t s_lastWarnMs[CONFIG_MAX_REGISTERS] = {};

// Readings array (static, bounded by CONFIG_MAX_REGISTERS)
static RegReading s_readings[CONFIG_MAX_REGISTERS] = {};

// DE/RE pin control (only wired if PIN_RS485_DE_RE >= 0)
#if PIN_RS485_DE_RE >= 0
static void pre_tx()  { digitalWrite(PIN_RS485_DE_RE, HIGH); }
static void post_tx() { digitalWrite(PIN_RS485_DE_RE, LOW);  }
#endif

bool modbus_init() {
    GatewayConfig& cfg = getConfig();
    uint32_t sc = modbus_parity_to_serial_config(cfg.modbusParity);
    Serial2.begin(cfg.modbusBaud, (uint32_t)sc, PIN_RS485_RX, PIN_RS485_TX);
    Serial2.setTimeout(MODBUS_TIMEOUT_MS);  // Stream timeout for ModbusMaster reads

#if PIN_RS485_DE_RE >= 0
    pinMode(PIN_RS485_DE_RE, OUTPUT);
    digitalWrite(PIN_RS485_DE_RE, LOW);
    s_node.preTransmission(pre_tx);
    s_node.postTransmission(post_tx);
    LOG_I("MB", "DE/RE GPIO %d enabled", PIN_RS485_DE_RE);
#else
    LOG_I("MB", "Auto-direction (no DE/RE pin)");
#endif

    // Initialise readings from config
    for (uint8_t i = 0; i < cfg.regCount && i < CONFIG_MAX_REGISTERS; i++) {
        strlcpy(s_readings[i].tag, cfg.regs[i].tag, 24);
        s_readings[i].value  = 0.0f;
        s_readings[i].online = false;
        s_readings[i].lastUpdateMs = 0;
    }

    s_busOk = true;
    LOG_I("MB", "Init OK baud=%lu regCount=%d", cfg.modbusBaud, cfg.regCount);
    return true;
}

void modbus_poll() {
    GatewayConfig& cfg = getConfig();
    if (cfg.regCount == 0) return;

    // Advance to next register in config (round-robin, one per call)
    if (s_pollIdx >= cfg.regCount) s_pollIdx = 0;
    const ModbusRegEntry& r = cfg.regs[s_pollIdx];
    if (!r.enabled) { s_pollIdx++; return; }

    s_node.begin(r.slaveId, Serial2);
    // ModbusMaster v2 has no setTimeout(); timeout is controlled by
    // the underlying Stream (Serial2) which uses its own timeout.
    // We track stale readings via lastUpdateMs instead (see below).

    uint8_t result;
    if (r.fc == 3) {
        result = s_node.readHoldingRegisters(r.regAddr, r.count);
    } else if (r.fc == 4) {
        result = s_node.readInputRegisters(r.regAddr, r.count);
    } else {
        LOG_W("MB", "Unknown FC %d for tag %s", r.fc, r.tag);
        s_pollIdx++;
        return;
    }

    if (result == s_node.ku8MBSuccess) {
        // Combine up to 2 registers (16-bit words)
        uint32_t raw = s_node.getResponseBuffer(0);
        if (r.count >= 2) {
            raw = (raw << 16) | s_node.getResponseBuffer(1);
        }
        float eng = (float)raw * r.scale;

        s_readings[s_pollIdx].value        = eng;
        s_readings[s_pollIdx].online       = true;
        s_readings[s_pollIdx].lastUpdateMs = millis();
        s_lastWarnMs[s_pollIdx]            = 0;  // reset throttle on success

        LOG_D("MB", "Poll[%d] tag=%s slave=%d raw=%lu val=%.2f %s",
              s_pollIdx, r.tag, r.slaveId, raw, eng, r.unit);
        s_busOk = true;
    } else {
        bool isTimeout = (result == s_node.ku8MBResponseTimedOut);
        if (isTimeout) {
            s_timeouts++;
            health_inc_modbus_timeout();
            // FIX 4: throttle per-slot timeout log to once per 60 s
            uint32_t now = millis();
            if (s_lastWarnMs[s_pollIdx] == 0 ||
                (now - s_lastWarnMs[s_pollIdx]) >= MB_WARN_THROTTLE_MS) {
                LOG_W("MB", "Timeout slave=%d reg=%d (count=%lu)",
                      r.slaveId, r.regAddr, s_timeouts);
                s_lastWarnMs[s_pollIdx] = now;
            }
        } else {
            s_crcErrors++;
            health_inc_modbus_crc();
            uint32_t now = millis();
            if (s_lastWarnMs[s_pollIdx] == 0 ||
                (now - s_lastWarnMs[s_pollIdx]) >= MB_WARN_THROTTLE_MS) {
                LOG_W("MB", "CRC/err=%02X slave=%d reg=%d", result, r.slaveId, r.regAddr);
                s_lastWarnMs[s_pollIdx] = now;
            }
        }
        // Mark offline if no update for 3× timeout period
        if (millis() - s_readings[s_pollIdx].lastUpdateMs > (uint32_t)MODBUS_TIMEOUT_MS * 3) {
            s_readings[s_pollIdx].online = false;
        }
    }

    s_pollIdx++;
}

RegReading* modbus_readings()      { return s_readings; }
bool        modbus_is_bus_ok()     { return s_busOk; }
uint32_t    modbus_timeout_count() { return s_timeouts; }
uint32_t    modbus_crc_error_count(){ return s_crcErrors; }
