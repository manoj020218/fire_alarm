/**
 * DeviceConfig model — alarm thresholds and other configurable params per device.
 * One doc per device; updated via REST → published to MQTT config/set.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IThreshold {
  low?: number;
  high?: number;
  lowCritical?: number;
  highCritical?: number;
}

export interface IDeviceConfig {
  deviceId: string;
  gatewayId: string;
  siteId: string;
  thresholds: IThreshold;
  /** Polling interval in seconds */
  pollIntervalSec?: number;
  /** Custom display label override */
  labelOverride?: string;
  /** Last time this config was pushed to the device */
  pushedAt?: Date;
  pushedBy?: string;
  /** Version counter for optimistic locking */
  version: number;
}

export interface IDeviceConfigDocument extends IDeviceConfig, Document {}

const ThresholdSchema = new Schema<IThreshold>(
  {
    low: { type: Number },
    high: { type: Number },
    lowCritical: { type: Number },
    highCritical: { type: Number },
  },
  { _id: false }
);

const DeviceConfigSchema = new Schema<IDeviceConfigDocument>(
  {
    deviceId: { type: String, required: true },
    gatewayId: { type: String, required: true },
    siteId: { type: String, required: true },
    thresholds: { type: ThresholdSchema, required: true, default: {} },
    pollIntervalSec: { type: Number, min: 5, max: 3600 },
    labelOverride: { type: String, maxlength: 80 },
    pushedAt: { type: Date },
    pushedBy: { type: String },
    version: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    collection: 'device_configs',
  }
);

DeviceConfigSchema.index({ deviceId: 1, gatewayId: 1 }, { unique: true });
DeviceConfigSchema.index({ siteId: 1 });

export const DeviceConfig: Model<IDeviceConfigDocument> = mongoose.model<IDeviceConfigDocument>(
  'DeviceConfig',
  DeviceConfigSchema
);
