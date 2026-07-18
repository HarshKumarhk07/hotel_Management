import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getClientIp, getDeviceInfo } from '@/utils/request';

/**
 * Attaches a per-request context (request id, client IP, parsed device info) so
 * downstream handlers, audit logs, and error responses can reference it without
 * re-parsing headers. Echoes the request id back via `X-Request-Id`.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.context = {
    requestId,
    ip: getClientIp(req),
    device: getDeviceInfo(req),
  };
  res.setHeader('X-Request-Id', requestId);
  next();
}
