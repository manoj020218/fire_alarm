#pragma once
// ============================================================
// FireGuard — AsyncWebServer setup
// Port 80.  Routes in PART A:
//   GET /           → minimal status page (PROGMEM)
//   GET /api/status → JSON health snapshot
//   /update         → ElegantOTA
// PART B adds: provisioning, scan, test, register-map, config save
// ============================================================
#include <Arduino.h>

void webui_init();
void webui_loop();   // ElegantOTA requires a handle call in loop (some versions)
