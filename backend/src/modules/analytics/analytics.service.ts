import { Types, type PipelineStage } from 'mongoose';
import { ORDER_STATUS, PAYMENT_STATUS, REFUND_STATUS } from '@/constants';
import { Order, Room, RestaurantTable, Vehicle, BanquetBooking, TableReservation, RoomBooking, BanquetHall } from '@/models';

export interface AnalyticsScope {
  /** Restrict to one kitchen (kitchen owners are always scoped to theirs). */
  kitchenId?: string;
  from?: Date;
  to?: Date;
}

/** Build the shared `$match` stage from a scope (kitchen + created-at range). */
function matchStage(scope: AnalyticsScope): Record<string, unknown> {
  const match: Record<string, unknown> = {};
  if (scope.kitchenId) match.kitchen = new Types.ObjectId(scope.kitchenId);
  if (scope.from || scope.to) {
    const range: Record<string, Date> = {};
    if (scope.from) range.$gte = scope.from;
    if (scope.to) range.$lte = scope.to;
    match.createdAt = range;
  }
  return match;
}

/** Revenue counts only orders that were actually paid. */
const PAID_STATUSES = [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED];

// ─────────────────────────────────────────────────────────────────────────────
// Headline summary
// ─────────────────────────────────────────────────────────────────────────────
export async function getSummary(scope: AnalyticsScope) {
  const match = matchStage(scope);

  const filter: Record<string, any> = {};
  if (scope.kitchenId) {
    filter.kitchen = new Types.ObjectId(scope.kitchenId);
  }

  let banquetHallsFilter: string[] | null = null;
  if (scope.kitchenId) {
    const halls = await BanquetHall.find({ kitchen: new Types.ObjectId(scope.kitchenId) }, '_id');
    banquetHallsFilter = halls.map(h => h._id.toString());
  }

  const [
    agg,
    totalRooms,
    occupiedRooms,
    totalTables,
    occupiedTables,
    liveTableBookings,
    activeValetVehicles,
    pendingBanquetEnquiries,
    roomRevenueAgg,
    banquetRevenueAgg,
  ] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $in: ['$payment.status', PAID_STATUSES] }, '$pricing.total', 0] },
          },
          pendingOrders: {
            $sum: {
              $cond: [
                { $in: ['$status', [ORDER_STATUS.NEW_ORDER, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.OUT_FOR_DELIVERY]] },
                1,
                0,
              ],
            },
          },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.DELIVERED] }, 1, 0] } },
          cancelledOrders: {
            $sum: {
              $cond: [{ $in: ['$status', [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED]] }, 1, 0],
            },
          },
          refundedAmount: {
            $sum: { $cond: [{ $eq: ['$refund.status', REFUND_STATUS.REFUNDED] }, '$refund.amount', 0] },
          },
          discountGiven: { $sum: '$pricing.discount' },
        },
      },
    ]),
    Room.countDocuments({ ...filter, isActive: true }),
    Room.countDocuments({ ...filter, status: 'OCCUPIED', isActive: true }),
    RestaurantTable.countDocuments({ ...filter, isActive: true }),
    RestaurantTable.countDocuments({ ...filter, status: 'OCCUPIED', isActive: true }),
    TableReservation.countDocuments({ ...filter, status: 'CONFIRMED' }),
    Vehicle.countDocuments({ status: { $ne: 'DELIVERED' } }),
    BanquetBooking.countDocuments({ status: 'PENDING' }),
    // Room Revenue (Not applicable if a specific kitchen is scoped)
    scope.kitchenId ? Promise.resolve([{ revenue: 0 }]) : RoomBooking.aggregate([
      { $match: { ...match, paymentStatus: 'PAID' } },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' } } },
    ]),
    // Banquet Revenue
    BanquetBooking.aggregate([
      { 
        $match: { 
          ...match, 
          paymentStatus: 'PAID',
          ...(banquetHallsFilter ? { hall: { $in: banquetHallsFilter.map(id => new Types.ObjectId(id)) } } : {})
        } 
      },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' } } },
    ]),
  ]);

  const base = agg[0] ?? {
    totalOrders: 0,
    revenue: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    refundedAmount: 0,
    discountGiven: 0,
  };
  delete (base as { _id?: unknown })._id;
  const avgOrderValue = base.completedOrders > 0 ? base.revenue / base.completedOrders : 0;
  const cancellationRate = base.totalOrders > 0 ? base.cancelledOrders / base.totalOrders : 0;

  return {
    ...base,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    cancellationRate: Math.round(cancellationRate * 1000) / 1000,
    roomOccupancy: {
      total: totalRooms,
      occupied: occupiedRooms,
    },
    tableOccupancy: {
      total: totalTables,
      occupied: occupiedTables,
    },
    liveTableBookings,
    activeValetVehicles,
    pendingBanquetEnquiries,
    revenue: base.revenue + (roomRevenueAgg[0]?.revenue || 0) + (banquetRevenueAgg[0]?.revenue || 0),
    revenueBreakdown: {
      food: base.revenue,
      room: roomRevenueAgg[0]?.revenue || 0,
      banquet: banquetRevenueAgg[0]?.revenue || 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue trend (per day / week / month)
// ─────────────────────────────────────────────────────────────────────────────
type Granularity = 'day' | 'week' | 'month';
const DATE_FORMAT: Record<Granularity, string> = {
  day: '%Y-%m-%d',
  week: '%Y-W%V',
  month: '%Y-%m',
};

export async function getRevenueTrends(scope: AnalyticsScope, granularity: Granularity = 'day') {
  const rows = await Order.aggregate([
    { $match: { ...matchStage(scope), 'payment.status': { $in: PAID_STATUSES } } },
    {
      $group: {
        _id: { $dateToString: { format: DATE_FORMAT[granularity], date: '$createdAt' } },
        revenue: { $sum: '$pricing.total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, period: '$_id', revenue: 1, orders: 1 } },
  ]);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Best / least selling items
// ─────────────────────────────────────────────────────────────────────────────
async function itemsByQty(scope: AnalyticsScope, direction: 1 | -1, limit: number) {
  const pipeline: PipelineStage[] = [
    { $match: matchStage(scope) },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.menuItem',
        name: { $first: '$items.name' },
        quantitySold: { $sum: { $subtract: ['$items.quantity', '$items.cancelledQuantity'] } },
        revenue: { $sum: '$items.lineTotal' },
      },
    },
    { $match: { quantitySold: { $gt: 0 } } },
    { $sort: { quantitySold: direction } },
    { $limit: limit },
    { $project: { _id: 0, menuItem: '$_id', name: 1, quantitySold: 1, revenue: 1 } },
  ];
  return Order.aggregate(pipeline);
}

export function getTopItems(scope: AnalyticsScope, limit = 10) {
  return itemsByQty(scope, -1, limit);
}
export function getLeastItems(scope: AnalyticsScope, limit = 10) {
  return itemsByQty(scope, 1, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Peak hours (order volume by hour of day)
// ─────────────────────────────────────────────────────────────────────────────
export async function getPeakHours(scope: AnalyticsScope, timezone = 'Asia/Kolkata') {
  const rows = await Order.aggregate([
    { $match: matchStage(scope) },
    {
      $group: {
        _id: { $hour: { date: '$createdAt', timezone } },
        orders: { $sum: 1 },
        revenue: {
          $sum: { $cond: [{ $in: ['$payment.status', PAID_STATUSES] }, '$pricing.total', 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, hour: '$_id', orders: 1, revenue: 1 } },
  ]);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Refund analytics
// ─────────────────────────────────────────────────────────────────────────────
export async function getRefundAnalytics(scope: AnalyticsScope) {
  const rows = await Order.aggregate([
    { $match: { ...matchStage(scope), 'refund.status': { $ne: REFUND_STATUS.NOT_REQUIRED } } },
    {
      $group: {
        _id: '$refund.status',
        count: { $sum: 1 },
        amount: { $sum: '$refund.amount' },
      },
    },
    { $project: { _id: 0, status: '$_id', count: 1, amount: 1 } },
  ]);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen performance (avg prep time + fulfillment, grouped by kitchen)
// ─────────────────────────────────────────────────────────────────────────────
export async function getKitchenPerformance(scope: AnalyticsScope) {
  const rows = await Order.aggregate([
    { $match: matchStage(scope) },
    {
      $group: {
        _id: '$kitchen',
        totalOrders: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.DELIVERED] }, 1, 0] } },
        cancelled: {
          $sum: {
            $cond: [{ $in: ['$status', [ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED]] }, 1, 0],
          },
        },
        avgPrepEstimate: { $avg: '$estimatedPrepMinutes' },
        revenue: {
          $sum: { $cond: [{ $in: ['$payment.status', PAID_STATUSES] }, '$pricing.total', 0] },
        },
      },
    },
    {
      $lookup: { from: 'kitchens', localField: '_id', foreignField: '_id', as: 'kitchen' },
    },
    { $unwind: { path: '$kitchen', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        kitchenId: '$_id',
        kitchenName: '$kitchen.name',
        totalOrders: 1,
        delivered: 1,
        cancelled: 1,
        avgPrepEstimate: { $round: ['$avgPrepEstimate', 1] },
        revenue: 1,
      },
    },
    { $sort: { revenue: -1 } },
  ]);
  return rows;
}

/** Convenience: assemble the whole dashboard in one shot. */
export async function getDashboard(scope: AnalyticsScope) {
  const [
    summary,
    revenueTrends,
    topItems,
    leastItems,
    peakHours,
    refunds,
    kitchenPerformance,
    totalRooms,
    activeRoomOrders,
    totalTables,
    occupiedTables,
  ] = await Promise.all([
    getSummary(scope),
    getRevenueTrends(scope, 'day'),
    getTopItems(scope, 5),
    getLeastItems(scope, 5),
    getPeakHours(scope),
    getRefundAnalytics(scope),
    getKitchenPerformance(scope),
    Room.countDocuments({ isActive: true }),
    Order.distinct('room', { status: { $in: [ORDER_STATUS.NEW_ORDER, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY] } }),
    RestaurantTable.countDocuments({ isActive: true }),
    RestaurantTable.countDocuments({ status: 'OCCUPIED' }),
  ]);

  const roomOccupancy = {
    total: totalRooms,
    occupied: activeRoomOrders.filter(Boolean).length,
  };

  const tableOccupancy = {
    total: totalTables,
    occupied: occupiedTables,
  };

  return {
    summary,
    revenueTrends,
    topItems,
    leastItems,
    peakHours,
    refunds,
    kitchenPerformance,
    roomOccupancy,
    tableOccupancy,
  };
}
