#pragma once
// ============================================================
// FireGuard WebUI — SMS alert handler (Change 3)
// POST /api/sms/test  — send test SMS to first configured number
// ============================================================
#include <ESPAsyncWebServer.h>

void webui_register_sms(AsyncWebServer* srv);
