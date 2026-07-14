#pragma once
// ============================================================
// FireGuard — W5500 Ethernet (VSPI CS=5, RST=25)
// ============================================================
#include <Arduino.h>

bool eth_init();
bool eth_is_connected();
void eth_maintain();
bool eth_signal_ok();   // link detection
class Client;
Client* eth_get_client();
