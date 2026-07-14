#pragma once
// ============================================================
// FireGuard — Modbus register result (current live readings)
// The static register MAP lives in GatewayConfig::regs[] (NVS).
// This struct holds the most-recently-polled engineering values.
// ============================================================
#include <Arduino.h>
#include "../config/config.h"

struct RegReading {
    char     tag[24];
    float    value;
    bool     online;        // false = timeout / CRC error
    uint32_t lastUpdateMs;
};

// Access the live readings array (length = getConfig().regCount)
RegReading* modbus_readings();

// Modbus bus init & poll
bool modbus_init();
void modbus_poll();     // non-blocking poll one device per call; call from scheduler
bool modbus_is_bus_ok();

// Per-device counters (aggregate; per-tag in readings array)
uint32_t modbus_timeout_count();
uint32_t modbus_crc_error_count();
