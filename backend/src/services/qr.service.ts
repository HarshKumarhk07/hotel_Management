import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { env } from '@/config/env';

/**
 * QR token + image generation.
 *
 * The token is an opaque, URL-safe id embedded in the scan URL. It carries no
 * room data itself — the backend resolves it — so a leaked image reveals nothing
 * and the code can be invalidated by rotating the token.
 */
export function generateQrToken(): string {
  // 21-char nanoid → ~149 bits of entropy; effectively unguessable.
  return nanoid();
}

/** The public URL a guest lands on after scanning. */
export function buildScanUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? env.APP_URL;
  return `${base.replace(/\/$/, '')}/r/${token}`;
}

export interface QrRenderOptions {
  /** Pixel size of the (square) PNG. */
  size?: number;
  margin?: number;
}

/** Render the QR for a token as a PNG buffer (for download endpoints). */
export function renderQrPng(token: string, opts: QrRenderOptions = {}, baseUrl?: string): Promise<Buffer> {
  return QRCode.toBuffer(buildScanUrl(token, baseUrl), {
    type: 'png',
    width: opts.size ?? 512,
    margin: opts.margin ?? 2,
    errorCorrectionLevel: 'M',
  });
}

/** Render the QR as a base64 data URL (for inline display / JSON responses). */
export function renderQrDataUrl(token: string, opts: QrRenderOptions = {}, baseUrl?: string): Promise<string> {
  return QRCode.toDataURL(buildScanUrl(token, baseUrl), {
    width: opts.size ?? 512,
    margin: opts.margin ?? 2,
    errorCorrectionLevel: 'M',
  });
}

/** Render the QR as crisp, scalable SVG markup. */
export function renderQrSvg(token: string, baseUrl?: string): Promise<string> {
  return QRCode.toString(buildScanUrl(token, baseUrl), { type: 'svg', margin: 2 });
}
