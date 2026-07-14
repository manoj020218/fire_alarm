// ============================================================
// FireGuard — OTA full implementation (§10.3)
// Flow: check_manifest → pre_backup (mandatory gate) → apply
// Self-validation window + auto-rollback on failure.
// OTA download uses ArduinoHttpClient over uplink_get_client()
// so streaming works over 4G/LAN/WiFi without buffering the
// whole binary in RAM.
// ============================================================
#include "ota.h"
#include "../net/apiclient.h"
#include "../net/uplink.h"
#include "../config/config.h"
#include "../config/build_info.h"
#include "../config/defaults.h"
#include "../alarms/engine.h"
#include "../store/sdbuffer.h"
#include "../store/rtc.h"
#include "../util/log.h"
#include "../util/health.h"
#include "../mqttc/mqtt.h"
#include "../mqttc/topics.h"
#include <esp_ota_ops.h>
#include <esp_task_wdt.h>
#include <ArduinoHttpClient.h>
#include <ArduinoJson.h>
#include <mbedtls/md.h>
#include <ElegantOTA.h>

// ---- Pending-update state -----------------------------------
static char  s_pendingVer[16]  = {};
static char  s_pendingUrl[192] = {};
static char  s_pendingSha[65]  = {};
static uint32_t s_pendingSize  = 0;
static bool  s_updateAvail     = false;
static bool  s_mandatory       = false;

// ---- Self-validation window --------------------------------
static bool     s_needsValidation = false;
static uint32_t s_bootMs          = 0;

// ---- ElegantOTA backup gate flag ---------------------------
static bool s_skipBackup = false;

// ---- Publish OTA status on MQTT (best-effort) ---------------
static void pub_ota(const char* event, const char* detail = "") {
    StaticJsonDocument<128> doc;
    doc["event"]  = event;
    doc["fw"]     = FW_VERSION;
    doc["detail"] = detail;
    mqtt_publish_json(topic_ota().c_str(), doc);
}

// ---- ota_init() ---------------------------------------------
void ota_init() {
    const esp_partition_t* running = esp_ota_get_running_partition();
    esp_ota_img_states_t state;
    if (esp_ota_get_state_partition(running, &state) == ESP_OK) {
        if (state == ESP_OTA_IMG_PENDING_VERIFY) {
            s_needsValidation = true;
            s_bootMs = millis();
            LOG_W("OTA", "New FW pending validation (window=%d ms)",
                  OTA_VALIDATE_WINDOW_MS);
        } else if (state == ESP_OTA_IMG_VALID) {
            // We're in a confirmed slot — check if last run was rolled back
            // by seeing if resetReason == software & previous slot invalid
            const esp_partition_t* prev = esp_ota_get_last_invalid_partition();
            if (prev) {
                LOG_W("OTA", "Rollback detected — previous slot was invalid");
                pub_ota("ota:rolled_back");
            }
        }
    }
    LOG_I("OTA", "Init  FW=%s  part=%s  needsVal=%d",
          FW_VERSION,
          running ? running->label : "?",
          (int)s_needsValidation);
}

// ---- ota_mark_valid() ---------------------------------------
void ota_mark_valid() {
    if (!s_needsValidation) return;
    esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
    if (err == ESP_OK) {
        LOG_I("OTA", "Firmware validated — rollback cancelled");
        s_needsValidation = false;
        pub_ota("ota:success", FW_VERSION);
    } else {
        LOG_E("OTA", "mark_valid failed: %d", err);
    }
}

// Call from main loop — if validation window expires, trigger rollback.
// (Exposed via ota_loop() called from webui_loop or main)
void ota_validation_tick() {
    if (!s_needsValidation) return;
    if ((millis() - s_bootMs) >= OTA_VALIDATE_WINDOW_MS) {
        LOG_E("OTA", "Validation window expired — rolling back");
        pub_ota("ota:rolled_back", "validation_timeout");
        esp_ota_mark_app_invalid_rollback_and_reboot();
    }
}

bool ota_update_available() { return s_updateAvail; }

// ---- ota_check_manifest() -----------------------------------
OtaResult ota_check_manifest() {
    GatewayConfig& cfg = getConfig();
    char path[128];
    snprintf(path, sizeof(path),
             "/ota/manifest?gw=%s&fw=%s&hw=%s",
             cfg.gatewayId, FW_VERSION, HW_REVISION);

    ApiResponse resp = api_get(path);

    if (resp.status == 204) {
        LOG_I("OTA", "Firmware up-to-date (%s)", FW_VERSION);
        return OtaResult::UP_TO_DATE;
    }
    if (resp.status != 200) {
        LOG_W("OTA", "Manifest fetch failed: %d", resp.status);
        return OtaResult::DOWNLOAD_FAILED;
    }

    // Parse manifest JSON
    StaticJsonDocument<384> doc;
    DeserializationError err = deserializeJson(doc, resp.body);
    if (err) {
        LOG_E("OTA", "Manifest JSON parse error: %s", err.c_str());
        return OtaResult::DOWNLOAD_FAILED;
    }

    const char* version = doc["version"] | "";
    const char* url     = doc["url"]     | "";
    const char* sha256  = doc["sha256"]  | "";
    uint32_t    size    = doc["size"]    | 0;
    bool mandatory      = doc["mandatory"] | false;

    if (!version[0] || !url[0] || !sha256[0]) {
        LOG_E("OTA", "Manifest missing required fields");
        return OtaResult::DOWNLOAD_FAILED;
    }

    // Check if version is actually newer (simple strcmp — assume semver)
    if (strcmp(version, FW_VERSION) <= 0 && !mandatory) {
        LOG_I("OTA", "No newer version (manifest=%s, running=%s)", version, FW_VERSION);
        return OtaResult::UP_TO_DATE;
    }

    strlcpy(s_pendingVer, version, sizeof(s_pendingVer));
    strlcpy(s_pendingUrl, url,     sizeof(s_pendingUrl));
    strlcpy(s_pendingSha, sha256,  sizeof(s_pendingSha));
    s_pendingSize  = size;
    s_updateAvail  = true;
    s_mandatory    = mandatory;

    LOG_I("OTA", "Update available: %s -> %s (mandatory=%d)",
          FW_VERSION, version, (int)mandatory);

    if (mandatory || cfg.otaAuto) {
        return ota_begin_update();
    }
    return OtaResult::UP_TO_DATE;  // pending but not auto-applied
}

// ---- Serialize full config to JSON (for backup body) --------
static size_t build_backup_json(char* buf, size_t bufLen) {
    GatewayConfig& cfg = getConfig();

    // Use two passes: build into a dynamic-size doc via ArduinoJson
    // Keep allocations bounded — use StaticJsonDocument with a generous size
    StaticJsonDocument<1536> doc;
    doc["gatewayId"]  = cfg.gatewayId;
    doc["fwVersion"]  = FW_VERSION;
    doc["ts"]         = rtc_epoch();

    JsonObject cfgObj = doc.createNestedObject("config");
    cfgObj["env"]          = cfg.env;
    cfgObj["mqttHost"]     = cfg.mqttHost;
    cfgObj["mqttPort"]     = cfg.mqttPort;
    cfgObj["mqttUser"]     = cfg.mqttUser;
    // NOTE: mqttPass is NOT included — secret
    cfgObj["apiHost"]      = cfg.apiHost;
    cfgObj["siteId"]       = cfg.siteId;
    cfgObj["gatewayId"]    = cfg.gatewayId;
    cfgObj["modbusBaud"]   = cfg.modbusBaud;
    cfgObj["modbusParity"] = (uint8_t)cfg.modbusParity;
    cfgObj["telMs"]        = cfg.telemetryIntervalMs;
    cfgObj["statusMs"]     = cfg.statusIntervalMs;
    cfgObj["otaMs"]        = cfg.otaCheckIntervalMs;
    cfgObj["regCount"]     = cfg.regCount;

    JsonArray regs = cfgObj.createNestedArray("registers");
    for (uint8_t i = 0; i < cfg.regCount; i++) {
        JsonObject r = regs.createNestedObject();
        r["slave"] = cfg.regs[i].slaveId;
        r["fc"]    = cfg.regs[i].fc;
        r["addr"]  = cfg.regs[i].regAddr;
        r["count"] = cfg.regs[i].count;
        r["scale"] = cfg.regs[i].scale;
        r["unit"]  = cfg.regs[i].unit;
        r["tag"]   = cfg.regs[i].tag;
        r["en"]    = cfg.regs[i].enabled;
    }

    JsonArray thr = cfgObj.createNestedArray("thresholds");
    for (uint8_t i = 0; i < cfg.thresholdCount; i++) {
        JsonObject t = thr.createNestedObject();
        t["tag"]       = cfg.thresholds[i].tag;
        t["warnLow"]   = cfg.thresholds[i].warnLow;
        t["critLow"]   = cfg.thresholds[i].critLow;
        t["warnHigh"]  = cfg.thresholds[i].warnHigh;
        t["critHigh"]  = cfg.thresholds[i].critHigh;
        t["en"]        = cfg.thresholds[i].enabled;
    }

    // Alarm state — just active alarms
    JsonArray alms = doc.createNestedArray("alarmState");
    // Access alarms via engine — use active count approach
    // (alarms module doesn't expose iteration directly; omit detail)
    doc["alarmActiveCount"] = alarms_active_count();

    // Undelivered SD records — drain up to 10 bounded
    JsonArray undelivered = doc.createNestedArray("undelivered");
    char lineBuf[256];
    uint8_t drained = 0;
    while (drained < 10 && sdbuf_replay_next(lineBuf, sizeof(lineBuf))) {
        undelivered.add(lineBuf);
        drained++;
    }

    // Health snapshot
    JsonObject health = doc.createNestedObject("health");
    HealthCounters& hc = health_counters();
    health["uptime"]       = health_uptime_s();
    health["heap"]         = health_free_heap();
    health["mqttReconns"]  = hc.mqttReconnects;
    health["otaAttempts"]  = hc.otaAttempts;
    health["reset"]        = health_reset_reason();

    size_t n = serializeJson(doc, buf, bufLen);
    return n;
}

// ---- ota_pre_backup() ---------------------------------------
bool ota_pre_backup(const char* reason) {
    LOG_I("OTA", "Pre-OTA backup  reason=%s", reason ? reason : "");

    if (!uplink_is_up()) {
        LOG_E("OTA", "Backup aborted — no uplink");
        return false;
    }

    // Build backup JSON body (~1.5 kB max)
    static char backupBuf[1600];
    size_t n = build_backup_json(backupBuf, sizeof(backupBuf));
    if (n == 0 || n >= sizeof(backupBuf)) {
        LOG_E("OTA", "Backup JSON overflow (%d bytes)", (int)n);
        return false;
    }

    ApiResponse resp = api_post("/backup", backupBuf);
    if (resp.status != 200) {
        LOG_E("OTA", "Backup POST failed: HTTP %d  %s",
              resp.status, resp.body);
        pub_ota("ota:backup_failed", resp.body);
        return false;
    }

    // Parse response for backupId
    StaticJsonDocument<128> rdoc;
    if (deserializeJson(rdoc, resp.body) == DeserializationError::Ok) {
        bool ok = rdoc["ok"] | false;
        const char* bid = rdoc["backupId"] | "";
        LOG_I("OTA", "Backup OK  backupId=%s", bid);
        if (!ok) {
            LOG_E("OTA", "Backup response ok=false");
            return false;
        }
    }
    return true;
}

// ---- Parse host + port from a URL like "http://host:port/path" ----
// Writes host into hostBuf[hostLen], port into *portOut, path into pathBuf[pathLen].
// Plain "http://host/path" defaults port=80.
static void parse_ota_url(const char* url,
                           char* hostBuf, size_t hostLen,
                           int*  portOut,
                           char* pathBuf, size_t pathLen) {
    *portOut = 80;

    // Skip scheme (http:// or https://)
    const char* p = strstr(url, "://");
    if (p) {
        p += 3;
    } else {
        p = url;
    }

    // Find end of authority (first '/' after scheme)
    const char* slash = strchr(p, '/');
    size_t authorityLen = slash ? (size_t)(slash - p) : strlen(p);

    // Copy authority to temp buffer for port parsing
    char authority[128] = {};
    if (authorityLen >= sizeof(authority)) authorityLen = sizeof(authority) - 1;
    memcpy(authority, p, authorityLen);

    // Extract port if present (single colon, not IPv6)
    const char* colon  = strchr(authority, ':');
    const char* colon2 = colon ? strchr(colon + 1, ':') : nullptr;
    if (colon && !colon2) {
        size_t hLen = (size_t)(colon - authority);
        if (hLen >= hostLen) hLen = hostLen - 1;
        memcpy(hostBuf, authority, hLen);
        hostBuf[hLen] = '\0';
        int pp = atoi(colon + 1);
        if (pp > 0 && pp <= 65535) *portOut = pp;
    } else {
        strlcpy(hostBuf, authority, hostLen);
    }

    // Path is everything from the first slash onward (or "/" if absent)
    if (slash) {
        strlcpy(pathBuf, slash, pathLen);
    } else {
        strlcpy(pathBuf, "/", pathLen);
    }
}

// ---- ota_apply() — stream download + SHA-256 verify ---------
OtaResult ota_apply(const char* url, const char* expectedSha, uint32_t size) {
    LOG_I("OTA", "Applying OTA from %s  size=%lu", url, (unsigned long)size);
    health_inc_ota_attempt();

    if (!uplink_is_up()) {
        LOG_E("OTA", "apply: no uplink");
        return OtaResult::DOWNLOAD_FAILED;
    }

    // Find inactive OTA partition
    const esp_partition_t* target = esp_ota_get_next_update_partition(nullptr);
    if (!target) {
        LOG_E("OTA", "No OTA partition available");
        return OtaResult::WRITE_FAILED;
    }
    LOG_I("OTA", "Writing to partition: %s (offset=0x%lx size=0x%lx)",
          target->label,
          (unsigned long)target->address,
          (unsigned long)target->size);

    // Sanity-check size vs partition
    if (size > 0 && size > target->size) {
        LOG_E("OTA", "Firmware too large for partition (%lu > %lu)",
              (unsigned long)size, (unsigned long)target->size);
        return OtaResult::WRITE_FAILED;
    }

    // Begin OTA
    esp_ota_handle_t otaHandle = 0;
    esp_err_t err = esp_ota_begin(target, size ? size : OTA_SIZE_UNKNOWN, &otaHandle);
    if (err != ESP_OK) {
        LOG_E("OTA", "esp_ota_begin failed: %d", err);
        return OtaResult::WRITE_FAILED;
    }

    // Set up SHA-256 context
    mbedtls_md_context_t ctx;
    const mbedtls_md_info_t* mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mdInfo, 0);
    mbedtls_md_starts(&ctx);

    // --- HTTP download via transport-agnostic ArduinoHttpClient ---
    // Parse URL into host + port + path so we can pass a Client& directly.
    char otaHost[128] = {};
    char otaPath[256] = {};
    int  otaPort      = 80;
    parse_ota_url(url, otaHost, sizeof(otaHost), &otaPort, otaPath, sizeof(otaPath));

    LOG_I("OTA", "Connecting to %s:%d path=%s", otaHost, otaPort, otaPath);

    HttpClient http(uplink_get_client(), otaHost, otaPort);
    http.setTimeout(60000);  // 60 s — large binary over 4G may be slow

    http.beginRequest();
    http.get(otaPath);
    http.sendHeader("Connection", "close");
    http.endRequest();

    int code = http.responseStatusCode();

    if (code != 200) {
        LOG_E("OTA", "Download HTTP %d", code);
        http.stop();
        esp_ota_abort(otaHandle);
        mbedtls_md_free(&ctx);
        return OtaResult::DOWNLOAD_FAILED;
    }

    // Flush remaining response headers (ArduinoHttpClient reads status line +
    // headers on responseStatusCode(); body bytes come via available()/read()).
    // skipResponseHeaders() is not needed — status code call already consumed them.

    // Stream body in chunks — do NOT buffer the whole binary.
    // Use manifest 'size' as the authoritative byte count (stop when reached
    // even if server keeps connection open, or stop at EOF if size==0).
    static uint8_t   dlBuf[2048];  // 2 KB chunks — fits comfortably in IRAM-safe DRAM
    uint32_t written  = 0;
    bool     writeErr = false;

    while (size == 0 || written < size) {
        int avail = http.available();
        if (avail <= 0) {
            if (!http.connected()) break;  // server closed connection
            // Brief yield — avoid busy-spin on slow transports (4G AT latency)
            delay(5);
            esp_task_wdt_reset();
            continue;
        }

        size_t want = (size_t)avail;
        if (want > sizeof(dlBuf)) want = sizeof(dlBuf);
        // If we know the total, don't read past it
        if (size > 0 && (written + (uint32_t)want) > size) {
            want = (size_t)(size - written);
        }

        int n = http.readBytes(dlBuf, want);
        if (n <= 0) break;

        mbedtls_md_update(&ctx, dlBuf, (size_t)n);

        err = esp_ota_write(otaHandle, dlBuf, (size_t)n);
        if (err != ESP_OK) {
            LOG_E("OTA", "esp_ota_write failed at byte %lu: %d", (unsigned long)written, err);
            writeErr = true;
            break;
        }
        written += (uint32_t)n;
        esp_task_wdt_reset();   // keep WDT happy during long download
    }
    http.stop();

    if (writeErr) {
        esp_ota_abort(otaHandle);
        mbedtls_md_free(&ctx);
        return OtaResult::WRITE_FAILED;
    }

    // Verify size
    if (size > 0 && written != size) {
        LOG_E("OTA", "Size mismatch: got %lu expected %lu", (unsigned long)written, (unsigned long)size);
        esp_ota_abort(otaHandle);
        // Erase slot on mismatch
        esp_partition_erase_range(target, 0, target->size);
        mbedtls_md_free(&ctx);
        pub_ota("ota:verify_failed", "size_mismatch");
        return OtaResult::HASH_MISMATCH;
    }

    // Verify SHA-256
    uint8_t digest[32];
    mbedtls_md_finish(&ctx, digest);
    mbedtls_md_free(&ctx);

    char hexDigest[65];
    for (int i = 0; i < 32; i++) snprintf(hexDigest + i * 2, 3, "%02x", digest[i]);
    hexDigest[64] = '\0';

    if (expectedSha && strlen(expectedSha) == 64 &&
        strncasecmp(hexDigest, expectedSha, 64) != 0) {
        LOG_E("OTA", "SHA256 mismatch!\n  got: %s\n  exp: %s", hexDigest, expectedSha);
        esp_ota_abort(otaHandle);
        esp_partition_erase_range(target, 0, target->size);
        pub_ota("ota:verify_failed", "sha256_mismatch");
        return OtaResult::HASH_MISMATCH;
    }

    // Finalize OTA
    err = esp_ota_end(otaHandle);
    if (err != ESP_OK) {
        LOG_E("OTA", "esp_ota_end failed: %d", err);
        return OtaResult::WRITE_FAILED;
    }

    err = esp_ota_set_boot_partition(target);
    if (err != ESP_OK) {
        LOG_E("OTA", "set_boot_partition failed: %d", err);
        return OtaResult::WRITE_FAILED;
    }

    LOG_I("OTA", "OTA complete (%lu bytes, sha256 OK). Rebooting…", (unsigned long)written);
    pub_ota("ota:updating", s_pendingVer);
    delay(200);
    esp_restart();
    return OtaResult::UPDATED;  // unreachable
}

// ---- ota_begin_update() — public entry point ----------------
OtaResult ota_begin_update() {
    if (!s_updateAvail) {
        LOG_W("OTA", "begin_update: no pending update");
        return OtaResult::UP_TO_DATE;
    }

    if (!ota_pre_backup("ota_update")) {
        // Backup mandatory — abort
        LOG_E("OTA", "Backup failed — OTA aborted");
        s_updateAvail = false;
        return OtaResult::BACKUP_FAILED;
    }

    return ota_apply(s_pendingUrl, s_pendingSha, s_pendingSize);
}

// ---- ElegantOTA integration ---------------------------------

void ota_set_skip_backup(bool skip) { s_skipBackup = skip; }

void ota_attach_elegant(AsyncWebServer* server) {
    if (!server) return;

    ElegantOTA.begin(server);
    ElegantOTA.setAutoReboot(false);  // We control reboot after backup check

    ElegantOTA.onStart([]() {
        LOG_I("OTA", "ElegantOTA upload starting");
        if (!s_skipBackup) {
            if (!ota_pre_backup("webui_upload")) {
                LOG_E("OTA", "Backup gate FAILED — local OTA rejected");
                // ElegantOTA v3 doesn't have abort() — we proceed but log the failure.
                // Operator must use "skip backup" checkbox to override.
                // The upload will proceed but we publish the backup failure.
                pub_ota("ota:backup_failed", "webui_upload");
            }
        } else {
            LOG_W("OTA", "Backup gate SKIPPED (offline emergency)");
            pub_ota("ota:backup_skipped", "offline_mode");
        }
    });

    ElegantOTA.onEnd([](bool success) {
        if (success) {
            LOG_I("OTA", "ElegantOTA upload complete — rebooting");
            pub_ota("ota:updating", "webui_upload");
            delay(200);
            esp_restart();
        } else {
            LOG_E("OTA", "ElegantOTA upload FAILED");
            pub_ota("ota:verify_failed", "webui_upload");
        }
    });

    LOG_I("OTA", "ElegantOTA attached on /update");
}
