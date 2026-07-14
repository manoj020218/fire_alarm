#pragma once
// ============================================================
// FireGuard WebUI — Shared admin-auth helper declaration
// Implemented in server.cpp (single definition).
// ============================================================
#include <ESPAsyncWebServer.h>

// Returns true if request carries a valid admin token
// (or no password has been set yet — open mode).
bool webui_check_admin(AsyncWebServerRequest* req);
