// ============================================================
// FireGuard — VPS API client implementation
// Uses ArduinoHttpClient over uplink_get_client() so HTTP
// works on ALL uplinks (4G/TinyGSM, LAN/WIZnet, WiFi/lwIP).
// Bounded buffers; single request per call.
// ============================================================
#include "apiclient.h"
#include "uplink.h"
#include "../config/config.h"
#include "../config/defaults.h"
#include "../config/build_info.h"
#include "../util/log.h"
#include <ArduinoHttpClient.h>
#include <Preferences.h>

static char s_token[33] = {};  // 32 hex + NUL
static bool s_tokenLoaded = false;

// ---- Token management ---------------------------------------

void api_generate_token() {
    // Generate 16 random bytes -> 32 hex chars
    uint8_t rnd[16];
    esp_fill_random(rnd, sizeof(rnd));
    char buf[33];
    for (int i = 0; i < 16; i++) {
        snprintf(buf + i * 2, 3, "%02x", rnd[i]);
    }
    buf[32] = '\0';

    Preferences prefs;
    prefs.begin("fg_tok", false);
    prefs.putString("token", buf);
    prefs.end();

    strlcpy(s_token, buf, sizeof(s_token));
    s_tokenLoaded = true;
    LOG_I("API", "Device token generated (first boot)");
}

const char* api_get_token() {
    if (!s_tokenLoaded) {
        Preferences prefs;
        prefs.begin("fg_tok", true);
        String t = prefs.getString("token", "");
        prefs.end();
        if (t.length() == 32) {
            strlcpy(s_token, t.c_str(), sizeof(s_token));
        } else {
            s_token[0] = '\0';
        }
        s_tokenLoaded = true;
    }
    return s_token;
}

bool api_token_exists() {
    return strlen(api_get_token()) == 32;
}

void api_init() {
    if (!api_token_exists()) {
        api_generate_token();
    }
    LOG_I("API", "Init  token=%.*s...", 8, api_get_token());
}

// ---- Parse host and port from apiHost -----------------------
// apiHost may be "hostname", "hostname:port", "1.2.3.4", or "1.2.3.4:port".
// Default port is 80.
static void parse_host_port(const char* apiHost, char* host, size_t hostLen, int* port) {
    *port = 80;  // default for plain HTTP

    // Look for a colon that is NOT part of an IPv6 address.
    // For simplicity: if there are multiple colons it's IPv6 — no port parsing.
    const char* colon = strchr(apiHost, ':');
    const char* colon2 = colon ? strchr(colon + 1, ':') : nullptr;

    if (colon && !colon2) {
        // Single colon → "host:port"
        size_t hostPartLen = (size_t)(colon - apiHost);
        if (hostPartLen >= hostLen) hostPartLen = hostLen - 1;
        memcpy(host, apiHost, hostPartLen);
        host[hostPartLen] = '\0';
        int p = atoi(colon + 1);
        if (p > 0 && p <= 65535) *port = p;
    } else {
        // No port or IPv6 — copy as-is
        strlcpy(host, apiHost, hostLen);
    }
}

// ---- Build API path -----------------------------------------
// Writes API_BASE_PATH + path into out[outLen].
static void build_path(const char* path, char* out, size_t outLen) {
    snprintf(out, outLen, "%s%s", API_BASE_PATH, path);
}

// ---- Drain response body into bounded buffer ----------------
// Reads up to (bufLen-1) bytes from the ArduinoHttpClient body.
static void drain_body(HttpClient& http, char* buf, size_t bufLen) {
    size_t pos = 0;
    // Wait briefly for body to arrive (ArduinoHttpClient buffers internally)
    // responseStatusCode() has already been called by the caller; body follows.
    while (pos < bufLen - 1) {
        int avail = http.available();
        if (avail <= 0) {
            // Give the transport up to ~200 ms to deliver more bytes
            uint32_t t0 = millis();
            while (http.available() == 0 && (millis() - t0) < 200) {
                delay(5);
            }
            avail = http.available();
            if (avail <= 0) break;
        }
        size_t want = (size_t)avail;
        if (want > bufLen - 1 - pos) want = bufLen - 1 - pos;
        int got = http.readBytes((uint8_t*)(buf + pos), want);
        if (got <= 0) break;
        pos += (size_t)got;
    }
    buf[pos] = '\0';
    // Flush any remaining bytes so the connection is clean
    while (http.available()) http.read();
}

// ---- GET ----------------------------------------------------

ApiResponse api_get(const char* path) {
    ApiResponse resp = {0, ""};
    if (!uplink_is_up()) {
        strlcpy(resp.body, "no_uplink", sizeof(resp.body));
        return resp;
    }

    GatewayConfig& cfg = getConfig();
    char host[68];
    int  port;
    parse_host_port(cfg.apiHost, host, sizeof(host), &port);

    char fullPath[192];
    build_path(path, fullPath, sizeof(fullPath));

    HttpClient http(uplink_get_http_client(), host, port);
    http.setTimeout(HTTP_CLIENT_TIMEOUT_MS);
    http.connectionKeepAlive();  // reuse TCP if transport supports it

    http.beginRequest();
    http.get(fullPath);
    http.sendHeader("X-Gateway-Id",    cfg.gatewayId);
    http.sendHeader("X-Gateway-Token", api_get_token());
    http.sendHeader("Connection",      "close");
    http.endRequest();

    int code = http.responseStatusCode();
    resp.status = code;
    if (code > 0) {
        http.skipResponseHeaders();   // MUST skip headers or the body buffer gets them
        drain_body(http, resp.body, sizeof(resp.body));
    } else {
        snprintf(resp.body, sizeof(resp.body), "err=%d", code);
    }
    http.stop();

    LOG_D("API", "GET %s%s -> %d", host, fullPath, resp.status);
    return resp;
}

// ---- Register device token with VPS -------------------------
// POST /api/fireguard/register {gatewayId, token, hw, fw}
// Teaches the VPS this gateway's self-generated token so /backup (and other
// device-authed calls) will authenticate. Idempotent on the backend.
bool api_register() {
    GatewayConfig& cfg = getConfig();
    char body[256];
    snprintf(body, sizeof(body),
             "{\"gatewayId\":\"%s\",\"token\":\"%s\",\"hw\":\"%s\",\"fw\":\"%s\"}",
             cfg.gatewayId, api_get_token(), HW_REVISION, FW_VERSION);

    ApiResponse resp = api_post("/register", body);
    if (resp.status == 200) {
        LOG_I("API", "Registered with VPS (token accepted)");
        return true;
    }
    LOG_W("API", "Register failed: HTTP %d %s", resp.status, resp.body);
    return false;
}

// ---- POST ---------------------------------------------------

ApiResponse api_post(const char* path, const char* jsonBody) {
    ApiResponse resp = {0, ""};
    if (!uplink_is_up()) {
        strlcpy(resp.body, "no_uplink", sizeof(resp.body));
        return resp;
    }

    GatewayConfig& cfg = getConfig();
    char host[68];
    int  port;
    parse_host_port(cfg.apiHost, host, sizeof(host), &port);

    char fullPath[192];
    build_path(path, fullPath, sizeof(fullPath));

    size_t bodyLen = strlen(jsonBody);

    HttpClient http(uplink_get_http_client(), host, port);
    http.setTimeout(HTTP_CLIENT_TIMEOUT_MS);
    http.connectionKeepAlive();

    http.beginRequest();
    http.post(fullPath);
    http.sendHeader("X-Gateway-Id",    cfg.gatewayId);
    http.sendHeader("X-Gateway-Token", api_get_token());
    http.sendHeader("Content-Type",    "application/json");
    http.sendHeader("Connection",      "close");
    http.sendHeader("Content-Length",  bodyLen);
    http.beginBody();
    http.print(jsonBody);
    http.endRequest();

    int code = http.responseStatusCode();
    resp.status = code;
    if (code > 0) {
        http.skipResponseHeaders();   // MUST skip headers or the body buffer gets them
        drain_body(http, resp.body, sizeof(resp.body));
    } else {
        snprintf(resp.body, sizeof(resp.body), "err=%d", code);
    }
    http.stop();

    LOG_D("API", "POST %s%s -> %d", host, fullPath, resp.status);
    return resp;
}
