import { Schema, model, type Document, type Types } from 'mongoose';
import { ALL_ROLES, type AuditAction, type Role } from '@/constants';
import { env } from '@/config/env';

/**
 * Append-only audit trail. Records who did what, from where, and when.
 * Indexed for the admin audit-log viewer (filter by user/action/time).
 */
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor?: Types.ObjectId; // null for failed logins on unknown emails
  actorEmail?: string;
  role?: Role;
  action: AuditAction | string;
  /** Affected resource, e.g. "order:65f...". */
  target?: string;
  ip?: string;
  userAgent?: string;
  browser?: string;
  /** Arbitrary structured context; never include secrets/PII beyond need. */
  metadata?: Record<string, unknown>;
  success: boolean;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorEmail: { type: String, lowercase: true, trim: true },
    role: { type: String, enum: ALL_ROLES },
    action: { type: String, required: true, index: true },
    target: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    browser: { type: String },
    metadata: { type: Schema.Types.Mixed },
    success: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
// Retention: MongoDB's TTL monitor purges audit entries past the configured age
// so this append-only collection cannot grow unbounded.
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: env.AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 },
);

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
