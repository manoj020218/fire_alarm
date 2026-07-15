#pragma once
// ============================================================
// FireGuard WebUI — Config + factory reset handlers
// ============================================================
#include <ESPAsyncWebServer.h>

void webui_register_config(AsyncWebServer* srv);

// FIX 2: Deferred-reboot helpers (called from webui_loop)
void webui_config_schedule_reboot(uint32_t delayMs);
void webui_config_reboot_tick();
