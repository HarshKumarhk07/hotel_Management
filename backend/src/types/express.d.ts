import type { Role } from '@/constants';
import type { DeviceInfo } from '@/utils/request';

/**
 * Request augmentation: `req.auth` is populated by the authenticate middleware,
 * `req.context` by the request-context middleware.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface AuthContext {
      userId: string;
      role: Role;
      email: string;
      kitchenId?: string;
    }

    interface RequestContext {
      ip: string;
      device: DeviceInfo;
      requestId: string;
    }

    interface Request {
      auth?: AuthContext;
      context: RequestContext;
      /** Raw request body bytes (set by the json parser) for webhook HMAC checks. */
      rawBody?: Buffer;
    }
  }
}

export {};
