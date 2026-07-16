/**
 * Report model — tracks generated reports (PDF/CSV/Excel).
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom' | 'alarm_summary';
export type ReportFormat = 'pdf' | 'csv' | 'excel';
export type ReportStatus = 'pending' | 'generating' | 'ready' | 'failed';

export interface IReport {
  siteId: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  requestedBy: string;
  requestedAt: Date;
  rangeFrom: Date;
  rangeTo: Date;
  filePath?: string;
  fileSize?: number;
  error?: string;
  completedAt?: Date;
}

export interface IReportDocument extends IReport, Document {}

const ReportSchema = new Schema<IReportDocument>(
  {
    siteId: { type: String, required: true },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom', 'alarm_summary'],
      required: true,
    },
    format: {
      type: String,
      enum: ['pdf', 'csv', 'excel'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'generating', 'ready', 'failed'],
      default: 'pending',
    },
    requestedBy: { type: String, required: true },
    requestedAt: { type: Date, required: true, default: Date.now },
    rangeFrom: { type: Date, required: true },
    rangeTo: { type: Date, required: true },
    filePath: { type: String },
    fileSize: { type: Number, min: 0 },
    error: { type: String },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'reports',
  }
);

ReportSchema.index({ siteId: 1, requestedAt: -1 });
ReportSchema.index({ status: 1 });
ReportSchema.index({ requestedBy: 1 });

export const Report: Model<IReportDocument> = mongoose.model<IReportDocument>('Report', ReportSchema);
