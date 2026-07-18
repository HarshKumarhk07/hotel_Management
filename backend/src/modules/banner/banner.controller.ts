import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { Banner } from '@/models';
import { ROLES } from '@/constants';

// ── Public ──

export const getActiveBanners = asyncHandler(async (req: Request, res: Response) => {
  const { kitchenId } = req.query;
  const now = new Date();

  const q: any = {
    isActive: true,
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
    ]
  };

  if (kitchenId) {
    q.kitchen = { $in: [kitchenId, null, undefined] };
  }

  const items = await Banner.find(q).sort({ createdAt: -1 });
  return ok(res, { banners: items });
});

// ── Admin / Owner ──

export const listAllBanners = asyncHandler(async (req: Request, res: Response) => {
  const isSuper = req.auth!.role === ROLES.SUPER_ADMIN;
  const kitchenId = isSuper ? req.query.kitchenId as string : req.auth!.kitchenId;

  const q: any = {};
  if (kitchenId) q.kitchen = kitchenId;

  const items = await Banner.find(q).sort({ createdAt: -1 });
  return ok(res, { banners: items });
});

export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  const isSuper = req.auth!.role === ROLES.SUPER_ADMIN;
  const kitchenId = isSuper ? req.body.kitchenId : req.auth!.kitchenId;

  const banner = await Banner.create({
    title: req.body.title,
    subtitle: req.body.subtitle,
    imageUrl: req.body.imageUrl,
    linkUrl: req.body.linkUrl,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    kitchen: kitchenId || undefined,
  });

  return created(res, { banner });
});

export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw AppError.notFound('Banner not found');

  if (req.auth!.role === ROLES.KITCHEN_OWNER && banner.kitchen?.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Access denied');
  }

  // Update fields
  Object.assign(banner, req.body);
  await banner.save();

  return ok(res, { banner });
});

export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw AppError.notFound('Banner not found');

  if (req.auth!.role === ROLES.KITCHEN_OWNER && banner.kitchen?.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Access denied');
  }

  await banner.deleteOne();
  return ok(res, { message: 'Banner deleted successfully' });
});
