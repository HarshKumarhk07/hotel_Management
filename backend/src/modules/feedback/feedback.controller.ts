import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { Feedback } from '@/models';
import { getPageParams, pageMeta } from '@/utils/pagination';
import type { FilterQuery } from 'mongoose';

// Guest side: Create Feedback
export const createFeedback = asyncHandler(async (req: Request, res: Response) => {
  const { guestName, email, phone, roomNumber, category, rating, comment } = req.body;

  const feedback = await Feedback.create({
    guestName,
    email: email || undefined,
    phone,
    roomNumber,
    category,
    rating,
    comment,
  });

  return created(res, { feedback });
});

// Admin side: List Feedbacks & simple summary statistics
export const listFeedback = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, category, rating } = req.query;
  const { page: pNum, limit: lNum, skip } = getPageParams({ page: Number(page), limit: Number(limit) });

  const filter: FilterQuery<any> = {};
  if (category) filter.category = category;
  if (rating) filter.rating = Number(rating);

  const [items, total] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lNum),
    Feedback.countDocuments(filter),
  ]);

  // Aggregate average ratings & counts
  const stats = await Feedback.aggregate([
    {
      $group: {
        _id: '$category',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const overall = await Feedback.aggregate([
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  return ok(res, {
    feedback: items,
    analytics: {
      categories: stats,
      overall: overall[0] || { avgRating: 0, count: 0 },
    },
  }, 200, pageMeta(total, pNum, lNum));
});
