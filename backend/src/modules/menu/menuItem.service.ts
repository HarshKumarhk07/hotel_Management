import { type FilterQuery } from 'mongoose';
import { Category, Kitchen, MenuItem, type IMenuItem } from '@/models';
import { deleteImage, uploadImage } from '@/services/cloudinary.service';
import { getPageParams, pageMeta } from '@/utils/pagination';
import { isAvailableNow, isKitchenAvailableNow } from '@/utils/availability';
import { AppError } from '@/utils/AppError';
import type { CreateMenuItemInput, UpdateMenuItemInput } from './menuItem.validation';

/** Ensure the category exists and belongs to the given kitchen. */
async function assertCategoryInKitchen(categoryId: string, kitchenId: string): Promise<void> {
  const category = await Category.findById(categoryId);
  if (!category) throw AppError.badRequest('Category not found', 'CATEGORY_NOT_FOUND');
  if (category.kitchen.toString() !== kitchenId) {
    throw AppError.badRequest('Category belongs to a different kitchen', 'CATEGORY_KITCHEN_MISMATCH');
  }
}

export async function createMenuItem(kitchenId: string, input: CreateMenuItemInput) {
  await assertCategoryInKitchen(input.category, kitchenId);
  return MenuItem.create({
    kitchen: kitchenId,
    category: input.category,
    name: input.name,
    description: input.description,
    price: input.price,
    taxPercent: input.taxPercent ?? 0,
    prepTimeMinutes: input.prepTimeMinutes ?? 15,
    foodLabel: input.foodLabel,
    isFeatured: input.isFeatured ?? false,
    isRecommended: input.isRecommended ?? false,
    sortOrder: input.sortOrder ?? 0,
    availability: input.availability,
  });
}

export async function listMenuItems(query: {
  page?: number;
  limit?: number;
  kitchen: string;
  category?: string;
  foodLabel?: string;
  inStock?: boolean;
  isActive?: boolean;
  featured?: boolean;
  search?: string;
}) {
  const { page, limit, skip } = getPageParams(query);
  const filter: FilterQuery<IMenuItem> = { kitchen: query.kitchen };
  if (query.category) filter.category = query.category;
  if (query.foodLabel) filter.foodLabel = query.foodLabel;
  if (typeof query.inStock === 'boolean') filter.inStock = query.inStock;
  if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;
  if (typeof query.featured === 'boolean') filter.isFeatured = query.featured;
  if (query.search) filter.name = { $regex: query.search, $options: 'i' };

  const [items, total] = await Promise.all([
    MenuItem.find(filter)
      .populate('category', 'name slug')
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit),
    MenuItem.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(total, page, limit) };
}

export async function getMenuItem(id: string) {
  const item = await MenuItem.findById(id).populate('category', 'name slug');
  if (!item) throw AppError.notFound('Menu item not found');
  return item;
}

export async function updateMenuItem(id: string, input: UpdateMenuItemInput) {
  const item = await MenuItem.findById(id);
  if (!item) throw AppError.notFound('Menu item not found');

  if (input.category && input.category !== item.category.toString()) {
    await assertCategoryInKitchen(input.category, item.kitchen.toString());
    item.category = input.category as never;
  }
  const fields: (keyof UpdateMenuItemInput)[] = [
    'name',
    'description',
    'price',
    'taxPercent',
    'prepTimeMinutes',
    'foodLabel',
    'isFeatured',
    'isRecommended',
    'sortOrder',
    'inStock',
    'isActive',
    'stockQuantity',
  ];
  for (const f of fields) {
    if (input[f] !== undefined) (item as unknown as Record<string, unknown>)[f] = input[f];
  }
  if (input.availability !== undefined) item.availability = input.availability as never;

  await item.save();
  return item;
}

export async function deleteMenuItem(id: string) {
  const item = await MenuItem.findById(id);
  if (!item) throw AppError.notFound('Menu item not found');
  if (item.image?.publicId) await deleteImage(item.image.publicId);
  await item.deleteOne();
  return item;
}

export async function setStock(id: string, inStock: boolean) {
  const item = await MenuItem.findById(id);
  if (!item) throw AppError.notFound('Menu item not found');
  item.inStock = inStock;
  await item.save();
  return item;
}

/** Replace a menu item's image: upload the new one, delete the previous. */
export async function setImage(id: string, buffer: Buffer) {
  const item = await MenuItem.findById(id);
  if (!item) throw AppError.notFound('Menu item not found');
  const previous = item.image?.publicId;
  const uploaded = await uploadImage(buffer, 'kds/menu');
  item.image = { url: uploaded.url, publicId: uploaded.publicId };
  await item.save();
  if (previous) await deleteImage(previous);
  return item;
}

export async function removeImage(id: string) {
  const item = await MenuItem.findById(id);
  if (!item) throw AppError.notFound('Menu item not found');
  if (item.image?.publicId) await deleteImage(item.image.publicId);
  item.image = undefined;
  await item.save();
  return item;
}

/**
 * Public menu for a kitchen: active categories with their active, in-stock
 * items, each annotated with whether it is available right now per its schedule.
 * Out-of-window items are excluded by default so guests only see orderable food.
 */
export async function getPublicMenu(kitchenId: string, now: Date = new Date()) {
  const kitchen = await Kitchen.findById(kitchenId).select(
    'name slug isActive temporarilyClosed weeklySchedule holidayTimings timings settings',
  );
  if (!kitchen || !isKitchenAvailableNow(kitchen, now)) {
    throw AppError.notFound('Kitchen not available', 'KITCHEN_UNAVAILABLE');
  }

  const [categories, items] = await Promise.all([
    Category.find({ kitchen: kitchenId, isActive: true }).sort({ sortOrder: 1, name: 1 }),
    MenuItem.find({ kitchen: kitchenId, isActive: true, inStock: true }).sort({
      sortOrder: 1,
      name: 1,
    }),
  ]);

  const grouped = categories.map((cat) => ({
    id: cat._id.toString(),
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    items: items
      .filter(
        (it) =>
          it.category.toString() === cat._id.toString() && isAvailableNow(it.availability, now),
      )
      .map((it) => ({
        id: it._id.toString(),
        name: it.name,
        description: it.description,
        price: it.price,
        taxPercent: it.taxPercent,
        prepTimeMinutes: it.prepTimeMinutes,
        foodLabel: it.foodLabel,
        image: it.image?.url,
        isFeatured: it.isFeatured,
        isRecommended: it.isRecommended,
      })),
  }));

  return {
    kitchen: {
      id: kitchen._id.toString(),
      name: kitchen.name,
      slug: kitchen.slug,
      timings: kitchen.timings,
      settings: kitchen.settings,
    },
    // Hide empty categories from guests.
    categories: grouped.filter((c) => c.items.length > 0),
  };
}

/** Bulk update stock properties (inStock and/or stockQuantity) of multiple menu items. */
export async function bulkUpdateStock(updates: { id: string; inStock?: boolean; stockQuantity?: number | null }[]) {
  const results = [];
  for (const update of updates) {
    const item = await MenuItem.findById(update.id);
    if (item) {
      if (update.inStock !== undefined) item.inStock = update.inStock;
      if (update.stockQuantity !== undefined) item.stockQuantity = update.stockQuantity;
      // If quantity is set to 0, mark as out of stock automatically
      if (item.stockQuantity === 0) {
        item.inStock = false;
      } else if (item.stockQuantity !== null && item.stockQuantity > 0 && update.inStock === undefined) {
        // Automatically set to inStock if quantity is positive and inStock wasn't explicitly set to false
        item.inStock = true;
      }
      await item.save();
      results.push(item);
    }
  }
  return results;
}
