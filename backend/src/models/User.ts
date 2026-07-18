import { Schema, model, type Document, type Types } from 'mongoose';
import {
  ALL_ROLES,
  AUTH_PROVIDERS,
  ROLES,
  type AuthProvider,
  type Role,
} from '@/constants';
import { hashPassword, verifyPassword } from '@/utils/crypto';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  /** Bcrypt hash; absent for pure-OAuth accounts. Never serialised. */
  passwordHash?: string;
  role: Role;
  provider: AuthProvider;
  googleId?: string;
  avatarUrl?: string;
  phone?: string;

  /** For KITCHEN_OWNER: the kitchen they manage. */
  kitchen?: Types.ObjectId;

  isEmailVerified: boolean;
  isActive: boolean;
  
  employeeId?: string;
  isOnline?: boolean;

  // ── Lockout / brute-force protection ──
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  lastLoginIp?: string;

  createdAt: Date;
  updatedAt: Date;

  // methods
  comparePassword(plain: string): Promise<boolean>;
  isLocked(): boolean;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ALL_ROLES, default: ROLES.CUSTOMER, index: true },
    provider: {
      type: String,
      enum: Object.values(AUTH_PROVIDERS),
      default: AUTH_PROVIDERS.LOCAL,
    },
    googleId: { type: String, index: true, sparse: true },
    avatarUrl: { type: String },
    phone: { type: String, trim: true },

    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', index: true },

    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    
    employeeId: { type: String, trim: true, index: true, sparse: true },
    isOnline: { type: Boolean, default: false, index: true },

    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.failedLoginAttempts;
        delete ret.lockedUntil;
        delete ret.__v;
        return ret;
      },
    },
  },
);

/** Hash the password whenever it is set via the virtual `password` field. */
userSchema.virtual('password').set(function (this: IUser & { _pendingPassword?: string }, plain: string) {
  this._pendingPassword = plain;
});

userSchema.pre('save', async function (next) {
  const pending = (this as IUser & { _pendingPassword?: string })._pendingPassword;
  if (pending) {
    this.passwordHash = await hashPassword(pending);
    (this as IUser & { _pendingPassword?: string })._pendingPassword = undefined;
  }
  next();
});

userSchema.methods.comparePassword = function (this: IUser, plain: string): Promise<boolean> {
  if (!this.passwordHash) return Promise.resolve(false);
  return verifyPassword(plain, this.passwordHash);
};

userSchema.methods.isLocked = function (this: IUser): boolean {
  return !!this.lockedUntil && this.lockedUntil.getTime() > Date.now();
};

export const User = model<IUser>('User', userSchema);
