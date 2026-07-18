import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import sanitizeHtml from 'sanitize-html';
import { isProd } from '@/config/env';

/**
 * Recursively strip HTML/script content from all string values in an object.
 * Defends against stored XSS by neutralising markup at the edge. We keep it
 * conservative: no tags, no attributes allowed in user-supplied strings.
 */
function deepSanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
  }
  if (Array.isArray(value)) return value.map(deepSanitize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepSanitize(v);
    }
    return out;
  }
  return value;
}

function xssClean(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) req.body = deepSanitize(req.body);
  if (req.params) req.params = deepSanitize(req.params) as typeof req.params;
  // Note: req.query is a getter in Express 5; mutate in place if present.
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      (req.query as Record<string, unknown>)[key] = deepSanitize(
        (req.query as Record<string, unknown>)[key],
      );
    }
  }
  next();
}

/**
 * Apply the full security middleware stack to the app:
 *  - Helmet: CSP, HSTS, frameguard, noSniff, XSS protections
 *  - express-mongo-sanitize: strips `$`/`.` keys to prevent NoSQL injection
 *  - hpp: HTTP parameter pollution protection
 *  - deep HTML sanitization of inputs
 */
export function applySecurity(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: isProd ? [] : null,
        },
      },
      hsts: isProd ? { maxAge: 15_552_000, includeSubDomains: true, preload: true } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },
    }),
  );

  app.use(mongoSanitize());
  app.use(hpp());
  app.use(xssClean);
}
