/**
 * GatewayBackup model — device must POST a backup before OTA is permitted.
 * Durable: never delete; device re-uploads if backup is lost.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IGatewayBackup {
  backupId: string;
  gatewayId: string;
  siteId?: string;
  fwVersion: string;
  ts: Date;
  config: unknown;
  alarmState: unknown;
  undelivered: unknown;
  health: unknown;
}

export interface IGatewayBackupDocument extends IGatewayBackup, Document {}

const GatewayBackupSchema = new Schema<IGatewayBackupDocument>(
  {
    backupId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
    },
    gatewayId: { type: String, required: true },
    siteId: { type: String },
    fwVersion: { type: String, required: true },
    ts: { type: Date, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    alarmState: { type: Schema.Types.Mixed, required: true },
    undelivered: { type: Schema.Types.Mixed, required: true },
    health: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    collection: 'gateway_backups',
  }
);

// backupId uniqueness comes from the field-level `unique: true`
GatewayBackupSchema.index({ gatewayId: 1, createdAt: -1 });

export const GatewayBackup: Model<IGatewayBackupDocument> = mongoose.model<IGatewayBackupDocument>(
  'GatewayBackup',
  GatewayBackupSchema
);
