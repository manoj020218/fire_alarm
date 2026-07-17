/**
 * PushToken model — an FCM device/browser token registered by a logged-in user.
 * One user may have several (phone, tablet, browser). Token is unique; a token
 * moving to a new user is re-owned via upsert.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export type PushPlatform = 'android' | 'ios' | 'web';

export interface IPushToken {
  token: string;
  userId: string;
  siteIds: string[];
  platform: PushPlatform;
  lastSeenAt: Date;
}

export interface IPushTokenDocument extends IPushToken, Document {}

const PushTokenSchema = new Schema<IPushTokenDocument>(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    siteIds: { type: [String], default: [] },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'push_tokens' }
);

export const PushToken: Model<IPushTokenDocument> = mongoose.model<IPushTokenDocument>(
  'PushToken',
  PushTokenSchema
);
