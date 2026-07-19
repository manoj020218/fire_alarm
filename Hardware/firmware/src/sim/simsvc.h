#pragma once
// ============================================================
// FireGuard — SIM/cellular on-demand service.
// The MQTT command handler queues a request (fast, non-blocking);
// simsvc_step() runs the blocking AT work in the main loop and
// publishes the result to fireguard/{site}/{gw}/sim.
// ============================================================
#include <Arduino.h>

// Queue an on-demand SIM command. command ∈ {sim_info, read_sms, ussd, test_sms}.
// code   — USSD code (for 'ussd'); may be empty.
// number — recipient (for 'test_sms'); may be empty.
void simsvc_request(const char* command, const char* code, const char* number);

// Call every loop tick. Executes a pending request, if any.
void simsvc_step();
