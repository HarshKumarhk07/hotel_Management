import { type FilterQuery } from 'mongoose';
import {
  AUDIT_ACTIONS,
  ORDER_STATUS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  RESERVATION_STATUS,
  SOCKET_EVENTS,
  TABLE_STATUS,
  TABLE_TRANSITIONS,
  type ReservationStatus,
  type TableStatus,
} from '@/constants';
import {
  Kitchen,
  Order,
  RestaurantTable,
  TableReservation,
  type IRestaurantTable,
  type ITableReservation,
} from '@/models';
import { emitToAdmins } from '@/realtime/emit';
import { AppError } from '@/utils/AppError';
import { generateSecureToken } from '@/utils/crypto';
import { getPageParams, pageMeta } from '@/utils/pagination';
import { recordAudit } from '@/services/audit.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function assertTransition(current: TableStatus, next: TableStatus) {
  if (!TABLE_TRANSITIONS[current].includes(next)) {
    throw AppError.badRequest(
      `Cannot move table from ${current} to ${next}`,
      'INVALID_TABLE_TRANSITION',
    );
  }
}

async function generateTableToken(): Promise<string> {
  // ponytail: retry on collision — same pattern as Room QR
  for (let i = 0; i < 5; i++) {
    const { raw } = generateSecureToken(32);
    const exists = await RestaurantTable.exists({ 'qr.token': raw });
    if (!exists) return raw;
  }
  throw AppError.internal('Failed to generate unique QR token');
}



// ─────────────────────────────────────────────────────────────────────────────
// Tables — Admin
// ─────────────────────────────────────────────────────────────────────────────

export async function listTables(filter: {
  kitchenId?: string;
  floor?: number;
  section?: string;
  status?: TableStatus;
  page?: number;
  limit?: number;
}) {
  const q: FilterQuery<IRestaurantTable> = {};
  if (filter.kitchenId) q.kitchen = filter.kitchenId;
  if (filter.floor !== undefined) q.floor = filter.floor;
  if (filter.section) q.section = filter.section;
  if (filter.status) q.status = filter.status;

  const { page, limit, skip } = getPageParams(filter);
  const [items, total] = await Promise.all([
    RestaurantTable.find(q).sort({ floor: 1, number: 1 }).skip(skip).limit(limit),
    RestaurantTable.countDocuments(q),
  ]);
  return { items, meta: pageMeta(total, page, limit) };
}

export async function createTable(data: {
  number: string;
  floor: number;
  section?: string;
  capacity: number;
  kitchenId: string;
  actorId: string;
}) {
  const kitchen = await Kitchen.findById(data.kitchenId);
  if (!kitchen) throw AppError.notFound('Kitchen not found');

  const existing = await RestaurantTable.findOne({ number: data.number, kitchen: data.kitchenId });
  if (existing) {
    throw AppError.conflict('Table number already exists for this kitchen');
  }

  const token = await generateTableToken();

  const table = await RestaurantTable.create({
    number:   data.number,
    floor:    data.floor,
    section:  data.section,
    capacity: data.capacity,
    kitchen:  data.kitchenId,
    status:   TABLE_STATUS.AVAILABLE,
    qr: { token, isActive: true, version: 1, generatedAt: new Date() },
  });

  void recordAudit({ action: AUDIT_ACTIONS.TABLE_CREATED, actor: data.actorId, metadata: { tableId: table._id } });
  return table;
}

export async function updateTable(
  id: string,
  data: { number?: string; floor?: number; section?: string; capacity?: number; isActive?: boolean },
  actorId: string,
) {
  const table = await RestaurantTable.findById(id);
  if (!table) throw AppError.notFound('Table not found');

  if (data.number && data.number !== table.number) {
    const existing = await RestaurantTable.findOne({ number: data.number, kitchen: table.kitchen });
    if (existing) {
      throw AppError.conflict('Table number already exists for this kitchen');
    }
  }

  Object.assign(table, data);
  await table.save();
  void recordAudit({ action: AUDIT_ACTIONS.TABLE_UPDATED, actor: actorId, metadata: { tableId: id } });
  return table;
}

export async function deactivateTable(id: string, actorId: string) {
  const table = await RestaurantTable.findById(id);
  if (!table) throw AppError.notFound('Table not found');
  if (table.status === TABLE_STATUS.OCCUPIED || table.status === TABLE_STATUS.BILLING) {
    throw AppError.badRequest('Cannot deactivate an occupied table', 'TABLE_OCCUPIED');
  }
  table.isActive = false;
  table.status = TABLE_STATUS.INACTIVE;
  await table.save();
  void recordAudit({ action: AUDIT_ACTIONS.TABLE_UPDATED, actor: actorId, metadata: { tableId: id, deactivated: true } });
  return table;
}

export async function regenerateTableQr(id: string, actorId: string) {
  const table = await RestaurantTable.findById(id);
  if (!table) throw AppError.notFound('Table not found');
  const token = await generateTableToken();
  table.qr = { token, isActive: true, version: (table.qr.version ?? 0) + 1, generatedAt: new Date() };
  await table.save();
  void recordAudit({ action: AUDIT_ACTIONS.TABLE_UPDATED, actor: actorId, metadata: { tableId: id, qrRegenerated: true } });
  return table;
}

// ─── Seat / Bill / Close ─────────────────────────────────────────────────────

export async function seatTable(
  id: string,
  data: { partySize: number; guestName?: string; phone?: string; reservationId?: string; notes?: string },
  actorId: string,
) {
  const table = await RestaurantTable.findById(id);
  if (!table) throw AppError.notFound('Table not found');
  assertTransition(table.status, TABLE_STATUS.OCCUPIED);

  table.status = TABLE_STATUS.OCCUPIED;
  table.currentSession = {
    seatedAt:      new Date(),
    partySize:     data.partySize,
    guestName:     data.guestName,
    phone:         data.phone,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reservationId: data.reservationId as any,
    notes:         data.notes,
  };
  await table.save();

  if (data.reservationId) {
    await TableReservation.findByIdAndUpdate(data.reservationId, { status: RESERVATION_STATUS.SEATED });
  }

  emitToAdmins(SOCKET_EVENTS.TABLE_STATUS_CHANGED, { tableId: id, status: TABLE_STATUS.OCCUPIED, number: table.number });
  void recordAudit({ action: AUDIT_ACTIONS.TABLE_SEATED, actor: actorId, metadata: { tableId: id } });
  return table;
}

export async function requestBill(id: string, billAmount: number | undefined, actorId: string) {
  const table = await RestaurantTable.findById(id);
  if (!table) throw AppError.notFound('Table not found');
  assertTransition(table.status, TABLE_STATUS.BILLING);
  table.status = TABLE_STATUS.BILLING;
  if (table.currentSession) {
    table.currentSession.billAmount = billAmount;
  }
  await table.save();
  emitToAdmins(SOCKET_EVENTS.TABLE_STATUS_CHANGED, { tableId: id, status: TABLE_STATUS.BILLING, number: table.number });
  void recordAudit({ action: AUDIT_ACTIONS.TABLE_UPDATED, actor: actorId, metadata: { tableId: id, billRequested: true, billAmount } });
  return table;
}

export async function closeTable(id: string, actorId: string) {
  const table = await RestaurantTable.findById(id);
  if (!table) throw AppError.notFound('Table not found');
  assertTransition(table.status, TABLE_STATUS.AVAILABLE);

  if (table.currentSession?.seatedAt) {
    const openOrders = await Order.find({
      table: id,
      createdAt: { $gte: table.currentSession.seatedAt },
      status: { $in: [ORDER_STATUS.NEW_ORDER, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING] },
    }).select('_id orderNumber status');

    if (openOrders.length > 0) {
      throw AppError.badRequest(
        `Cannot close: ${openOrders.length} order(s) still in kitchen`,
        'OPEN_ORDERS_PENDING',
        { openOrders: openOrders.map((o) => ({ _id: o._id, orderNumber: o.orderNumber, status: o.status })) },
      );
    }

    await Order.updateMany(
      {
        table: id,
        createdAt: { $gte: table.currentSession.seatedAt },
        'payment.method': PAYMENT_METHODS.TABLE_BILLING,
        'payment.status': PAYMENT_STATUS.PENDING,
      },
      { $set: { 'payment.status': PAYMENT_STATUS.PAID, 'payment.paidAt': new Date() } },
    );
  }

  if (table.currentSession?.reservationId) {
    await TableReservation.findByIdAndUpdate(table.currentSession.reservationId, { status: RESERVATION_STATUS.COMPLETED });
  }

  table.status = TABLE_STATUS.AVAILABLE;
  table.currentSession = undefined;
  await table.save();

  emitToAdmins(SOCKET_EVENTS.TABLE_STATUS_CHANGED, { tableId: id, status: TABLE_STATUS.AVAILABLE, number: table.number });
  void recordAudit({ action: AUDIT_ACTIONS.TABLE_CLOSED, actor: actorId, metadata: { tableId: id } });
  return table;
}

export async function getTableBill(id: string) {
  const table = await RestaurantTable.findById(id);
  if (!table) throw AppError.notFound('Table not found');
  if (!table.currentSession?.seatedAt) {
    throw AppError.badRequest('Table has no active session', 'NO_ACTIVE_SESSION');
  }

  const orders = await Order.find({
    table: id,
    createdAt: { $gte: table.currentSession.seatedAt },
  }).select('orderNumber status items pricing payment createdAt');

  let grandTotal = orders.reduce((sum, o) => sum + o.pricing.total, 0);
  if (grandTotal === 0 && table.currentSession.billAmount !== undefined) {
    grandTotal = table.currentSession.billAmount;
  }
  return { table, orders, grandTotal };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveTableByToken(token: string) {
  const table = await RestaurantTable.findOne({ 'qr.token': token, 'qr.isActive': true })
    .populate('kitchen', 'name slug settings timings temporarilyClosed isActive');
  if (!table || !table.isActive) throw AppError.notFound('Table not found');
  return table;
}

export async function getAvailableTables(scheduledAt: Date, durationMins: number, partySize: number) {
  const slotEndMs = scheduledAt.getTime() + durationMins * 60_000;

  // Tables that have a conflicting active reservation in this window
  const conflicting = await TableReservation.find({
    status: { $in: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED] },
    scheduledAt: { $lt: new Date(slotEndMs) },
  })
    .select('table scheduledAt durationMins')
    .lean()
    .then((rows) =>
      rows
        .filter((r) => r.scheduledAt.getTime() + r.durationMins * 60_000 > scheduledAt.getTime())
        .map((r) => r.table),
    );

  return RestaurantTable.find({
    isActive: true,
    status: TABLE_STATUS.AVAILABLE,
    capacity: { $gte: partySize },
    _id: { $nin: conflicting },
  }).sort({ capacity: 1, number: 1 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reservations
// ─────────────────────────────────────────────────────────────────────────────

export async function listReservations(filter: {
  kitchenId?: string;
  tableId?: string;
  status?: ReservationStatus;
  date?: string;
  page?: number;
  limit?: number;
}) {
  const q: FilterQuery<ITableReservation> = {};
  if (filter.kitchenId) q.kitchen = filter.kitchenId;
  if (filter.tableId)   q.table   = filter.tableId;
  if (filter.status)    q.status  = filter.status;
  if (filter.date) {
    const start = new Date(filter.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    q.scheduledAt = { $gte: start, $lte: end };
  }

  const { page, limit, skip } = getPageParams(filter);
  const [items, total] = await Promise.all([
    TableReservation.find(q)
      .populate('table', 'number section floor capacity')
      .sort({ scheduledAt: 1 })
      .skip(skip)
      .limit(limit),
    TableReservation.countDocuments(q),
  ]);
  return { items, meta: pageMeta(total, page, limit) };
}

export async function createReservation(
  data: {
    tableId: string;
    guestName: string;
    phone: string;
    email?: string;
    partySize: number;
    scheduledAt: string;
    durationMins: number;
    notes?: string;
  },
  actorId: string,
) {
  const table = await RestaurantTable.findById(data.tableId).select('kitchen capacity isActive status');
  if (!table || !table.isActive) throw AppError.notFound('Table not found or inactive');
  if (data.partySize > table.capacity) {
    throw AppError.badRequest(
      `Party size ${data.partySize} exceeds table capacity ${table.capacity}`,
      'CAPACITY_EXCEEDED',
    );
  }

  const scheduledAt = new Date(data.scheduledAt);
  if (scheduledAt < new Date()) throw AppError.badRequest('Reservation must be in the future', 'PAST_DATE');

  const slotEndMs = scheduledAt.getTime() + data.durationMins * 60_000;
  const existing = await TableReservation.find({
    table: data.tableId,
    status: { $in: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED] },
    scheduledAt: { $lt: new Date(slotEndMs) },
  }).select('scheduledAt durationMins').lean();

  const conflict = existing.some(
    (r) => r.scheduledAt.getTime() + r.durationMins * 60_000 > scheduledAt.getTime(),
  );
  if (conflict) throw AppError.conflict('Table already reserved for this time slot', 'RESERVATION_CONFLICT');

  const reservation = await TableReservation.create({
    table:        data.tableId,
    kitchen:      table.kitchen,
    guestName:    data.guestName,
    phone:        data.phone,
    email:        data.email,
    partySize:    data.partySize,
    scheduledAt,
    durationMins: data.durationMins,
    notes:        data.notes,
    status:       RESERVATION_STATUS.PENDING,
  });

  // Mark table RESERVED if currently AVAILABLE
  if (table.status === TABLE_STATUS.AVAILABLE) {
    await RestaurantTable.findByIdAndUpdate(data.tableId, { status: TABLE_STATUS.RESERVED });
    emitToAdmins(SOCKET_EVENTS.TABLE_STATUS_CHANGED, {
      tableId: data.tableId, status: TABLE_STATUS.RESERVED,
    });
  }

  void recordAudit({ action: AUDIT_ACTIONS.RESERVATION_CREATED, actor: actorId, metadata: { reservationId: reservation._id } });
  return reservation;
}

export async function updateReservation(
  id: string,
  data: { status: ReservationStatus; cancelReason?: string },
  actorId: string,
) {
  const reservation = await TableReservation.findById(id);
  if (!reservation) throw AppError.notFound('Reservation not found');

  const prev = reservation.status;
  reservation.status = data.status;
  if (data.status === RESERVATION_STATUS.CANCELLED) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (reservation as any).cancelledBy  = actorId;
    reservation.cancelledAt  = new Date();
    reservation.cancelReason = data.cancelReason;
  }
  await reservation.save();

  const terminal: ReservationStatus[] = [RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.NO_SHOW];
  if (terminal.includes(data.status) && prev !== data.status) {
    const otherActive = await TableReservation.exists({
      table:  reservation.table,
      _id:    { $ne: id },
      status: { $in: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED] },
    });
    if (!otherActive) {
      await RestaurantTable.findOneAndUpdate(
        { _id: reservation.table, status: TABLE_STATUS.RESERVED },
        { status: TABLE_STATUS.AVAILABLE },
      );
    }
  }

  const action = data.status === RESERVATION_STATUS.CANCELLED
    ? AUDIT_ACTIONS.RESERVATION_CANCELLED
    : AUDIT_ACTIONS.RESERVATION_UPDATED;
  void recordAudit({ action, actor: actorId, metadata: { reservationId: id, status: data.status } });
  return reservation;
}
