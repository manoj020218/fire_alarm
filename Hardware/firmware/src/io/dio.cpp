// ============================================================
// FireGuard — DI/DO implementation
// DI active-low with 20 ms debounce (two consecutive reads).
// ============================================================
#include "dio.h"
#include "../config/pins.h"
#include "../util/log.h"

static const uint8_t DI_PINS[DI_COUNT] = { PIN_DI1, PIN_DI2, PIN_DI3, PIN_DI4 };
static const uint8_t DO_PINS[2]        = { PIN_DO1, PIN_DO2 };

// Debounce state
static bool     s_di_state[DI_COUNT]   = {};
static bool     s_di_raw_prev[DI_COUNT]= {};
static uint32_t s_di_changed_ms[DI_COUNT] = {};
#define DI_DEBOUNCE_MS 20

static bool s_do_state[2] = {};

void dio_init() {
    for (uint8_t i = 0; i < DI_COUNT; i++) {
        // Input-only GPIOs (35,34,39,36) cannot use INPUT_PULLUP
        pinMode(DI_PINS[i], INPUT);
        s_di_state[i] = false;
        s_di_raw_prev[i] = true;   // resting HIGH (active-low opto)
    }
    for (uint8_t i = 0; i < 2; i++) {
        pinMode(DO_PINS[i], OUTPUT);
        digitalWrite(DO_PINS[i], LOW);
        s_do_state[i] = false;
    }
    LOG_I("DIO", "Init OK  DI pins: 35,34,39,36  DO pins: 17,16");
}

bool di_read(uint8_t idx) {
    if (idx >= DI_COUNT) return false;
    // Raw: LOW = active (active-low opto-isolated input)
    bool raw_active = (digitalRead(DI_PINS[idx]) == LOW);
    uint32_t now = millis();
    if (raw_active != s_di_raw_prev[idx]) {
        // Edge detected — start debounce timer
        s_di_changed_ms[idx] = now;
        s_di_raw_prev[idx]   = raw_active;
    } else if ((now - s_di_changed_ms[idx]) >= DI_DEBOUNCE_MS) {
        s_di_state[idx] = raw_active;
    }
    return s_di_state[idx];
}

void do_set(uint8_t idx, bool state) {
    if (idx >= 2) return;
    s_do_state[idx] = state;
    digitalWrite(DO_PINS[idx], state ? HIGH : LOW);
    LOG_D("DIO", "DO%d = %s", idx + 1, state ? "ON" : "OFF");
}

bool do_get(uint8_t idx) {
    if (idx >= 2) return false;
    return s_do_state[idx];
}
