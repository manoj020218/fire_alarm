// ============================================================
// FireGuard — SD buffer implementation (HSPI)
// HSPI: CS=15 CLK=14 MOSI=13 MISO=2
// Records stored as JSONL (/fg_buf.jsonl).
// On replay: reads one line, publishes, removes it from file.
// Oldest-drop when SD_BUFFER_MAX_RECORDS is reached.
// ============================================================
#include "sdbuffer.h"
#include "../config/pins.h"
#include "../config/defaults.h"
#include "../util/log.h"
#include "../util/health.h"
#include <SPI.h>
#include <SD.h>

#define BUF_FILE    "/fg_buf.jsonl"
#define TMP_FILE    "/fg_tmp.jsonl"

static SPIClass s_hspi(HSPI);
static bool     s_sdOk       = false;
// FIX 4: once mount fails (no card), disable all further SD attempts so we
// don't log/work every telemetry cycle. Re-enabled only on reboot.
static bool     s_sdDisabled = false;

bool sdbuf_init() {
    s_hspi.begin(PIN_SD_CLK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
    if (!SD.begin(PIN_SD_CS, s_hspi, 4000000)) {
        LOG_W("SD", "Mount failed (no card or wiring issue) — buffering disabled");
        s_sdOk       = false;
        s_sdDisabled = true;   // suppress all future attempts until reboot
        return false;
    }
    s_sdOk = true;
    LOG_I("SD", "Mounted  pending=%lu", sdbuf_pending_count());
    return true;
}

bool sdbuf_write(const char* jsonLine) {
    if (s_sdDisabled || !s_sdOk) return false;

    // Drop oldest if over limit
    if (sdbuf_pending_count() >= SD_BUFFER_MAX_RECORDS) {
        LOG_W("SD", "Buffer full — dropping oldest record");
        // Rotate: skip first line to make room
        File src = SD.open(BUF_FILE, FILE_READ);
        File dst = SD.open(TMP_FILE, FILE_WRITE);
        if (src && dst) {
            src.readStringUntil('\n'); // discard oldest
            while (src.available()) {
                dst.print(src.readStringUntil('\n'));
                dst.print('\n');
            }
        }
        if (src) src.close();
        if (dst) dst.close();
        SD.remove(BUF_FILE);
        SD.rename(TMP_FILE, BUF_FILE);
    }

    File f = SD.open(BUF_FILE, FILE_APPEND);
    if (!f) {
        LOG_E("SD", "Cannot open buffer for append");
        health_inc_sd_write_error();
        return false;
    }
    f.println(jsonLine);
    f.close();
    return true;
}

bool sdbuf_has_pending() {
    if (s_sdDisabled || !s_sdOk) return false;
    return SD.exists(BUF_FILE) && sdbuf_pending_count() > 0;
}

bool sdbuf_replay_next(char* buf, size_t len) {
    if (s_sdDisabled || !s_sdOk || !sdbuf_has_pending()) return false;

    File src = SD.open(BUF_FILE, FILE_READ);
    if (!src) return false;
    String line = src.readStringUntil('\n');
    src.close();

    if (line.length() == 0) return false;
    strlcpy(buf, line.c_str(), len);

    // Remove the first line (rewrite remainder)
    src = SD.open(BUF_FILE, FILE_READ);
    File dst = SD.open(TMP_FILE, FILE_WRITE);
    if (src && dst) {
        src.readStringUntil('\n');  // skip replayed line
        while (src.available()) {
            dst.print(src.readStringUntil('\n'));
            if (src.available()) dst.print('\n');
        }
    }
    if (src) src.close();
    if (dst) dst.close();
    SD.remove(BUF_FILE);
    SD.rename(TMP_FILE, BUF_FILE);

    return true;
}

void sdbuf_drop_all() {
    if (!s_sdDisabled && s_sdOk && SD.exists(BUF_FILE)) {
        SD.remove(BUF_FILE);
        LOG_I("SD", "Buffer cleared");
    }
}

uint32_t sdbuf_pending_count() {
    if (s_sdDisabled || !s_sdOk || !SD.exists(BUF_FILE)) return 0;
    File f = SD.open(BUF_FILE, FILE_READ);
    if (!f) return 0;
    uint32_t lines = 0;
    while (f.available()) {
        char c = f.read();
        if (c == '\n') lines++;
    }
    f.close();
    return lines;
}
