import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { RoomCategory } from '@/models/RoomCategory';
import { Room } from '@/models/Room';
import { AppError } from '@/utils/AppError';
import { ok } from '@/utils/apiResponse';
import { uploadImage } from '@/services/cloudinary.service';

const userId = (req: Request) => (req as any).user?.id as string;

export const uploadCategoryImage = async (req: Request, res: Response) => {
  if (!req.file) {
    throw AppError.badRequest('No image uploaded', 'MISSING_FILE');
  }
  const result = await uploadImage(req.file.buffer, 'kds/rooms');
  ok(res, { url: result.url });
};

/**
 * Create a new room category
 */
export const createCategory = async (req: Request, res: Response) => {
  const existing = await RoomCategory.findOne({ roomType: req.body.roomType });
  if (existing) {
    throw AppError.conflict(`Room category for type ${req.body.roomType} already exists`);
  }

  const category = await RoomCategory.create({
    ...req.body,
    createdBy: userId(req),
  });

  ok(res, { category });
};

/**
 * List all room categories
 */
export const listCategories = async (_req: Request, res: Response) => {
  const categories = await RoomCategory.find().sort({ pricePerNight: 1 });
  ok(res, { categories });
};

/**
 * Get a single category by ID
 */
export const getCategory = async (req: Request, res: Response) => {
  const category = await RoomCategory.findById(req.params.id);
  if (!category) {
    throw AppError.notFound('Room category not found');
  }
  ok(res, { category });
};

/**
 * Update a room category and safely sync price/amenities to existing rooms
 */
export const updateCategory = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const category = await RoomCategory.findById(req.params.id).session(session);
    if (!category) {
      throw AppError.notFound('Room category not found');
    }

    // Update fields
    if (req.body.displayName !== undefined) category.displayName = req.body.displayName;
    if (req.body.description !== undefined) category.description = req.body.description;
    if (req.body.pricePerNight !== undefined) category.pricePerNight = req.body.pricePerNight;
    if (req.body.capacity !== undefined) category.capacity = req.body.capacity;
    if (req.body.amenities !== undefined) category.amenities = req.body.amenities;
    if (req.body.images !== undefined) category.images = req.body.images;
    
    category.updatedBy = userId(req) as any;
    await category.save({ session });

    // Synchronization Rule: Sync price, capacity, amenities, and images to all rooms of this type.
    // Explicitly do NOT overwrite roomNumber, floor, status, occupancy, housekeeping, etc.
    if (req.body.pricePerNight !== undefined || req.body.capacity !== undefined || req.body.amenities !== undefined || req.body.images !== undefined) {
      const updatePayload: any = {};
      if (req.body.pricePerNight !== undefined) updatePayload.pricePerNight = req.body.pricePerNight;
      if (req.body.capacity !== undefined) updatePayload.capacity = req.body.capacity;
      if (req.body.amenities !== undefined) updatePayload.amenities = req.body.amenities;
      if (req.body.images !== undefined) updatePayload.images = req.body.images;

      await Room.updateMany(
        { roomType: category.roomType },
        { $set: updatePayload },
        { session }
      );
    }

    await session.commitTransaction();
    ok(res, { category });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Delete a category
 */
export const deleteCategory = async (req: Request, res: Response) => {
  const category = await RoomCategory.findById(req.params.id);
  if (!category) {
    throw AppError.notFound('Room category not found');
  }

  // Check if rooms depend on this category
  const roomsCount = await Room.countDocuments({ roomType: category.roomType });
  if (roomsCount > 0) {
    throw AppError.badRequest(`Cannot delete category because ${roomsCount} rooms are using it`);
  }

  await category.deleteOne();
  ok(res, {});
};
