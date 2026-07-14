#pragma once
// ============================================================
// FireGuard WebUI — Modbus scan/read/register-map handlers
// ============================================================
#include <ESPAsyncWebServer.h>

void webui_register_modbus(AsyncWebServer* srv);
