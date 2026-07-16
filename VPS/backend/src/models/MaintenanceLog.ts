/**
 * MaintenanceLog model — maintenance activities logged by MAINTENANCE_USER and above.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export type MaintenanceType =
  | 'inspection'
  | 'repair'
  | 'replacement'
  | 'testing'
  | 'calibration'
  | 'cleaning'
  | 'other';

export interface IMaintenanceLog {
  siteId: string;
  gatewayId?: string;
  deviceId?: string;
  type: MaintenanceType;
  description: string;
  performedBy: string;
  performedAt: Date;
  nextDueAt?: Date;
  attachments?: string[];
  remarks?: string;
}

export interface IMaintenanceLogDocument extends IMaintenanceLog, Document {}

const MaintenanceLogSchema = new Schema<IMaintenanceLogDocument>(
  {
    siteId: { type: String, required: true },
    gatewayId: { type: String },
    deviceId: { type: String },
    type: {
      type: String,
      enum: ['inspection', 'repair', 'replacement', 'testing', 'calibration', 'cleaning', 'other'],
      required: true,
    },
    description: { type: String, required: true, maxlength: 1000 },
    performedBy: { type: String, required: true },
    performedAt: { type: Date, required: true },
    nextDueAt: { type: Date },
    attachments: { type: [String], default: [] },
    remarks: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
    collection: 'maintenance_logs',
  }
);

MaintenanceLogSchema.index({ siteId: 1, performedAt: -1 });
MaintenanceLogSchema.index({ deviceId: 1, performedAt: -1 });
MaintenanceLogSchema.index({ type: 1 });

export const MaintenanceLog: Model<IMaintenanceLogDocument> = mongoose.model<IMaintenanceLogDocument>(
  'MaintenanceLog',
  MaintenanceLogSchema
);
