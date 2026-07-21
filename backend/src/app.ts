import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { timingSafeEqual } from 'node:crypto';
import { env, isProd } from '@/config/env';
import { swaggerSpec } from '@/config/swagger';
import { applySecurity } from '@/middleware/security';
import { requestContext } from '@/middleware/requestContext';
import { globalLimiter } from '@/middleware/rateLimit';
import { errorHandler, notFound } from '@/middleware/errorHandler';
import apiRoutes from '@/routes';
import { AppError } from '@/utils/AppError';
import { logger } from '@/config/logger';

/**
 * Build and configure the Express application. Kept separate from the server
 * bootstrap so tests can import the app without binding a port or socket.
 */
export function createApp(): Express {
  const app = express();

  // Behind a single trusted proxy (Railway/Render/Vercel) — needed for correct
  // client IPs and rate limiting.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ── CORS: strict allowlist, credentials enabled, no wildcards ──
  const allowlist = new Set(env.CORS_ORIGINS);
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server (no Origin header) requests.
        if (!origin || allowlist.has(origin)) return cb(null, true);
        cb(new AppError(403, `Origin ${origin} not allowed by CORS`, 'CORS_BLOCKED'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    }),
  );

  // Body & cookie parsing (with size limits to blunt payload-flood attacks).
  // `verify` stashes the raw buffer so the Razorpay webhook can validate its
  // HMAC signature against the exact bytes we received.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(compression());

  // Security stack + per-request context.
  applySecurity(app);
  app.use(requestContext);

  // ── HTTP Request & Response Logger Middleware ──
  app.use((req, res, next) => {
    const startTime = Date.now();
    const safeBody = req.body ? structuredClone(req.body) : {};
    const sensitiveKeys = ['password', 'token', 'refreshToken', 'accessToken', 'secret', 'cookie', 'authorization'];
    const redact = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (sensitiveKeys.includes(key.toLowerCase())) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          redact(obj[key]);
        }
      }
    };
    redact(safeBody);

    logger.info(
      {
        requestId: req.context?.requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.context?.ip,
        device: req.context?.device,
        query: req.query,
        body: safeBody,
      },
      `Incoming Request: ${req.method} ${req.originalUrl}`
    );

    const originalSend = res.send;
    res.send = function (body?: any) {
      const duration = Date.now() - startTime;
      logger.info(
        {
          requestId: req.context?.requestId,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: duration,
        },
        `Response Sent: ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`
      );
      return originalSend.call(res, body);
    };

    next();
  });
  app.use(globalLimiter);

  // ── Root liveness route ──
  // Answers GET/HEAD `/` so platform health probes (e.g. Render) don't 404.
  app.get('/', (_req, res) => {
    res.status(200).json({ success: true, message: 'KDS API is running' });
  });
  app.head('/', (_req, res) => res.sendStatus(200));

  // ── API docs ──
  // Open in non-production. In production the OpenAPI spec is sensitive surface
  // area, so it is exposed ONLY when Basic-auth credentials are configured
  // (SWAGGER_USER / SWAGGER_PASSWORD); otherwise it is not mounted at all.
  mountDocs(app);

  // Versioned API.
  app.use(env.API_PREFIX, apiRoutes);

  // 404 + centralised error handler (must be last).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/** Constant-time string compare to avoid leaking credential length/prefix. */
function safeStrEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** HTTP Basic-auth guard for the Swagger routes in production. */
function swaggerBasicAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Basic ')) {
    const [user, pass] = Buffer.from(header.slice(6), 'base64').toString().split(':');
    if (
      env.SWAGGER_USER &&
      env.SWAGGER_PASSWORD &&
      safeStrEqual(user ?? '', env.SWAGGER_USER) &&
      safeStrEqual(pass ?? '', env.SWAGGER_PASSWORD)
    ) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="API docs"').status(401).send('Authentication required');
}

/** Mount Swagger UI + spec, protected (or hidden) according to environment. */
function mountDocs(app: Express): void {
  const serveDocs = (): void => {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get('/docs.json', (_req, res) => res.json(swaggerSpec));
  };

  if (!isProd) {
    serveDocs();
    return;
  }
  // Production: require Basic-auth credentials, or don't expose docs at all.
  if (env.SWAGGER_USER && env.SWAGGER_PASSWORD) {
    app.use(['/docs', '/docs.json'], swaggerBasicAuth);
    serveDocs();
  }
}
