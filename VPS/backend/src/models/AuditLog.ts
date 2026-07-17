/**
 * AuditLog model — immutable record of every write action.
 * Never update or delete audit logs.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ACK_ALARM'
  | 'OTA_TRIGGER'
  | 'CONFIG_CHANGE'
  | 'DEVICE_TOKEN_ROTATE'
  | 'GATEWAY_CLAIM'
  | 'GATEWAY_POOL_CREATE';

export interface IAuditLog {
  actor: string;          // userId or 'SYSTEM' or 'DEVICE:{gatewayId}'
  actorEmail?: string;
  action: AuditAction;
  entity: string;         // Collection name e.g. 'Alarm'
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  ts: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    actor: { type: String, required: true },
    actorEmail: { type: String },
    action: {
      type: String,
      enum: [
        'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
        'ACK_ALARM', 'OTA_TRIGGER', 'CONFIG_CHANGE', 'DEVICE_TOKEN_ROTATE',
        'GATEWAY_CLAIM', 'GATEWAY_POOL_CREATE',
      ],
      required: true,
    },
    entity: { type: String, required: true },
    entityId: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
    ts: { type: Date, required: true, default: Date.now },
  },
  {
    // Explicitly no updatedAt — audit logs are immutable
    timestamps: false,
    collection: 'audit_logs',
  }
);

AuditLogSchema.index({ actor: 1, ts: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, ts: -1 });
AuditLogSchema.index({ action: 1, ts: -1 });
AuditLogSchema.index({ ts: -1 });

export const AuditLog: Model<IAuditLogDocument> = mongoose.model<IAuditLogDocument>(
  'AuditLog',
  AuditLogSchema
);
