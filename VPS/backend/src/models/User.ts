/**
 * User model — authentication, RBAC roles, multi-site scoping.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';

export const ROLES = [
  'JENIX_SUPER_ADMIN',
  'VENDOR_ADMIN',
  'CLIENT_ADMIN',
  'MAINTENANCE_USER',
  'VIEWER',
] as const;

export type UserRole = (typeof ROLES)[number];

/** Numeric hierarchy: higher = more privileged */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  JENIX_SUPER_ADMIN: 50,
  VENDOR_ADMIN: 40,
  CLIENT_ADMIN: 30,
  MAINTENANCE_USER: 20,
  VIEWER: 10,
};

export interface IUser {
  email: string;
  passwordHash: string;
  role: UserRole;
  /** Sites this user can access. Empty = access denied (except super roles ignore this). */
  siteIds: string[];
  name: string;
  active: boolean;
  lastLoginAt?: Date;
}

export interface IUserDocument extends IUser, Document {}

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never return in queries by default
    },
    role: {
      type: String,
      enum: ROLES,
      required: [true, 'Role is required'],
    },
    siteIds: {
      type: [String],
      default: [],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// email uniqueness comes from the field-level `unique: true`
UserSchema.index({ role: 1 });
UserSchema.index({ siteIds: 1 });
UserSchema.index({ active: 1 });

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>('User', UserSchema);
