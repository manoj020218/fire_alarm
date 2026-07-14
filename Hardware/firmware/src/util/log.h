#pragma once
// ============================================================
// FireGuard — Leveled serial log macros
// Format: [LEVEL][TAG] message
// Set LOG_LEVEL at build time (-D LOG_LEVEL=3) to suppress
// verbose output in production.
// ============================================================
#include <Arduino.h>

// Log levels: 0=none 1=error 2=warn 3=info 4=debug
#ifndef LOG_LEVEL
#define LOG_LEVEL 3
#endif

#define _LOG(lvl, tag, fmt, ...) \
    Serial.printf("[" lvl "][%s] " fmt "\n", tag, ##__VA_ARGS__)

#if LOG_LEVEL >= 1
#define LOG_E(tag, fmt, ...) _LOG("E", tag, fmt, ##__VA_ARGS__)
#else
#define LOG_E(tag, fmt, ...) (void)0
#endif

#if LOG_LEVEL >= 2
#define LOG_W(tag, fmt, ...) _LOG("W", tag, fmt, ##__VA_ARGS__)
#else
#define LOG_W(tag, fmt, ...) (void)0
#endif

#if LOG_LEVEL >= 3
#define LOG_I(tag, fmt, ...) _LOG("I", tag, fmt, ##__VA_ARGS__)
#else
#define LOG_I(tag, fmt, ...) (void)0
#endif

#if LOG_LEVEL >= 4
#define LOG_D(tag, fmt, ...) _LOG("D", tag, fmt, ##__VA_ARGS__)
#else
#define LOG_D(tag, fmt, ...) (void)0
#endif
