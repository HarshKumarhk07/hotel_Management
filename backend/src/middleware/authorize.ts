import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@/constants';
import { ROLES } from '@/constants';
import { AppError } from '@/utils/AppError';

/**
 * Role-based access control. Use after `authenticate`. Example:
 *   router.post('/kitchens', authenticate, authorize(ROLES.SUPER_ADMIN), handler)
 */
export function authorize(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(AppError.unauthorized('Authentication required'));
      return;
    }
    if (!allowed.includes(req.auth.role)) {
      next(AppError.forbidden('You do not have permission to perform this action', 'RBAC_DENIED'));
      return;
    }
    next();
  };
}

/**
 * Tenant guard for kitchen-scoped resources. Super admins pass through; kitchen
 * owners are restricted to their own kitchen. The kitchen id is read from the
 * route param (default `kitchenId`).
 */
export function sameKitchen(param = 'kitchenId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(AppError.unauthorized('Authentication required'));
      return;
    }
    if (req.auth.role === ROLES.SUPER_ADMIN) return next();
    const target = req.params[param] ?? req.body?.kitchen;
    if (req.auth.role === ROLES.KITCHEN_OWNER && req.auth.kitchenId === target) return next();
    next(AppError.forbidden('Resource belongs to a different kitchen', 'CROSS_TENANT_DENIED'));
  };
}
