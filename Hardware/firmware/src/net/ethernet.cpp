// ============================================================
// FireGuard — W5500 Ethernet implementation
// VSPI: MOSI=23 MISO=19 SCK=18  CS=5  RST=25
// Library: arduino-libraries/Ethernet v2
// ============================================================
#include "ethernet.h"
#include "../config/pins.h"
#include "../util/log.h"
#include <Ethernet.h>
#include <SPI.h>

// Unique MAC derived from ESP32 EFuse (last 6 bytes)
static uint8_t s_mac[6];
static EthernetClient s_client;
static bool s_ready = false;

static void derive_mac() {
    uint64_t efuse = ESP.getEfuseMac();
    s_mac[0] = 0xDE;  // locally administered
    s_mac[1] = 0xAD;
    s_mac[2] = (efuse >> 0)  & 0xFF;
    s_mac[3] = (efuse >> 8)  & 0xFF;
    s_mac[4] = (efuse >> 16) & 0xFF;
    s_mac[5] = (efuse >> 24) & 0xFF;
}

bool eth_init() {
    derive_mac();

    // Hardware reset
    if (PIN_ETH_RST >= 0) {
        pinMode(PIN_ETH_RST, OUTPUT);
        digitalWrite(PIN_ETH_RST, LOW);
        uint32_t t = millis();
        while (millis() - t < 50) { yield(); }
        digitalWrite(PIN_ETH_RST, HIGH);
        t = millis();
        while (millis() - t < 100) { yield(); }
    }

    Ethernet.init(PIN_ETH_CS);

    LOG_I("ETH", "Starting DHCP...");
    if (Ethernet.begin(s_mac, 8000, 2000) == 0) {
        LOG_W("ETH", "DHCP failed");
        s_ready = false;
        return false;
    }
    s_ready = true;
    LOG_I("ETH", "DHCP OK  IP=%s", Ethernet.localIP().toString().c_str());
    return true;
}

bool eth_is_connected() {
    if (!s_ready) return false;
    return (Ethernet.linkStatus() == LinkON);
}

void eth_maintain() {
    if (s_ready) {
        Ethernet.maintain();
        if (Ethernet.linkStatus() != LinkON) {
            LOG_W("ETH", "Link lost");
            s_ready = false;
        }
    }
}

bool eth_signal_ok() {
    return (Ethernet.linkStatus() == LinkON);
}

Client* eth_get_client() { return &s_client; }
