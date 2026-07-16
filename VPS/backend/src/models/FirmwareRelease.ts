/**
 * FirmwareRelease model — OTA firmware manifest registry.
 * The manifest endpoint queries this to decide whether to trigger an OTA update.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFirmwareRelease {
  /** Hardware target e.g. 'vvm401' */
  hw: string;
  /** Semantic version e.g. '1.2.3' */
  version: string;
  /** Absolute URL to .bin file */
  url: string;
  /** SHA-256 hex digest */
  sha256: string;
  /** File size in bytes */
  size: number;
  /** Device MUST update (blocks normal operation if behind) */
  mandatory: boolean;
  /** Minimum firmware version this update can be applied from. Null = any. */
  minFrom?: string;
  releasedAt: Date;
  active: boolean;
  releaseNotes?: string;
}

export interface IFirmwareReleaseDocument extends IFirmwareRelease, Document {}

const FirmwareReleaseSchema = new Schema<IFirmwareReleaseDocument>(
  {
    hw: {
      type: String,
      required: [true, 'hw is required'],
      trim: true,
      lowercase: true,
    },
    version: {
      type: String,
      required: [true, 'version is required'],
      match: [/^\d+\.\d+\.\d+$/, 'version must be semver (x.y.z)'],
    },
    url: {
      type: String,
      required: [true, 'url is required'],
    },
    sha256: {
      type: String,
      required: [true, 'sha256 is required'],
      match: [/^[a-f0-9]{64}$/, 'sha256 must be a 64-char hex string'],
    },
    size: {
      type: Number,
      required: [true, 'size is required'],
      min: [1, 'size must be positive'],
    },
    mandatory: { type: Boolean, default: false },
    minFrom: { type: String },
    releasedAt: { type: Date, required: true, default: Date.now },
    active: { type: Boolean, default: true },
    releaseNotes: { type: String, maxlength: 2000 },
  },
  {
    timestamps: true,
    collection: 'firmware_releases',
  }
);

FirmwareReleaseSchema.index({ hw: 1, active: 1, releasedAt: -1 });
FirmwareReleaseSchema.index({ hw: 1, version: 1 }, { unique: true });

export const FirmwareRelease: Model<IFirmwareReleaseDocument> =
  mongoose.model<IFirmwareReleaseDocument>('FirmwareRelease', FirmwareReleaseSchema);
