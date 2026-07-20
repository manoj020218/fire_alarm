#pragma once
// ============================================================
// FireGuard — W5500 Ethernet (VSPI CS=5, RST=25)
// Non-blocking design: call eth_step() each tick to drive DHCP.
// eth_init() is removed; state machine starts on first eth_step().
// ============================================================
#include <Arduino.h>

// Advance the Ethernet state machine one step; non-blocking.
// Returns true when a usable IP has been obtained.
bool eth_step();

bool eth_is_connected();
void eth_maintain();
bool eth_signal_ok();   // link detection

class Client;
Client* eth_get_client();
Client* eth_get_http_client();  // separate socket for HTTP (not shared with MQTT)
