import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import { AuditLog, type IAuditLog } from '@/models';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { getPageParams, pageMeta, paginationSchema } from '@/utils/pagination';
import type { FilterQuery } from 'mongoose';

const router = Router();

// Audit trail is Super-Admin only.
router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

const listSchema = paginationSchema.extend({
  action: z.string().trim().max(60).optional(),
  actorEmail: z.string().trim().toLowerCase().max(120).optional(),
  success: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * @openapi
 * /audit:
 *   get:
 *     tags: [Audit]
 *     summary: List audit-log entries (Super Admin), filterable + paginated
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: action, in: query, schema: { type: string } }
 *       - { name: actorEmail, in: query, schema: { type: string } }
 *       - { name: from, in: query, schema: { type: string, format: date } }
 *       - { name: to, in: query, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Paginated audit entries }
 */
router.get(
  '/',
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as {
      page?: number;
      limit?: number;
      action?: string;
      actorEmail?: string;
      success?: boolean;
      from?: Date;
      to?: Date;
    };
    const { page, limit, skip } = getPageParams(q);

    const filter: FilterQuery<IAuditLog> = {};
    if (q.action) filter.action = q.action;
    if (q.actorEmail) filter.actorEmail = q.actorEmail;
    if (typeof q.success === 'boolean') filter.success = q.success;
    if (q.from || q.to) {
      filter.createdAt = {};
      if (q.from) (filter.createdAt as Record<string, Date>).$gte = q.from;
      if (q.to) (filter.createdAt as Record<string, Date>).$lte = q.to;
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);
    return ok(res, { logs: items }, 200, pageMeta(total, page, limit));
  }),
);

export default router;
