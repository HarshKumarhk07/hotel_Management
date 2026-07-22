import { Request, Response } from 'express';
import { GalleryImage } from '@/models';
import { asyncHandler } from '@/utils/asyncHandler';
import { AppError } from '@/utils/AppError';

// Public GET - active images only, sorted by order
export const getActiveGalleryImages = asyncHandler(async (_req: Request, res: Response) => {
  const images = await GalleryImage.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
  res.json({
    status: 'success',
    data: { images }
  });
});

// Admin GET - all images
export const getAllGalleryImages = asyncHandler(async (_req: Request, res: Response) => {
  const images = await GalleryImage.find().sort({ order: 1, createdAt: -1 });
  res.json({
    status: 'success',
    data: { images }
  });
});

// Admin POST - create image
export const createGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await GalleryImage.create(req.body);
  res.status(201).json({
    status: 'success',
    data: { image }
  });
});

// Admin PATCH - update image
export const updateGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await GalleryImage.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!image) throw AppError.notFound('Gallery image not found');
  res.json({
    status: 'success',
    data: { image }
  });
});

// Admin DELETE - remove image
export const deleteGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await GalleryImage.findByIdAndDelete(req.params.id);
  if (!image) throw AppError.notFound('Gallery image not found');
  res.status(204).json({ status: 'success', data: null });
});
