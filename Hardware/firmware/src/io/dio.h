#pragma once
// ============================================================
// FireGuard — Digital I/O
// DI1–4 (GPIO 35,34,39,36): opto-isolated, ACTIVE LOW, no pull
// DO1–2 (GPIO 17,16): 3.3 V logic, drives external relay board
// ============================================================
#include <Arduino.h>

void dio_init();

// Read debounced DI (index 0–3).  Returns true = input asserted
bool di_read(uint8_t idx);

// Set DO (index 0–1).  true = HIGH (activate indication relay)
void do_set(uint8_t idx, bool state);
bool do_get(uint8_t idx);
