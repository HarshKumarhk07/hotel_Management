import { logger } from '@/config/logger';
import { getIO } from './socket';

/**
 * Safe emit helpers. Socket.io is only initialised in the running server, not in
 * unit/integration tests — so these no-op (and log at debug) when the IO server
 * isn't available, letting REST handlers call them unconditionally.
 */
function safeEmit(room: string, event: string, payload: unknown): void {
  try {
    getIO().to(room).emit(event, payload);
  } catch {
    logger.debug({ room, event }, 'socket emit skipped (IO not initialised)');
  }
}

export function emitToKitchen(kitchenId: string, event: string, payload: unknown): void {
  safeEmit(`kitchen:${kitchenId}`, event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  safeEmit(`user:${userId}`, event, payload);
}

export function emitToAdmins(event: string, payload: unknown): void {
  safeEmit('admins', event, payload);
}
