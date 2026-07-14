#pragma once
// ============================================================
// FireGuard — VPS API client
// Base URL: http(s)://{apiHost}/api/fireguard
// Auth headers: X-Gateway-Id + X-Gateway-Token (from NVS)
// Uses uplink's active Client via ArduinoHttpClient (works over 4G/LAN/WiFi).
// ============================================================
#include <Arduino.h>

struct ApiResponse {
    int    status;     // HTTP status code (0 = connection failed)
    char   body[512];  // response body (truncated at 511 chars)
};

// Must be called after config_load() and uplink_init().
void api_init();

// GET {apiBase}/{path}
// Returns ApiResponse with status and body.
ApiResponse api_get(const char* path);

// POST {apiBase}/{path} with JSON body.
// body must be null-terminated JSON string.
ApiResponse api_post(const char* path, const char* jsonBody);

// Token management (NVS key "fg_tok")
// Generated on first boot (32 hex chars), never reset on config_save().
const char* api_get_token();      // returns token string (persists across calls)
bool        api_token_exists();   // true if token already provisioned
void        api_generate_token(); // generate + store random 32-hex token
