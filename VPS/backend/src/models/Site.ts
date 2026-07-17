/**
 * Site model — represents a physical installation location.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'expired';

export interface ISite {
  siteId: string;
  name: string;
  address: string;
  timezone: string;
  active: boolean;
  contactName?: string;
  contactPhone?: string;
  // ── Billing / subscription fields ─────────────────────────────────────────
  subscription: SubscriptionStatus;
  trialEndsAt?: Date;
  graceDays: number;
  deviceLimit?: number;      // undefined/null = unlimited
  billingClientId?: string;
}

export interface ISiteDocument extends ISite, Document {}

const SiteSchema = new Schema<ISiteDocument>(
  {
    siteId: {
      type: String,
      required: [true, 'siteId is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9_-]{3,20}$/, 'siteId must be 3-20 alphanumeric chars'],
    },
    name: {
      type: String,
      required: [true, 'Site name is required'],
      trim: true,
      maxlength: 100,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: 300,
    },
    timezone: {
      type: String,
      required: [true, 'Timezone is required'],
      default: 'Asia/Kolkata',
    },
    active: {
      type: Boolean,
      default: true,
    },
    contactName: { type: String, trim: true, maxlength: 100 },
    contactPhone: { type: String, trim: true, maxlength: 20 },
    // ── Billing / subscription ───────────────────────────────────────────────
    subscription: {
      type: String,
      enum: ['trial', 'active', 'suspended', 'expired'],
      default: 'trial',
      required: true,
    },
    trialEndsAt: { type: Date },
    graceDays: { type: Number, default: 15, min: 0, max: 365 },
    deviceLimit: { type: Number, min: 0 },         // absent = unlimited
    billingClientId: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: 'sites',
  }
);

// siteId uniqueness comes from the field-level `unique: true`
SiteSchema.index({ active: 1 });

export const Site: Model<ISiteDocument> = mongoose.model<ISiteDocument>('Site', SiteSchema);
