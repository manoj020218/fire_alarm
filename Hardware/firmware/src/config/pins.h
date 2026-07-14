#pragma once
// ============================================================
// FireGuard — Vajruino VVM401 pin assignments
// Source of truth: vendor Examples + Vajruino.pdf datasheet
// DO NOT change without matching the physical board
// ============================================================

// --- 4G Modem: SIMCOM A7672S (TinyGSM as SIM7600) -----------
#define PIN_4G_RX       27
#define PIN_4G_TX       26
#define PIN_4G_PWR_KEY   4

// --- RS485 / Modbus-RTU (Serial2) ----------------------------
// Shared with RS232 via physical jumper — set jumper to RS485
#define PIN_RS485_RX    32
#define PIN_RS485_TX    33
// Auto-direction board: no dedicated DE/RE in vendor code.
// If a DE/RE pad is found on the delivered unit, set this to
// the physical GPIO; otherwise leave -1 (hardware auto-dir).
#define PIN_RS485_DE_RE  -1

// --- Status LED -----------------------------------------------
#define PIN_LED         12      // Active HIGH, onboard

// --- Digital Inputs (opto-isolated, ACTIVE LOW, no pull) -----
#define PIN_DI1         35
#define PIN_DI2         34
#define PIN_DI3         39
#define PIN_DI4         36
#define DI_COUNT         4

// --- Digital Outputs (3.3 V logic, non-isolated) -------------
// Drive external relay board for fault lamp / buzzer — NEVER
// actuate fire equipment directly (locked §0.2 of FW plan).
#define PIN_DO1         17
#define PIN_DO2         16

// --- Ethernet W5500 (VSPI) -----------------------------------
#define PIN_ETH_CS       5
#define PIN_ETH_RST     25
// VSPI defaults: MOSI=23, MISO=19, SCK=18 (hardware SPI)

// --- SD card (HSPI) ------------------------------------------
#define PIN_SD_CS       15
#define PIN_SD_CLK      14
#define PIN_SD_MOSI     13
#define PIN_SD_MISO      2

// --- I2C (DS3231 RTC @ 0x68 + EEPROM @ 0x57) ---------------
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22
#define I2C_ADDR_RTC    0x68
#define I2C_ADDR_EEPROM 0x57
