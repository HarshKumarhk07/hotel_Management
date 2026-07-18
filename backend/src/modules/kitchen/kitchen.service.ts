import { startSession, Types, type FilterQuery } from 'mongoose';
import { AUTH_PROVIDERS, ROLES } from '@/constants';
import { Kitchen, User, Order, MenuItem, type IKitchen } from '@/models';
import { getPageParams, pageMeta } from '@/utils/pagination';
import { slugify } from '@/utils/slug';
import { AppError } from '@/utils/AppError';
import { isKitchenAvailableNow } from '@/utils/availability';
import type { CreateKitchenInput, UpdateKitchenInput } from './kitchen.validation';

/** Ensure a unique slug by appending a counter when needed. */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'kitchen';
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Kitchen.exists({ slug })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

/**
 * Create a kitchen and, optionally, its owner account atomically. The owner is a
 * KITCHEN_OWNER user with email pre-verified (provisioned by an admin) and the
 * `kitchen` back-reference set. Uses a transaction so we never leave a kitchen
 * without its owner or vice-versa.
 */
export async function createKitchen(input: CreateKitchenInput) {
  if (input.owner) {
    const existing = await User.findOne({ email: input.owner.email });
    if (existing) throw AppError.conflict('Owner email already in use', 'EMAIL_TAKEN');
  }

  const slug = await uniqueSlug(input.name);
  const session = await startSession();
  try {
    let result!: IKitchen;
    await session.withTransaction(async () => {
      const [kitchen] = await Kitchen.create(
        [
          {
            name: input.name,
            slug,
            description: input.description,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone,
            timings: input.timings,
            settings: input.settings,
            isActive: true,
          },
        ],
        { session },
      );

      if (input.owner) {
        const owner = new User({
          name: input.owner.name,
          email: input.owner.email,
          role: ROLES.KITCHEN_OWNER,
          provider: AUTH_PROVIDERS.LOCAL,
          kitchen: kitchen!._id,
          isEmailVerified: true,
        });
        (owner as typeof owner & { password?: string }).password = input.owner.password;
        await owner.save({ session });

        kitchen!.owner = owner._id;
        await kitchen!.save({ session });
      }
      result = kitchen!;
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function listKitchens(query: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}) {
  const { page, limit, skip } = getPageParams(query);
  const filter: FilterQuery<IKitchen> = {};
  if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;
  if (query.search) filter.name = { $regex: query.search, $options: 'i' };

  const [items, total] = await Promise.all([
    Kitchen.find(filter)
      .populate('owner', 'name email isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Kitchen.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(total, page, limit) };
}

export async function getKitchen(id: string) {
  const kitchen = await Kitchen.findById(id).populate('owner', 'name email isActive');
  if (!kitchen) throw AppError.notFound('Kitchen not found');
  return kitchen;
}

export async function updateKitchen(id: string, input: UpdateKitchenInput) {
  const kitchen = await Kitchen.findById(id);
  if (!kitchen) throw AppError.notFound('Kitchen not found');

  if (input.name !== undefined) kitchen.name = input.name;
  if (input.description !== undefined) kitchen.description = input.description;
  if (input.contactEmail !== undefined) kitchen.contactEmail = input.contactEmail;
  if (input.contactPhone !== undefined) kitchen.contactPhone = input.contactPhone;
  if (input.timings !== undefined) kitchen.timings = input.timings;
  if (input.settings !== undefined) {
    kitchen.settings = { ...kitchen.settings, ...input.settings };
  }
  await kitchen.save();
  return kitchen;
}

/**
 * Activate/deactivate a kitchen. Deactivating also disables its owner's login so
 * a suspended kitchen can't operate (orders are blocked downstream as well).
 */
export async function setKitchenActive(id: string, isActive: boolean) {
  const kitchen = await Kitchen.findById(id);
  if (!kitchen) throw AppError.notFound('Kitchen not found');
  kitchen.isActive = isActive;
  await kitchen.save();
  if (kitchen.owner) {
    await User.updateOne({ _id: kitchen.owner }, { $set: { isActive } });
  }
  return kitchen;
}

/** Compute kitchen dashboard analytics and operational overview. */
export async function getKitchenDashboard(kitchenId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Today's orders count + status counts + today's revenue
  const [countsAgg] = await Order.aggregate([
    {
      $match: {
        kitchen: new Types.ObjectId(kitchenId),
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      },
    },
    {
      $group: {
        _id: null,
        totalToday: { $sum: 1 },
        revenueToday: {
          $sum: { $cond: [{ $in: ['$payment.status', ['PAID', 'PARTIALLY_REFUNDED']] }, '$pricing.total', 0] },
        },
      },
    },
  ]);

  // Status counts for active orders
  const activeOrders = await Order.aggregate([
    {
      $match: {
        kitchen: new Types.ObjectId(kitchenId),
        status: { $in: ['NEW_ORDER', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const activeMap: Record<string, number> = { NEW_ORDER: 0, ACCEPTED: 0, PREPARING: 0, READY: 0, OUT_FOR_DELIVERY: 0 };
  for (const row of activeOrders) {
    activeMap[row._id] = row.count;
  }

  // Top selling items
  const topItems = await Order.aggregate([
    { $match: { kitchen: new Types.ObjectId(kitchenId) } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.menuItem',
        name: { $first: '$items.name' },
        quantitySold: { $sum: { $subtract: ['$items.quantity', '$items.cancelledQuantity'] } },
      },
    },
    { $match: { quantitySold: { $gt: 0 } } },
    { $sort: { quantitySold: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, menuItem: '$_id', name: 1, quantitySold: 1 } },
  ]);

  // Low stock items (stockQuantity is not null and is <= 5)
  const lowStockItems = await MenuItem.find({
    kitchen: kitchenId,
    isActive: true,
    stockQuantity: { $ne: null, $lte: 5 },
  })
    .select('name stockQuantity inStock')
    .limit(10);

  // Kitchen details for status
  const kitchen = await Kitchen.findById(kitchenId).select('name isActive temporarilyClosed timings weeklySchedule holidayTimings');

  // Recent activity (5 most recent orders)
  const recentOrders = await Order.find({ kitchen: kitchenId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('orderNumber status pricing.total createdAt');

  return {
    today: {
      ordersCount: countsAgg?.totalToday ?? 0,
      revenue: countsAgg?.revenueToday ?? 0,
    },
    statusCounts: {
      pending: (activeMap.NEW_ORDER ?? 0) + (activeMap.ACCEPTED ?? 0),
      preparing: activeMap.PREPARING ?? 0,
      ready: activeMap.READY ?? 0,
    },
    topSellingItems: topItems,
    lowStockItems: lowStockItems.map((item) => ({
      id: item._id,
      name: item.name,
      stockQuantity: item.stockQuantity,
      inStock: item.inStock,
    })),
    kitchenStatus: kitchen
      ? {
          name: kitchen.name,
          isActive: kitchen.isActive,
          temporarilyClosed: kitchen.temporarilyClosed,
          isOpenNow: isKitchenAvailableNow(kitchen),
        }
      : null,
    recentOrders,
  };
}
