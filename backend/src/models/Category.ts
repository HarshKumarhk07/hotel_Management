import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * A menu Category (Starters, Main Course, Desserts, Beverages, or custom).
 * Kitchen-scoped: the (kitchen, slug) pair is unique, so two kitchens can each
 * have a "Starters" category without colliding.
 */
export interface ICategory extends Document {
  _id: Types.ObjectId;
  kitchen: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  /** Lower numbers appear first in the menu. */
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Unique per kitchen, not globally.
categorySchema.index({ kitchen: 1, slug: 1 }, { unique: true });

export const Category = model<ICategory>('Category', categorySchema);
