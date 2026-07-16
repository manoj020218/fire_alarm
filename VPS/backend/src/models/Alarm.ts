/**
 * Alarm model — fire/fault alarms from devices.
 * alarmId is device-generated; we use it for idempotent upserts.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export type AlarmSeverity = 'warning' | 'critical';

export interface IAlarm {
  alarmId: string;
  siteId: string;
  gatewayId: string;
  deviceId: string;
  parameter: string;
  value: number | string;
  severity: AlarmSeverity;
  timestamp: Date;
  active: boolean;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  acknowledgeReason?: string;
  /** 'mqtt' | 'http' */
  source: 'mqtt' | 'http';
}

export interface IAlarmDocument extends IAlarm, Document {}

const AlarmSchema = new Schema<IAlarmDocument>(
  {
    alarmId: {
      type: String,
      required: [true, 'alarmId is required'],
      unique: true,
    },
    siteId: { type: String, required: true },
    gatewayId: { type: String, required: true },
    deviceId: { type: String, required: true },
    parameter: { type: String, required: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      required: [true, 'Severity is required'],
    },
    timestamp: { type: Date, required: true },
    active: { type: Boolean, default: true },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: String },
    acknowledgedAt: { type: Date },
    acknowledgeReason: { type: String, maxlength: 500 },
    source: { type: String, enum: ['mqtt', 'http'], required: true, default: 'mqtt' },
  },
  {
    timestamps: true,
    collection: 'alarms',
  }
);

// alarmId uniqueness comes from the field-level `unique: true`
AlarmSchema.index({ siteId: 1, timestamp: -1 });
AlarmSchema.index({ gatewayId: 1, timestamp: -1 });
AlarmSchema.index({ active: 1, acknowledged: 1 });
AlarmSchema.index({ severity: 1 });
AlarmSchema.index({ siteId: 1, active: 1 }); // Dashboard active alarm count

export const Alarm: Model<IAlarmDocument> = mongoose.model<IAlarmDocument>('Alarm', AlarmSchema);
