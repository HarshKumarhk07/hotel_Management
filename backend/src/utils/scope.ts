import type { Request } from 'express';
import { ROLES } from '@/constants';
import { AppError } from './AppError';

/**
 * Resolve which kitchen the current actor is operating on for kitchen-scoped
 * resources (categories, menu items, orders…):
 *  - KITCHEN_OWNER → their own kitchen (an explicit id, if given, must match).
 *  - SUPER_ADMIN   → must specify the kitchen explicitly (no implicit default).
 * Throws 403/400 otherwise.
 */
export function resolveKitchenScope(req: Request, explicitKitchenId?: string): string {
  const auth = req.auth;
  if (!auth) throw AppError.unauthorized('Authentication required');

  if (auth.role === ROLES.KITCHEN_OWNER) {
    if (!auth.kitchenId) throw AppError.forbidden('No kitchen assigned to this account', 'NO_KITCHEN');
    if (explicitKitchenId && explicitKitchenId !== auth.kitchenId) {
      throw AppError.forbidden('Resource belongs to a different kitchen', 'CROSS_TENANT_DENIED');
    }
    return auth.kitchenId;
  }

  if (auth.role === ROLES.SUPER_ADMIN) {
    if (!explicitKitchenId) {
      throw AppError.badRequest('A kitchen id is required for this action', 'KITCHEN_REQUIRED');
    }
    return explicitKitchenId;
  }

  throw AppError.forbidden('You do not have permission to perform this action', 'RBAC_DENIED');
}

/** Assert the actor may act on a resource that belongs to `resourceKitchenId`. */
export function assertKitchenAccess(req: Request, resourceKitchenId: string): void {
  const auth = req.auth;
  if (!auth) throw AppError.unauthorized('Authentication required');
  if (auth.role === ROLES.SUPER_ADMIN) return;
  if (auth.role === ROLES.KITCHEN_OWNER && auth.kitchenId === resourceKitchenId) return;
  throw AppError.forbidden('Resource belongs to a different kitchen', 'CROSS_TENANT_DENIED');
}
