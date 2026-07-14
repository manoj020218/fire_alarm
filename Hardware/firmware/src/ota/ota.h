#pragma once
// ============================================================
// FireGuard — OTA subsystem (full §10.3 implementation)
//   1. GET /ota/manifest  → check for newer version
//   2. POST /backup       → mandatory pre-OTA config snapshot
//   3. Download to inactive slot, SHA-256 verify
//   4. Boot new slot; self-validate within OTA_VALIDATE_WINDOW_MS
//   5. esp_ota_mark_app_valid_cancel_rollback() or auto-rollback
// ============================================================
#include <Arduino.h>

// OTA result codes
enum class OtaResult {
    UP_TO_DATE,
    UPDATED,
    BACKUP_FAILED,
    DOWNLOAD_FAILED,
    HASH_MISMATCH,
    WRITE_FAILED,
    NOT_IMPLEMENTED,
};

// Called at boot: detect new-slot pending-verify state.
void ota_init();

// Called from loop() — drives validation timeout watchdog.
void ota_validation_tick();

// Periodic manifest check (call from scheduler).
OtaResult ota_check_manifest();

// True if a newer version was found by check_manifest() but not yet applied.
bool ota_update_available();

// Run backup gate + apply. Called by check_manifest (if otaAuto) or WebUI/MQTT.
OtaResult ota_begin_update();

// Pre-OTA backup gate (also called from ElegantOTA onStart).
bool ota_pre_backup(const char* reason);

// Apply update from URL (full §10.3 flow — streaming SHA-256 verify + slot write).
OtaResult ota_apply(const char* url, const char* sha256, uint32_t size);

// Mark current firmware valid (call once app is confirmed healthy).
void ota_mark_valid();

// ElegantOTA integration — attach to AsyncWebServer.
class AsyncWebServer;
void ota_attach_elegant(AsyncWebServer* server);

// Allow WebUI to set skip-backup flag for offline emergency uploads.
void ota_set_skip_backup(bool skip);
