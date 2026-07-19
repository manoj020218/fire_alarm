/**
 * Gateway model — represents a Vajruino VVM401 device.
 * deviceToken is a per-gateway secret used by the device for HTTP auth.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export type UplinkType = 'wifi' | 'lan' | '4g';

/** SMS alerting + SIM operator config (pushed to the gateway). */
export interface ISmsConfig {
  enabled: boolean;
  /** comma-separated E.164 recipient numbers, e.g. "+9172...,+9198..." */
  numbers: string;
  /** 'airtel' | 'jio' | 'vi' | 'bsnl' | 'custom' */
  operator?: string;
  /** USSD code to check prepaid balance/validity, e.g. "*123#" */
  balanceUssd?: string;
  /** USSD code to fetch the SIM's own number, e.g. "*1#" */
  numberUssd?: string;
}

export interface ISmsInboxItem {
  from?: string;
  text: string;
  ts?: string;
}

/** Latest SIM/cellular status reported by the gateway (on demand or periodic). */
export interface ISimInfo {
  iccid?: string;
  imsi?: string;
  number?: string;
  operator?: string;
  /** signal quality 0-31 (CSQ) or dBm-derived bars */
  signal?: number;
  registered?: boolean;
  /** network registered + can send SMS */
  canSend?: boolean;
  /** last USSD balance response text */
  balanceText?: string;
  /** recent inbox messages fetched on demand */
  messages?: ISmsInboxItem[];
  lastCheckedAt?: Date;
}

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
  /** One-time code (printed on the unit) a customer enters to claim a pool gateway */
  claimCode?: string;
  /** false = pre-provisioned in the pool, not yet bound to a customer site (schema default: true) */
  claimed?: boolean;
  /** SMS alerting + operator config */
  smsConfig?: ISmsConfig;
  /** Latest SIM/cellular status */
  sim?: ISimInfo;
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
    /** Hidden by default; only surfaced to super-admin at pool creation */
    claimCode: { type: String, select: false, trim: true, uppercase: true },
    claimed: { type: Boolean, default: true },
    smsConfig: {
      enabled: { type: Boolean, default: false },
      numbers: { type: String, default: '', maxlength: 400 },
      operator: { type: String, trim: true, maxlength: 20 },
      balanceUssd: { type: String, trim: true, maxlength: 20 },
      numberUssd: { type: String, trim: true, maxlength: 20 },
    },
    sim: {
      iccid: { type: String, trim: true },
      imsi: { type: String, trim: true },
      number: { type: String, trim: true },
      operator: { type: String, trim: true },
      signal: { type: Number },
      registered: { type: Boolean },
      canSend: { type: Boolean },
      balanceText: { type: String, maxlength: 500 },
      messages: [{ from: String, text: String, ts: String, _id: false }],
      lastCheckedAt: { type: Date },
    },
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
