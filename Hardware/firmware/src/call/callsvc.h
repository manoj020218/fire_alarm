#pragma once

#include "../alarms/engine.h"

void callsvc_init();
void callsvc_step();
void callsvc_on_alarm_event(const AlarmEvent& ev);
bool callsvc_is_armed();
bool callsvc_is_running();
