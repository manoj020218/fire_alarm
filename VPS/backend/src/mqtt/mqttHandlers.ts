/**
 * MQTT message router + handlers.
 * handleMqttMessage() is the single entry point called by mqttClient.
 * Each handler is fully try/caught: malformed payloads are logged and dropped.
 * Direct-callable for unit tests — no real broker needed.
 */
import { z } from 'zod';
import { Gateway } from '../models/Gateway';
import {
  Telemetry,
  type IDigitalInputs,
  type IDigitalOutputs,
  type IDeviceReading,
} from '../models/Telemetry';
import { Alarm } from '../models/Alarm';
import { sendAlarmPush } from '../services/pushService';
import logger from '../config/logger';
import {
  emitTelemetry,
  emitAlarm,
  emitGatewayStatus,
  emitSim,
} from '../socket/socketServer';

// ─── Zod schemas (tolerant of extra device keys via .passthrough()) ───────────

const SystemSchema = z.object({
  uptime: z.number().nonnegative(),
  heap: z.number().nonnegative(),
  fw: z.string(),
  releaseDate: z.string(),
  uplink: z.enum(['wifi', 'lan', '4g']),
  signal4g: z.number().optional(),
  signalLan: z.boolean().optional(),
  rssi: z.number().optional(),
  mqtt: z.enum(['connected', 'disconnected']),
  cloud: z.enum(['online', 'offline']),
  rs485: z.enum(['ok', 'error']),
  wifi: z.enum(['online', 'offline']),
}).passthrough();

const TelemetryPayloadSchema = z.object({
  pid: z.string(),
  gatewayId: z.string().min(1),
  siteId: z.string().min(1),
  timestamp: z.number().positive(),
  system: SystemSchema,
  devices: z.record(z.unknown()),
}).passthrough();

const StatusPayloadSchema = z.object({
  gatewayId: z.string().min(1),
  siteId: z.string().min(1),
  online: z.boolean().optional().default(true),
  fw: z.string().optional(),
  uplink: z.enum(['wifi', 'lan', '4g']).optional(),
  signal4g: z.number().optional(),
  signalLan: z.boolean().optional(),
  uptime: z.number().nonnegative().optional(),
  heap: z.number().nonnegative().optional(),
  rssi: z.number().optional(),
}).passthrough();

const AlarmPayloadSchema = z.object({
  alarmId: z.string().min(1),
  siteId: z.string().min(1),
  gatewayId: z.string().min(1),
  deviceId: z.string().min(1),
  parameter: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  severity: z.enum(['warning', 'critical']),
  timestamp: z.number().positive(),
  active: z.boolean(),
}).passthrough();

// ─── Safe JSON parse ──────────────────────────────────────────────────────────

function safeParseJson(buf: Buffer): unknown | null {
  try {
    return JSON.parse(buf.toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

// ─── Topic routing ────────────────────────────────────────────────────────────

/**
 * Routes an incoming MQTT message by topic suffix.
 * fireguard/{siteId}/{gatewayId}/telemetry | status | alarm
 */
export async function handleMqttMessage(topic: string, payload: Buffer): Promise<void> {
  const parts = topic.split('/');
  // parts: ['fireguard', siteId, gatewayId, suffix]
  if (parts.length < 4 || parts[0] !== 'fireguard') return;

  const suffix = parts[parts.length - 1];

  try {
    if (suffix === 'telemetry') {
      await handleTelemetry(payload);
    } else if (suffix === 'status') {
      await handleStatus(payload);
    } else if (suffix === 'alarm') {
      await handleAlarm(payload);
    } else if (suffix === 'sim') {
      await handleSim(parts[1] ?? '', parts[2] ?? '', payload);
    }
    // Ignore config/set, command, ota — those are server→device topics
  } catch (err) {
    logger.error({ err, topic }, 'Unexpected error in MQTT handler');
  }
}

// ─── Telemetry handler ────────────────────────────────────────────────────────

export async function handleTelemetry(
  payload: Buffer,
  source: 'mqtt' | 'http' = 'mqtt'
): Promise<void> {
  const raw = safeParseJson(payload);
  if (raw === null) {
    logger.warn('MQTT telemetry: invalid JSON — dropped');
    return;
  }

  const parsed = TelemetryPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'MQTT telemetry: schema invalid — dropped');
    return;
  }

  const d = parsed.data;

  try {
    // Build devices map — strip the digitalInputs/digitalOutputs sub-keys
    const devicesRaw = d.devices as Record<string, unknown>;
    const { digitalInputs, digitalOutputs, ...restDevices } = devicesRaw;

    await Telemetry.create({
      gatewayId: d.gatewayId,
      siteId: d.siteId,
      pid: d.pid,
      deviceTs: d.timestamp,
      timestamp: new Date(),
      system: {
        uptime: d.system.uptime,
        heap: d.system.heap,
        fw: d.system.fw,
        releaseDate: d.system.releaseDate,
        uplink: d.system.uplink,
        signal4g: d.system.signal4g,
        signalLan: d.system.signalLan,
        rssi: d.system.rssi,
        mqtt: d.system.mqtt,
        cloud: d.system.cloud,
        rs485: d.system.rs485,
        wifi: d.system.wifi,
      },
      devices: restDevices as Record<string, IDeviceReading>,
      digitalInputs: digitalInputs as IDigitalInputs | undefined,
      digitalOutputs: digitalOutputs as IDigitalOutputs | undefined,
      source,
    });

    // Update Gateway heartbeat
    await Gateway.findOneAndUpdate(
      { gatewayId: d.gatewayId },
      {
        $set: {
          lastSeenAt: new Date(),
          online: true,
          uplink: d.system.uplink,
          fw: d.system.fw,
          rssi: d.system.rssi,
          signal4g: d.system.signal4g,
          signalLan: d.system.signalLan,
          uptime: d.system.uptime,
          heap: d.system.heap,
        },
      },
      { upsert: false }
    );

    emitTelemetry(d.siteId, {
      gatewayId: d.gatewayId,
      siteId: d.siteId,
      deviceTs: d.timestamp,
      timestamp: new Date().toISOString(),
      system: d.system,
      devices: d.devices,
      source,
    });
  } catch (err) {
    logger.error({ err, gatewayId: d.gatewayId }, 'Failed to persist telemetry');
  }
}

// ─── Status handler ───────────────────────────────────────────────────────────

export async function handleStatus(payload: Buffer): Promise<void> {
  const raw = safeParseJson(payload);
  if (raw === null) {
    logger.warn('MQTT status: invalid JSON — dropped');
    return;
  }

  const parsed = StatusPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'MQTT status: schema invalid — dropped');
    return;
  }

  const d = parsed.data;

  try {
    const update: Record<string, unknown> = {
      lastSeenAt: new Date(),
      online: d.online ?? true,
    };
    if (d.fw !== undefined) update['fw'] = d.fw;
    if (d.uplink !== undefined) update['uplink'] = d.uplink;
    if (d.signal4g !== undefined) update['signal4g'] = d.signal4g;
    if (d.signalLan !== undefined) update['signalLan'] = d.signalLan;
    if (d.uptime !== undefined) update['uptime'] = d.uptime;
    if (d.heap !== undefined) update['heap'] = d.heap;
    if (d.rssi !== undefined) update['rssi'] = d.rssi;

    await Gateway.findOneAndUpdate(
      { gatewayId: d.gatewayId },
      { $set: update as object },
      { upsert: false }
    );

    emitGatewayStatus(d.siteId, {
      gatewayId: d.gatewayId,
      siteId: d.siteId,
      online: d.online ?? true,
      fw: d.fw,
      uplink: d.uplink,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err, gatewayId: d.gatewayId }, 'Failed to update gateway status');
  }
}

// ─── Alarm handler ────────────────────────────────────────────────────────────

export async function handleAlarm(
  payload: Buffer,
  source: 'mqtt' | 'http' = 'mqtt'
): Promise<void> {
  const raw = safeParseJson(payload);
  if (raw === null) {
    logger.warn('MQTT alarm: invalid JSON — dropped');
    return;
  }

  const parsed = AlarmPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'MQTT alarm: schema invalid — dropped');
    return;
  }

  const d = parsed.data;

  try {
    // Idempotent upsert by alarmId — device may resend
    const alarm = await Alarm.findOneAndUpdate(
      { alarmId: d.alarmId },
      {
        $setOnInsert: {
          alarmId: d.alarmId,
          siteId: d.siteId,
          gatewayId: d.gatewayId,
          deviceId: d.deviceId,
          parameter: d.parameter,
          source,
        },
        $set: {
          value: d.value,
          severity: d.severity,
          timestamp: new Date(d.timestamp * 1000),
          active: d.active,
        },
      },
      { upsert: true, new: true }
    );

    if (alarm) {
      emitAlarm(d.siteId, alarm.toObject());

      // Push once per active alarm (device may resend the same alarmId).
      if (alarm.active && !alarm.notifiedAt) {
        await Alarm.updateOne({ _id: alarm._id }, { $set: { notifiedAt: new Date() } });
        void sendAlarmPush(alarm);
      }
    }
  } catch (err) {
    logger.error({ err, alarmId: d.alarmId }, 'Failed to persist alarm');
  }
}

// ─── SIM / cellular response handler ──────────────────────────────────────────
// Gateway replies on fireguard/{siteId}/{gatewayId}/sim to sim_info/read_sms/ussd/test_sms.

const SimInboxItemSchema = z.object({
  from: z.string().optional(),
  text: z.string().default(''),
  ts: z.string().optional(),
});

const SimPayloadSchema = z.object({
  type: z.enum(['sim_info', 'sms_list', 'ussd', 'test_sms']).optional(),
  iccid: z.string().optional(),
  imsi: z.string().optional(),
  number: z.string().optional(),
  operator: z.string().optional(),
  signal: z.number().optional(),
  registered: z.boolean().optional(),
  canSend: z.boolean().optional(),
  balanceText: z.string().optional(),
  messages: z.array(SimInboxItemSchema).optional(),
  ok: z.boolean().optional(),
  error: z.string().optional(),
});

export async function handleSim(siteId: string, gatewayId: string, payload: Buffer): Promise<void> {
  const raw = safeParseJson(payload);
  if (raw === null) {
    logger.warn('MQTT sim: invalid JSON — dropped');
    return;
  }
  const parsed = SimPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'MQTT sim: schema invalid — dropped');
    return;
  }
  const d = parsed.data;

  try {
    // Merge only the fields present in this response into gateway.sim
    const set: Record<string, unknown> = { 'sim.lastCheckedAt': new Date() };
    if (d.iccid !== undefined) set['sim.iccid'] = d.iccid;
    if (d.imsi !== undefined) set['sim.imsi'] = d.imsi;
    if (d.number !== undefined) set['sim.number'] = d.number;
    if (d.operator !== undefined) set['sim.operator'] = d.operator;
    if (d.signal !== undefined) set['sim.signal'] = d.signal;
    if (d.registered !== undefined) set['sim.registered'] = d.registered;
    if (d.canSend !== undefined) set['sim.canSend'] = d.canSend;
    if (d.balanceText !== undefined) set['sim.balanceText'] = d.balanceText;
    if (d.messages !== undefined) set['sim.messages'] = d.messages.slice(0, 20);

    await Gateway.findOneAndUpdate({ gatewayId }, { $set: set });

    emitSim(siteId, { gatewayId, ...d, at: new Date().toISOString() });
    logger.info({ gatewayId, type: d.type }, 'SIM response ingested');
  } catch (err) {
    logger.error({ err, gatewayId }, 'Failed to persist SIM response');
  }
}
