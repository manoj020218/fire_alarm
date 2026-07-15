// ============================================================
// FireGuard — W5500 Ethernet implementation
// VSPI: MOSI=23 MISO=19 SCK=18  CS=5  RST=25
// Library: arduino-libraries/Ethernet v2
//
// NON-BLOCKING DESIGN
// -------------------
// eth_step() is called from uplink_loop() each tick.  It uses a
// small state machine so no single call blocks more than ~1.5 s
// (the short DHCP attempt window).  If the first DHCP attempt
// fails the state machine backs off and retries on the next call.
// Hardware-present check (Ethernet.hardwareStatus()) is done
// first so we fail fast when no W5500 is fitted.
// ============================================================
#include "ethernet.h"
#include "../config/pins.h"
#include "../util/log.h"
#include <Ethernet.h>
#include <SPI.h>

static uint8_t      s_mac[6];
static EthernetClient s_client;

enum class EthState : uint8_t {
    UNINIT = 0,
    RESETTING,      // hardware reset pulse
    DHCP_TRY,       // one short DHCP attempt
    CONNECTED,
    FAILED,         // DHCP back-off (hardware present, no lease)
    NOHW_BACKOFF    // long back-off when W5500 chip absent
};

static EthState  s_ethState   = EthState::UNINIT;
static uint32_t  s_stateTs    = 0;
static bool      s_hwPresent  = false;
static bool      s_rstReleased = false;  // tracks RST pin release within RESETTING state

#define ETH_RST_LOW_MS        50
#define ETH_RST_HIGH_MS       100
#define ETH_DHCP_TIMEOUT_MS   4000    // short attempt; retry next tick if failed
#define ETH_DHCP_RESP_MS      1000
#define ETH_FAILED_RETRY_MS   15000   // DHCP back-off (hw present, no lease)
#define ETH_NOHW_RETRY_MS     300000  // 5-minute back-off when no W5500 fitted

static void eth_enter(EthState ns) {
    s_ethState    = ns;
    s_stateTs     = millis();
    if (ns != EthState::RESETTING) s_rstReleased = false;
}

static uint32_t eth_elapsed() { return millis() - s_stateTs; }

static void derive_mac() {
    uint64_t efuse = ESP.getEfuseMac();
    s_mac[0] = 0xDE;
    s_mac[1] = 0xAD;
    s_mac[2] = (efuse >> 0)  & 0xFF;
    s_mac[3] = (efuse >> 8)  & 0xFF;
    s_mac[4] = (efuse >> 16) & 0xFF;
    s_mac[5] = (efuse >> 24) & 0xFF;
}

// ---- public API ----------------------------------------------

bool eth_step() {
    switch (s_ethState) {

    case EthState::UNINIT:
        derive_mac();
        Ethernet.init(PIN_ETH_CS);
        if (PIN_ETH_RST >= 0) {
            pinMode(PIN_ETH_RST, OUTPUT);
            digitalWrite(PIN_ETH_RST, LOW);
            eth_enter(EthState::RESETTING);
        } else {
            // No RST pin — go straight to DHCP
            eth_enter(EthState::DHCP_TRY);
        }
        break;

    case EthState::RESETTING:
        if (eth_elapsed() < ETH_RST_LOW_MS) break;
        if (!s_rstReleased) {
            digitalWrite(PIN_ETH_RST, HIGH);
            s_rstReleased = true;
        }
        if (eth_elapsed() < ETH_RST_LOW_MS + ETH_RST_HIGH_MS) break;
        eth_enter(EthState::DHCP_TRY);
        break;

    case EthState::DHCP_TRY: {
        // Fast hardware-present check; fails in <1 ms if no W5500
        if (!s_hwPresent) {
            if (Ethernet.hardwareStatus() == EthernetNoHardware) {
                // Chip absent — use long backoff; log once on entry
                LOG_W("ETH", "No W5500 — Ethernet disabled, retry in 5min");
                eth_enter(EthState::NOHW_BACKOFF);
                break;
            }
            s_hwPresent = true;
        }
        LOG_I("ETH", "Starting DHCP (timeout=%dms)...", ETH_DHCP_TIMEOUT_MS);
        // Short DHCP window so we don't block long
        if (Ethernet.begin(s_mac, ETH_DHCP_TIMEOUT_MS, ETH_DHCP_RESP_MS) == 0) {
            LOG_W("ETH", "DHCP attempt failed — will retry in %ds",
                  ETH_FAILED_RETRY_MS / 1000);
            eth_enter(EthState::FAILED);
        } else {
            LOG_I("ETH", "DHCP OK  IP=%s", Ethernet.localIP().toString().c_str());
            eth_enter(EthState::CONNECTED);
        }
        break;
    }

    case EthState::CONNECTED:
        // maintain() watches for link loss
        break;

    case EthState::FAILED:
        // Hardware is present but DHCP failed — retry on short interval
        if (eth_elapsed() > ETH_FAILED_RETRY_MS) {
            LOG_I("ETH", "Retrying DHCP");
            s_hwPresent = false;  // re-check hardware presence each retry
            eth_enter(EthState::DHCP_TRY);
        }
        break;

    case EthState::NOHW_BACKOFF:
        // W5500 chip absent; wait 5 min then re-check in case hardware appears
        // No log spam — message was printed once on entry to this state
        if (eth_elapsed() > ETH_NOHW_RETRY_MS) {
            s_hwPresent = false;
            eth_enter(EthState::DHCP_TRY);
        }
        break;
    }

    // NOHW_BACKOFF / FAILED / other non-CONNECTED states always return false
    return s_ethState == EthState::CONNECTED;
}

bool eth_is_connected() {
    return s_ethState == EthState::CONNECTED &&
           Ethernet.linkStatus() == LinkON;
}

void eth_maintain() {
    if (s_ethState == EthState::CONNECTED) {
        Ethernet.maintain();
        if (Ethernet.linkStatus() != LinkON) {
            LOG_W("ETH", "Link lost — will retry DHCP");
            eth_enter(EthState::DHCP_TRY);
        }
    }
}

bool eth_signal_ok() {
    return s_ethState == EthState::CONNECTED &&
           Ethernet.linkStatus() == LinkON;
}

Client* eth_get_client() { return &s_client; }
