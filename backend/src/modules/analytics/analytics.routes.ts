import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './analytics.controller';

const router = Router();

// Analytics is for staff: kitchen owners (own kitchen) and super admins (all).
router.use(authenticate, authorize(ROLES.KITCHEN_OWNER, ROLES.SUPER_ADMIN));

/**
 * @openapi
 * tags:
 *   - name: Analytics
 *     description: Revenue, orders, items, peak hours, refunds, and exports
 */

/**
 * @openapi
 * /analytics/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: One-shot dashboard (summary + trends + items + peak hours + refunds)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: from, in: query, schema: { type: string, format: date } }
 *       - { name: to, in: query, schema: { type: string, format: date } }
 *       - { name: kitchen, in: query, schema: { type: string } }
 *     responses: { 200: { description: Dashboard data } }
 */
router.get('/dashboard', validate({ query: ctrl.rangeSchema }), ctrl.dashboard);
router.get('/summary', validate({ query: ctrl.rangeSchema }), ctrl.summary);
router.get('/revenue-trends', validate({ query: ctrl.rangeSchema }), ctrl.revenueTrends);
router.get('/top-items', validate({ query: ctrl.rangeSchema }), ctrl.topItems);
router.get('/peak-hours', validate({ query: ctrl.rangeSchema }), ctrl.peakHours);
router.get('/refunds', validate({ query: ctrl.rangeSchema }), ctrl.refunds);
router.get('/kitchen-performance', validate({ query: ctrl.rangeSchema }), ctrl.kitchenPerformance);

/**
 * @openapi
 * /analytics/export:
 *   get:
 *     tags: [Analytics]
 *     summary: Export a report as CSV, Excel, or PDF
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: format, in: query, schema: { type: string, enum: [csv, xlsx, pdf] } }
 *       - { name: report, in: query, schema: { type: string, enum: [orders, summary, top-items] } }
 *     responses: { 200: { description: File download } }
 */
router.get('/export', validate({ query: ctrl.exportSchema }), ctrl.exportReport);

export default router;
