import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { validate } from '@/middleware/validate';
import * as svc from './restaurant.service';
import {
  createTableSchema,
  updateTableSchema,
  seatTableSchema,
  createReservationSchema,
  updateReservationSchema,
} from './restaurant.validation';
import type { TableStatus, ReservationStatus } from '@/constants';

// Shorthand — req.user is augmented via express.d.ts but typed as any here for simplicity
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userId = (req: Request) => (req as any).user?.id as string;

// ─── Tables ───────────────────────────────────────────────────────────────────

export const listTablesHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await svc.listTables({
    kitchenId: req.query.kitchenId as string | undefined,
    floor:     req.query.floor !== undefined ? Number(req.query.floor) : undefined,
    section:   req.query.section as string | undefined,
    status:    req.query.status as TableStatus | undefined,
    page:      req.query.page  ? Number(req.query.page)  : undefined,
    limit:     req.query.limit ? Number(req.query.limit) : undefined,
  });
  ok(res, data);
});

export const createTableHandler = [
  validate({ body: createTableSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const table = await svc.createTable({ ...req.body, actorId: userId(req) });
    ok(res, table);
  }),
];

export const updateTableHandler = [
  validate({ body: updateTableSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const table = await svc.updateTable(req.params.id, req.body, userId(req));
    ok(res, table);
  }),
];

export const deactivateTableHandler = asyncHandler(async (req: Request, res: Response) => {
  const table = await svc.deactivateTable(req.params.id, userId(req));
  ok(res, table);
});

export const regenerateQrHandler = asyncHandler(async (req: Request, res: Response) => {
  const table = await svc.regenerateTableQr(req.params.id, userId(req));
  ok(res, table);
});

export const seatTableHandler = [
  validate({ body: seatTableSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const table = await svc.seatTable(req.params.id, req.body, userId(req));
    ok(res, table);
  }),
];

export const requestBillHandler = asyncHandler(async (req: Request, res: Response) => {
  const table = await svc.requestBill(req.params.id, req.body.billAmount, userId(req));
  ok(res, table);
});

export const closeTableHandler = asyncHandler(async (req: Request, res: Response) => {
  const table = await svc.closeTable(req.params.id, userId(req));
  ok(res, table);
});

export const getTableBillHandler = asyncHandler(async (req: Request, res: Response) => {
  const bill = await svc.getTableBill(req.params.id);
  ok(res, bill);
});

// ─── Public ───────────────────────────────────────────────────────────────────

export const resolveTableHandler = asyncHandler(async (req: Request, res: Response) => {
  const table = await svc.resolveTableByToken(req.params.token);
  ok(res, table);
});

export const availabilityHandler = asyncHandler(async (req: Request, res: Response) => {
  const { scheduledAt, durationMins = '90', partySize = '1' } = req.query as Record<string, string>;
  if (!scheduledAt) throw new Error('scheduledAt query param is required');
  const tables = await svc.getAvailableTables(new Date(scheduledAt), Number(durationMins), Number(partySize));
  ok(res, tables);
});

// ─── Reservations ─────────────────────────────────────────────────────────────

export const listReservationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await svc.listReservations({
    kitchenId: req.query.kitchenId as string | undefined,
    tableId:   req.query.tableId   as string | undefined,
    status:    req.query.status    as ReservationStatus | undefined,
    date:      req.query.date      as string | undefined,
    page:      req.query.page  ? Number(req.query.page)  : undefined,
    limit:     req.query.limit ? Number(req.query.limit) : undefined,
  });
  ok(res, data);
});

export const createReservationHandler = [
  validate({ body: createReservationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const r = await svc.createReservation(req.body, userId(req));
    ok(res, r);
  }),
];

export const updateReservationHandler = [
  validate({ body: updateReservationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const r = await svc.updateReservation(req.params.id, req.body, userId(req));
    ok(res, r);
  }),
];
