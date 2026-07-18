import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type Socket } from 'socket.io';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { ROLES } from '@/constants';
import { verifyAccessToken } from '@/utils/jwt';
import { User } from '@/models';

/**
 * Socket.io bootstrap. Authenticates each connection with the same access token
 * used for REST, then joins role/tenant-scoped rooms so later phases can target
 * events precisely:
 *   - kitchen:<kitchenId>  → live order queue for a kitchen
 *   - user:<userId>        → a customer's order/refund updates
 *   - admins               → system-wide admin alerts
 *
 * This is the foundation; order/notification events are emitted in later phases.
 */
let io: IOServer | null = null;

export function initSocket(server: HttpServer): IOServer {
  io = new IOServer(server, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.headers.authorization?.replace('Bearer ', '') ?? '');
    
    if (!token) {
      socket.data.user = { role: 'guest' };
      return next();
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.user = {
        userId: payload.sub,
        role: payload.role,
        kitchenId: payload.kitchenId,
      };
      next();
    } catch {
      // If token is invalid, fall back to guest connection rather than rejecting
      socket.data.user = { role: 'guest' };
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as { userId?: string; role: string; kitchenId?: string } | undefined;
    
    if (user?.userId) {
      socket.join(`user:${user.userId}`);
    }
    if (user?.role === ROLES.SUPER_ADMIN) socket.join('admins');
    
    if (user?.role === ROLES.VALET_MANAGER && user?.userId) {
      socket.join('valets');
      User.findByIdAndUpdate(user.userId, { isOnline: true })
        .then(() => {
          io?.to('admins').emit('valet:status_change', { userId: user.userId, isOnline: true });
        })
        .catch((err) => logger.error({ err }, 'failed to update valet status on connect'));
    }
    
    if (user?.role === ROLES.KITCHEN_OWNER && user?.kitchenId) {
      socket.join(`kitchen:${user.kitchenId}`);
    }

    logger.debug({ userId: user?.userId, role: user?.role }, 'socket connected');
    socket.on('disconnect', () => {
      logger.debug({ userId: user?.userId }, 'socket disconnected');
      if (user?.role === ROLES.VALET_MANAGER && user?.userId) {
        // Multi-tab check: only set offline if no other connections remain for this user
        io?.in(`user:${user.userId}`).fetchSockets().then((sockets) => {
          if (sockets.length === 0) {
            User.findByIdAndUpdate(user.userId, { isOnline: false })
              .then(() => {
                io?.to('admins').emit('valet:status_change', { userId: user.userId, isOnline: false });
              })
              .catch((err) => logger.error({ err }, 'failed to update valet status on disconnect'));
          }
        });
      }
    });
  });

  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error('Socket.io not initialised');
  return io;
}
