#include "callsvc.h"

#include "../config/config.h"
#include "../net/modem4g.h"
#include "../util/log.h"

#include <ctype.h>
#include <string.h>

namespace {

constexpr uint8_t  MAX_CALL_RECIPIENTS = 5;
constexpr uint32_t CALL_RING_MS        = 15000UL;
constexpr uint32_t CALL_GAP_MS         = 5000UL;
constexpr uint32_t SMS_POLL_IDLE_MS    = 5000UL;
constexpr uint32_t SMS_POLL_ACTIVE_MS  = 2000UL;

enum class CallStage : uint8_t {
    IDLE = 0,
    RINGING,
    GAP
};

struct CallRoster {
    char numbers[MAX_CALL_RECIPIENTS][24];
    uint8_t count;
};

static CallStage s_stage           = CallStage::IDLE;
static bool      s_remoteArmed     = true;
static bool      s_incidentOpen    = false;
static uint8_t   s_stopMask        = 0;
static uint8_t   s_lastIndex       = 0xFF;
static uint8_t   s_currentIndex    = 0xFF;
static uint32_t  s_stageDeadlineMs = 0;
static uint32_t  s_nextDialMs      = 0;
static uint32_t  s_nextSmsPollMs   = 0;

static bool call_config_enabled() {
    GatewayConfig& cfg = getConfig();
    return cfg.callEnabled && cfg.smsNumbers[0];
}

static void trim_in_place(char* s) {
    if (!s || !s[0]) return;

    while (*s == ' ' || *s == '\t' || *s == '\r' || *s == '\n') {
        memmove(s, s + 1, strlen(s));
    }

    size_t len = strlen(s);
    while (len > 0) {
        char c = s[len - 1];
        if (c != ' ' && c != '\t' && c != '\r' && c != '\n') break;
        s[--len] = 0;
    }
}

static void normalize_digits_tail(const char* in, char* out, size_t outLen) {
    if (!outLen) return;
    out[0] = 0;
    if (!in) return;

    char digits[24] = {0};
    size_t dn = 0;
    for (const char* p = in; *p && dn < sizeof(digits) - 1; ++p) {
        if (isdigit(static_cast<unsigned char>(*p))) {
            digits[dn++] = *p;
        }
    }
    digits[dn] = 0;

    if (dn == 0) return;

    const char* start = digits;
    if (dn > 10) start = digits + (dn - 10);
    strlcpy(out, start, outLen);
}

static bool same_number(const char* a, const char* b) {
    char na[12] = {0};
    char nb[12] = {0};
    normalize_digits_tail(a, na, sizeof(na));
    normalize_digits_tail(b, nb, sizeof(nb));
    return na[0] && nb[0] && strcmp(na, nb) == 0;
}

static void parse_roster(CallRoster& roster) {
    roster.count = 0;

    char nums[sizeof(getConfig().smsNumbers)];
    strlcpy(nums, getConfig().smsNumbers, sizeof(nums));

    char* tok = strtok(nums, ",");
    while (tok && roster.count < MAX_CALL_RECIPIENTS) {
        trim_in_place(tok);
        if (*tok) {
            bool dup = false;
            for (uint8_t i = 0; i < roster.count; ++i) {
                if (same_number(roster.numbers[i], tok)) {
                    dup = true;
                    break;
                }
            }
            if (!dup) {
                strlcpy(roster.numbers[roster.count], tok, sizeof(roster.numbers[0]));
                roster.count++;
            }
        }
        tok = strtok(nullptr, ",");
    }
}

static int find_authorized_index(const CallRoster& roster, const char* sender) {
    for (uint8_t i = 0; i < roster.count; ++i) {
        if (same_number(roster.numbers[i], sender)) return i;
    }
    return -1;
}

static bool all_recipients_stopped(const CallRoster& roster) {
    if (roster.count == 0) return true;
    uint8_t mask = (1u << roster.count) - 1u;
    return (s_stopMask & mask) == mask;
}

static int next_recipient_index(const CallRoster& roster) {
    if (roster.count == 0) return -1;
    uint8_t start = (s_lastIndex == 0xFF) ? 0 : static_cast<uint8_t>((s_lastIndex + 1) % roster.count);
    for (uint8_t off = 0; off < roster.count; ++off) {
        uint8_t idx = static_cast<uint8_t>((start + off) % roster.count);
        if ((s_stopMask & (1u << idx)) == 0) return idx;
    }
    return -1;
}

static void hangup_current_call(const char* reason) {
    if (s_stage == CallStage::RINGING) {
        modem4g_call_hangup();
        LOG_I("CALL", "Call ended (%s)", reason);
    }
    s_currentIndex = 0xFF;
}

static void reset_incident_state(bool autoArm) {
    hangup_current_call("incident reset");
    s_stage           = CallStage::IDLE;
    s_incidentOpen    = false;
    s_stopMask        = 0;
    s_lastIndex       = 0xFF;
    s_stageDeadlineMs = 0;
    s_nextDialMs      = 0;
    if (autoArm) s_remoteArmed = true;
}

static String normalize_command_text(const String& src) {
    String s = src;
    s.trim();
    s.replace("\r", " ");
    s.replace("\n", " ");
    while (s.indexOf("  ") >= 0) s.replace("  ", " ");
    s.toUpperCase();
    return s;
}

static void handle_stop_for_index(int idx) {
    if (idx < 0 || idx >= MAX_CALL_RECIPIENTS) return;
    s_stopMask |= (1u << idx);
    LOG_I("CALL", "FG STOP accepted for roster index %d", idx);

    if (s_stage == CallStage::RINGING && s_currentIndex == static_cast<uint8_t>(idx)) {
        hangup_current_call("FG STOP");
        s_stage           = CallStage::GAP;
        s_stageDeadlineMs = millis() + CALL_GAP_MS;
    }
}

static void handle_disarm() {
    s_remoteArmed = false;
    hangup_current_call("FG DISARM");
    s_stage           = CallStage::IDLE;
    s_stageDeadlineMs = 0;
    s_nextDialMs      = 0;
    LOG_W("CALL", "Voice alert cycle disarmed by SMS");
}

static void handle_arm() {
    s_remoteArmed = true;
    LOG_I("CALL", "Voice alert cycle re-armed by SMS");
    if (alarms_any_unacknowledged_critical_active()) {
        s_stage           = CallStage::IDLE;
        s_stageDeadlineMs = 0;
        s_nextDialMs      = 0;
    }
}

static void poll_control_sms() {
    CallRoster roster;
    parse_roster(roster);
    if (roster.count == 0) return;

    String raw = modem4g_read_sms_raw();
    int idx = 0;
    while (idx >= 0) {
        int h = raw.indexOf("+CMGL:", idx);
        if (h < 0) break;

        int lineEnd = raw.indexOf('\n', h);
        if (lineEnd < 0) break;

        String header = raw.substring(h, lineEnd);
        int colon = header.indexOf(':');
        int comma = header.indexOf(',', colon + 1);
        int smsIndex = -1;
        if (colon >= 0 && comma > colon) {
            smsIndex = header.substring(colon + 1, comma).toInt();
        }

        String sender;
        int q1 = header.indexOf('"');
        int q2 = header.indexOf('"', q1 + 1);
        int q3 = header.indexOf('"', q2 + 1);
        int q4 = header.indexOf('"', q3 + 1);
        if (q3 >= 0 && q4 > q3) sender = header.substring(q3 + 1, q4);

        int bodyStart = lineEnd + 1;
        int next = raw.indexOf("+CMGL:", bodyStart);
        int bodyEnd = (next < 0) ? raw.indexOf("\r\nOK", bodyStart) : next;
        if (bodyEnd < 0) bodyEnd = raw.length();

        String body = raw.substring(bodyStart, bodyEnd);
        body.trim();

        int rosterIndex = find_authorized_index(roster, sender.c_str());
        if (rosterIndex >= 0 && body.length()) {
            String cmd = normalize_command_text(body);
            bool consumed = false;

            LOG_I("CALL", "Control SMS from %s -> %s", sender.c_str(), cmd.c_str());

            if (cmd.indexOf("FG STOP") >= 0) {
                handle_stop_for_index(rosterIndex);
                consumed = true;
            } else if (cmd.indexOf("FG DISARM") >= 0) {
                handle_disarm();
                consumed = true;
            } else if (cmd.indexOf("FG ARM") >= 0) {
                handle_arm();
                consumed = true;
            }

            if (consumed && smsIndex >= 0) {
                modem4g_delete_sms(smsIndex);
            }
        } else if (body.length()) {
            String cmd = normalize_command_text(body);
            if (cmd.indexOf("FG ") >= 0) {
                LOG_W("CALL", "Ignoring control SMS from %s (authorized=%d): %s",
                      sender.c_str(), rosterIndex >= 0 ? 1 : 0, cmd.c_str());
            }
        }

        idx = (next < 0) ? -1 : next;
    }
}

static void maybe_poll_sms() {
    if (!call_config_enabled() || !modem4g_is_registered()) return;

    uint32_t now = millis();
    if (s_nextSmsPollMs != 0 && static_cast<int32_t>(now - s_nextSmsPollMs) < 0) return;

    poll_control_sms();
    s_nextSmsPollMs = now + ((s_stage == CallStage::RINGING) ? SMS_POLL_ACTIVE_MS : SMS_POLL_IDLE_MS);
}

}  // namespace

void callsvc_init() {
    s_stage         = CallStage::IDLE;
    s_remoteArmed   = true;
    s_incidentOpen  = false;
    s_stopMask      = 0;
    s_lastIndex     = 0xFF;
    s_currentIndex  = 0xFF;
    s_stageDeadlineMs = 0;
    s_nextDialMs    = 0;
    s_nextSmsPollMs = 0;
}

void callsvc_on_alarm_event(const AlarmEvent& ev) {
    if (ev.severity != AlarmSeverity::CRITICAL) return;

    if (ev.active) {
        if (!s_incidentOpen) {
            s_incidentOpen = true;
            s_stopMask     = 0;
            s_lastIndex    = 0xFF;
            s_nextDialMs   = 0;
            LOG_W("CALL", "Critical incident opened");
        }
    } else if (!alarms_any_critical_active()) {
        reset_incident_state(true);
        LOG_I("CALL", "All critical alarms cleared - voice cycle reset");
    }
}

void callsvc_step() {
    if (!alarms_ready()) return;
    maybe_poll_sms();

    if (!call_config_enabled()) {
        if (s_incidentOpen || s_stage != CallStage::IDLE) {
            reset_incident_state(true);
        }
        return;
    }

    bool criticalActive = alarms_any_critical_active();
    bool actionable = alarms_any_unacknowledged_critical_active();
    if (!criticalActive) {
        if (s_incidentOpen || s_stage != CallStage::IDLE || !s_remoteArmed || s_stopMask) {
            reset_incident_state(true);
        }
        return;
    }

    if (!s_incidentOpen) {
        s_incidentOpen = true;
        s_stopMask     = 0;
        s_lastIndex    = 0xFF;
        s_nextDialMs   = 0;
        LOG_W("CALL", "Critical incident detected");
    }

    if (!actionable) {
        if (s_stage == CallStage::RINGING) {
            hangup_current_call("all critical alarms acknowledged");
        }
        s_stage = CallStage::IDLE;
        return;
    }

    if (!s_remoteArmed) return;

    CallRoster roster;
    parse_roster(roster);
    if (roster.count == 0 || all_recipients_stopped(roster)) {
        if (s_stage == CallStage::RINGING) {
            hangup_current_call("no callable recipients left");
        }
        s_stage = CallStage::IDLE;
        return;
    }

    uint32_t now = millis();
    switch (s_stage) {
        case CallStage::IDLE: {
            if (s_nextDialMs != 0 && static_cast<int32_t>(now - s_nextDialMs) < 0) break;

            int idx = next_recipient_index(roster);
            if (idx < 0) break;

            if (modem4g_call_begin(roster.numbers[idx])) {
                s_lastIndex       = static_cast<uint8_t>(idx);
                s_currentIndex    = static_cast<uint8_t>(idx);
                s_stage           = CallStage::RINGING;
                s_stageDeadlineMs = now + CALL_RING_MS;
                LOG_W("CALL", "Dialing %s", roster.numbers[idx]);
            } else {
                s_lastIndex  = static_cast<uint8_t>(idx);
                s_nextDialMs = now + CALL_GAP_MS;
            }
            break;
        }

        case CallStage::RINGING:
            if (static_cast<int32_t>(now - s_stageDeadlineMs) >= 0) {
                hangup_current_call("ring timeout");
                s_stage           = CallStage::GAP;
                s_stageDeadlineMs = now + CALL_GAP_MS;
            }
            break;

        case CallStage::GAP:
            if (static_cast<int32_t>(now - s_stageDeadlineMs) >= 0) {
                s_stage      = CallStage::IDLE;
                s_nextDialMs = 0;
            }
            break;
    }
}

bool callsvc_is_armed() {
    return s_remoteArmed;
}

bool callsvc_is_running() {
    return alarms_ready() && s_incidentOpen && s_remoteArmed;
}
