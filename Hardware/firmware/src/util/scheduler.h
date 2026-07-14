#pragma once
// ============================================================
// FireGuard — Millis-based task scheduler
// No delay() in steady state.  Tasks fire when their interval
// has elapsed; the loop() body is always non-blocking.
//
// Usage:
//   static Task tTelemetry = {0, TELEMETRY_INTERVAL_MS};
//   if (task_due(tTelemetry)) { publishTelemetry(); }
// ============================================================
#include <Arduino.h>

struct Task {
    uint32_t lastRun;
    uint32_t intervalMs;
};

// Returns true and updates lastRun when the interval has elapsed.
// Safe across millis() rollover.
inline bool task_due(Task& t) {
    uint32_t now = millis();
    if ((now - t.lastRun) >= t.intervalMs) {
        t.lastRun = now;
        return true;
    }
    return false;
}

// Force the task to fire on the very next loop iteration.
inline void task_trigger_now(Task& t) {
    t.lastRun = 0;
}
