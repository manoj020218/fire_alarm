/**
 * Telemetry model — stores raw + parsed device telemetry from MQTT/HTTP.
 * TTL index based on TELEMETRY_RETENTION_DAYS env var (applied at service level).
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
import { env } from '../config/env';

export interface ISystemHealth {
  uptime: number;
  heap: number;
  fw: string;
  releaseDate: string;
  uplink: 'wifi' | 'lan' | '4g';
  signal4g?: number;
  signalLan?: boolean;
  rssi?: number;
  mqtt: 'connected' | 'disconnected';
  cloud: 'online' | 'offline';
  rs485: 'ok' | 'error';
  wifi: 'online' | 'offline';
}

export interface IDeviceReading {
  value?: number;
  status?: string;
  online: boolean;
  unit?: string;
}

export interface IDigitalInputs {
  di0?: boolean;
  di1?: boolean;
  di2?: boolean;
  di3?: boolean;
}

export interface IDigitalOutputs {
  do0?: boolean;
  do1?: boolean;
}

export interface ITelemetry {
  gatewayId: string;
  siteId: string;
  pid: string;
  /** Device-reported unix timestamp (seconds) */
  deviceTs: number;
  /** Server ingestion timestamp */
  timestamp: Date;
  system: ISystemHealth;
  /** Raw device readings keyed by deviceId */
  devices: Record<string, IDeviceReading>;
  digitalInputs?: IDigitalInputs;
  digitalOutputs?: IDigitalOutputs;
  /** 'mqtt' | 'http' — how it arrived */
  source: 'mqtt' | 'http';
}

export interface ITelemetryDocument extends ITelemetry, Document {}

const SystemHealthSchema = new Schema<ISystemHealth>(
  {
    uptime: { type: Number, required: true, min: 0 },
    heap: { type: Number, required: true, min: 0 },
    fw: { type: String, required: true },
    releaseDate: { type: String, required: true },
    uplink: { type: String, enum: ['wifi', 'lan', '4g'], required: true },
    signal4g: { type: Number },
    signalLan: { type: Boolean },
    rssi: { type: Number },
    mqtt: { type: String, enum: ['connected', 'disconnected'], required: true },
    cloud: { type: String, enum: ['online', 'offline'], required: true },
    rs485: { type: String, enum: ['ok', 'error'], required: true },
    wifi: { type: String, enum: ['online', 'offline'], required: true },
  },
  { _id: false }
);

const TelemetrySchema = new Schema<ITelemetryDocument>(
  {
    gatewayId: { type: String, required: true },
    siteId: { type: String, required: true },
    pid: { type: String, required: true },
    deviceTs: { type: Number, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    system: { type: SystemHealthSchema, required: true },
    devices: { type: Schema.Types.Mixed, required: true },
    digitalInputs: { type: Schema.Types.Mixed },
    digitalOutputs: { type: Schema.Types.Mixed },
    source: { type: String, enum: ['mqtt', 'http'], required: true, default: 'mqtt' },
  },
  {
    timestamps: false,
    collection: 'telemetry',
  }
);

// Primary query pattern: get latest N readings for a gateway in a time range
TelemetrySchema.index({ gatewayId: 1, timestamp: -1 });
TelemetrySchema.index({ siteId: 1, timestamp: -1 });

// TTL: documents expire after TELEMETRY_RETENTION_DAYS days
// expireAfterSeconds is in seconds
TelemetrySchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: env.TELEMETRY_RETENTION_DAYS * 24 * 60 * 60 }
);

export const Telemetry: Model<ITelemetryDocument> = mongoose.model<ITelemetryDocument>(
  'Telemetry',
  TelemetrySchema
);
