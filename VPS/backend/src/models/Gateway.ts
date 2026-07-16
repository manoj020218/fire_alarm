/**
 * Gateway model — represents a Vajruino VVM401 device.
 * deviceToken is a per-gateway secret used by the device for HTTP auth.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export type UplinkType = 'wifi' | 'lan' | '4g';

export interface IGateway {
  gatewayId: string;
  siteId: string;
  name: string;
  fw: string;
  hw: string;
  lastSeenAt?: Date;
  online: boolean;
  uplink?: UplinkType;
  /** Per-gateway API token — used by device in X-Gateway-Token header */
  deviceToken: string;
  rssi?: number;
  signal4g?: number;
  signalLan?: boolean;
  uptime?: number;
  heap?: number;
}

export interface IGatewayDocument extends IGateway, Document {}

const GatewaySchema = new Schema<IGatewayDocument>(
  {
    gatewayId: {
      type: String,
      required: [true, 'gatewayId is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    siteId: {
      type: String,
      required: [true, 'siteId is required'],
      ref: 'Site',
    },
    name: {
      type: String,
      required: [true, 'Gateway name is required'],
      trim: true,
      maxlength: 100,
    },
    fw: {
      type: String,
      default: '0.0.0',
      trim: true,
    },
    hw: {
      type: String,
      default: 'vvm401',
      trim: true,
    },
    lastSeenAt: { type: Date },
    online: { type: Boolean, default: false },
    uplink: {
      type: String,
      enum: ['wifi', 'lan', '4g'],
    },
    /** Indexed for O(1) device auth lookups */
    deviceToken: {
      type: String,
      required: [true, 'deviceToken is required'],
      select: false,
    },
    rssi: { type: Number },
    signal4g: { type: Number },
    signalLan: { type: Boolean },
    uptime: { type: Number, min: 0 },
    heap: { type: Number, min: 0 },
  },
  {
    timestamps: true,
    collection: 'gateways',
  }
);

// gatewayId uniqueness comes from the field-level `unique: true`
GatewaySchema.index({ siteId: 1 });
GatewaySchema.index({ deviceToken: 1 }); // Fast device auth
GatewaySchema.index({ online: 1 });
GatewaySchema.index({ lastSeenAt: 1 }); // Heartbeat monitor

export const Gateway: Model<IGatewayDocument> = mongoose.model<IGatewayDocument>(
  'Gateway',
  GatewaySchema
);
