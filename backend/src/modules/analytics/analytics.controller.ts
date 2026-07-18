import { z } from 'zod';
import type { Request, Response } from 'express';
import { ROLES } from '@/constants';
import { Order } from '@/models';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { EXPORT_MIME, toCsv, toExcel, toPdf, type Table } from '@/services/export.service';
import * as analytics from './analytics.service';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const rangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  kitchen: objectId.optional(),
  granularity: z.enum(['day', 'week', 'month']).optional(),
});

export const exportSchema = rangeSchema.extend({
  format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
  report: z.enum(['orders', 'summary', 'top-items']).default('orders'),
});

/**
 * Resolve the analytics scope from the request. Kitchen owners are hard-locked
 * to their own kitchen; super admins may pass `?kitchen=` to filter or omit it
 * for system-wide figures.
 */
function scopeFrom(req: Request): analytics.AnalyticsScope {
  const q = req.query as { from?: Date; to?: Date; kitchen?: string };
  if (req.auth!.role === ROLES.KITCHEN_OWNER) {
    return { kitchenId: req.auth!.kitchenId, from: q.from, to: q.to };
  }
  return { kitchenId: q.kitchen, from: q.from, to: q.to };
}

export const dashboard = asyncHandler(async (req: Request, res) => {
  const data = await analytics.getDashboard(scopeFrom(req));
  return ok(res, data);
});

export const summary = asyncHandler(async (req: Request, res) => {
  return ok(res, await analytics.getSummary(scopeFrom(req)));
});

export const revenueTrends = asyncHandler(async (req: Request, res) => {
  const granularity = ((req.query as { granularity?: string }).granularity ?? 'day') as
    | 'day'
    | 'week'
    | 'month';
  return ok(res, { trends: await analytics.getRevenueTrends(scopeFrom(req), granularity) });
});

export const topItems = asyncHandler(async (req: Request, res) => {
  const [top, least] = await Promise.all([
    analytics.getTopItems(scopeFrom(req)),
    analytics.getLeastItems(scopeFrom(req)),
  ]);
  return ok(res, { topItems: top, leastItems: least });
});

export const peakHours = asyncHandler(async (req: Request, res) => {
  return ok(res, { peakHours: await analytics.getPeakHours(scopeFrom(req)) });
});

export const refunds = asyncHandler(async (req: Request, res) => {
  return ok(res, { refunds: await analytics.getRefundAnalytics(scopeFrom(req)) });
});

export const kitchenPerformance = asyncHandler(async (req: Request, res) => {
  return ok(res, { performance: await analytics.getKitchenPerformance(scopeFrom(req)) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Export — builds a flat Table then serialises to CSV / XLSX / PDF
// ─────────────────────────────────────────────────────────────────────────────
async function buildTable(req: Request, report: string): Promise<Table> {
  const scope = scopeFrom(req);

  if (report === 'orders') {
    const match: Record<string, unknown> = {};
    if (scope.kitchenId) match.kitchen = scope.kitchenId;
    if (scope.from || scope.to) {
      match.createdAt = {};
      if (scope.from) (match.createdAt as Record<string, Date>).$gte = scope.from;
      if (scope.to) (match.createdAt as Record<string, Date>).$lte = scope.to;
    }
    const orders = await Order.find(match).sort({ createdAt: -1 }).limit(5000);
    return {
      title: 'Orders report',
      headers: ['Order #', 'Date', 'Room', 'Status', 'Payment', 'Subtotal', 'Discount', 'Total', 'Refund'],
      rows: orders.map((o) => [
        o.orderNumber,
        o.createdAt.toISOString(),
        o.roomSnapshot?.roomNumber ?? o.tableSnapshot?.number ?? '—',
        o.status,
        o.payment.status,
        o.pricing.subtotal,
        o.pricing.discount,
        o.pricing.total,
        o.refund.status,
      ]),
    };
  }

  if (report === 'top-items') {
    const items = await analytics.getTopItems(scope, 50);
    return {
      title: 'Best selling items',
      headers: ['Item', 'Quantity sold', 'Revenue'],
      rows: items.map((i: { name: string; quantitySold: number; revenue: number }) => [
        i.name,
        i.quantitySold,
        i.revenue,
      ]),
    };
  }

  // summary
  const s = await analytics.getSummary(scope);
  return {
    title: 'Summary report',
    headers: ['Metric', 'Value'],
    rows: [
      ['Total orders', s.totalOrders],
      ['Revenue', s.revenue],
      ['Pending orders', s.pendingOrders],
      ['Completed orders', s.completedOrders],
      ['Cancelled orders', s.cancelledOrders],
      ['Avg order value', s.avgOrderValue],
      ['Cancellation rate', s.cancellationRate],
      ['Refunded amount', s.refundedAmount],
      ['Discount given', s.discountGiven],
    ],
  };
}

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const format = (req.query.format as 'csv' | 'xlsx' | 'pdf') ?? 'csv';
  const report = (req.query.report as string) ?? 'orders';
  const table = await buildTable(req, report);
  const filename = `${report}-report.${format}`;

  res.setHeader('Content-Type', EXPORT_MIME[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  if (format === 'csv') {
    res.send(toCsv(table));
    return;
  }
  if (format === 'xlsx') {
    res.send(await toExcel(table));
    return;
  }
  if (format === 'pdf') {
    res.send(await toPdf(table));
    return;
  }
  throw AppError.badRequest('Unsupported export format', 'BAD_FORMAT');
});
