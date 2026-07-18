import type { Request } from 'express';
import { AuditLog } from '@/models';
import type { AuditAction, Role } from '@/constants';
import { logger } from '@/config/logger';
import { getClientIp, getDeviceInfo } from '@/utils/request';

interface AuditInput {
  action: AuditAction | string;
  actor?: string | null;
  actorEmail?: string;
  role?: Role;
  target?: string;
  ip?: string;
  userAgent?: string;
  browser?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
}

/**
 * Write an audit record. Failures are logged but never throw — auditing must not
 * break the user-facing request. Fire-and-forget at call sites with `void`.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      action: input.action,
      actor: input.actor ?? undefined,
      actorEmail: input.actorEmail,
      role: input.role,
      target: input.target,
      ip: input.ip,
      userAgent: input.userAgent,
      browser: input.browser,
      metadata: input.metadata,
      success: input.success ?? true,
    });
  } catch (err) {
    logger.error({ err, action: input.action }, 'Failed to write audit log');
  }
}

/** Convenience helper that pulls IP/device straight off the request. */
export async function auditFromRequest(
  req: Request,
  input: Omit<AuditInput, 'ip' | 'userAgent' | 'browser'>,
): Promise<void> {
  const ip = req.context?.ip ?? getClientIp(req);
  const device = req.context?.device ?? getDeviceInfo(req);
  await recordAudit({
    ...input,
    ip,
    userAgent: device.userAgent,
    browser: device.browser,
  });
}
