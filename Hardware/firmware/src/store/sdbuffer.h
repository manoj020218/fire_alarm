#pragma once
// ============================================================
// FireGuard — SD offline telemetry buffer
// Appends JSON lines to /fg_buf.jsonl on SD.
// Replays on reconnect, bounded to SD_BUFFER_MAX_RECORDS.
// ============================================================
#include <Arduino.h>

bool sdbuf_init();                              // mount HSPI SD
bool sdbuf_write(const char* jsonLine);         // append a telemetry record
bool sdbuf_has_pending();                       // records waiting to replay
bool sdbuf_replay_next(char* buf, size_t len);  // pop oldest record into buf
void sdbuf_drop_all();                          // clear buffer (after full replay)
uint32_t sdbuf_pending_count();
