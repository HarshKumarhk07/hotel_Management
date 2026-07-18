import crypto from 'node:crypto';
import type { Request } from 'express';
import { UAParser } from 'ua-parser-js';

/**
 * Best-effort client IP. Honour the first X-Forwarded-For hop set by our trusted
 * proxy (Railway/Render/Vercel) and fall back to the socket address.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]!.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export interface DeviceInfo {
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  /** Stable-ish fingerprint from UA + accept-language; not a strong identifier. */
  fingerprint: string;
}

export function getDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.headers['user-agent'] ?? 'unknown';
  const lang = (req.headers['accept-language'] as string) ?? '';
  const parser = new UAParser(userAgent);
  const { browser, os, device } = parser.getResult();

  const fingerprint = crypto
    .createHash('sha256')
    .update(`${userAgent}|${lang}`)
    .digest('hex')
    .slice(0, 32);

  return {
    userAgent,
    browser: [browser.name, browser.version].filter(Boolean).join(' ') || 'unknown',
    os: [os.name, os.version].filter(Boolean).join(' ') || 'unknown',
    device: device.type ?? 'desktop',
    fingerprint,
  };
}
