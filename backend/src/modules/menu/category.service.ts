import { Category, MenuItem } from '@/models';
import { slugify } from '@/utils/slug';
import { AppError } from '@/utils/AppError';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.validation';

async function uniqueSlug(kitchenId: string, name: string): Promise<string> {
  const base = slugify(name) || 'category';
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Category.exists({ kitchen: kitchenId, slug })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function createCategory(kitchenId: string, input: CreateCategoryInput) {
  const slug = await uniqueSlug(kitchenId, input.name);
  return Category.create({
    kitchen: kitchenId,
    name: input.name,
    slug,
    description: input.description,
    sortOrder: input.sortOrder ?? 0,
  });
}

export function listCategories(kitchenId: string, isActive?: boolean) {
  const filter: Record<string, unknown> = { kitchen: kitchenId };
  if (typeof isActive === 'boolean') filter.isActive = isActive;
  return Category.find(filter).sort({ sortOrder: 1, name: 1 });
}

export async function getCategory(id: string) {
  const category = await Category.findById(id);
  if (!category) throw AppError.notFound('Category not found');
  return category;
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const category = await getCategory(id);
  if (input.name !== undefined && input.name !== category.name) {
    category.name = input.name;
    category.slug = await uniqueSlug(category.kitchen.toString(), input.name);
  }
  if (input.description !== undefined) category.description = input.description;
  if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) category.isActive = input.isActive;
  await category.save();
  return category;
}

/** Delete a category only if it has no menu items (prevents orphaned items). */
export async function deleteCategory(id: string) {
  const category = await getCategory(id);
  const itemCount = await MenuItem.countDocuments({ category: id });
  if (itemCount > 0) {
    throw AppError.conflict(
      `Category has ${itemCount} menu item(s). Move or delete them first.`,
      'CATEGORY_NOT_EMPTY',
    );
  }
  await category.deleteOne();
  return category;
}
