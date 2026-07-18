import { Schema, model, type Document, type Types } from 'mongoose';
import { ALL_FOOD_LABELS, FOOD_LABELS, type FoodLabel } from '@/constants';

/**
 * A daily/weekly availability window. `days` is an optional whitelist of
 * weekdays (0=Sun … 6=Sat); omit/empty means every day. Times are local "HH:mm"
 * interpreted in the item's `availability.timezone`.
 */
export interface IAvailabilityWindow {
  days?: number[];
  start: string;
  end: string;
}

export interface IMenuImage {
  url: string;
  publicId: string;
}

export interface IMenuItem extends Document {
  _id: Types.ObjectId;
  kitchen: Types.ObjectId;
  category: Types.ObjectId;
  name: string;
  description?: string;
  /** Base price in the smallest currency unit-agnostic decimal (e.g. 199.00). */
  price: number;
  taxPercent: number;
  prepTimeMinutes: number;
  foodLabel: FoodLabel;
  image?: IMenuImage;

  /** Manual out-of-stock toggle (overrides schedule). */
  inStock: boolean;
  stockQuantity: number | null;
  /** Soft hide without deleting. */
  isActive: boolean;
  isFeatured: boolean;
  isRecommended: boolean;
  sortOrder: number;

  availability: {
    /** When false, the item ignores windows and is always available (if in stock). */
    scheduled: boolean;
    timezone: string;
    windows: IAvailabilityWindow[];
  };

  createdAt: Date;
  updatedAt: Date;
}

const windowSchema = new Schema<IAvailabilityWindow>(
  {
    days: { type: [Number], default: undefined },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false },
);

const menuItemSchema = new Schema<IMenuItem>(
  {
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    prepTimeMinutes: { type: Number, default: 15, min: 0, max: 600 },
    foodLabel: { type: String, enum: ALL_FOOD_LABELS, default: FOOD_LABELS.VEG, index: true },
    image: {
      url: { type: String },
      publicId: { type: String },
    },
    inStock: { type: Boolean, default: true, index: true },
    stockQuantity: { type: Number, default: null },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
    isRecommended: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, index: true },
    availability: {
      scheduled: { type: Boolean, default: false },
      timezone: { type: String, default: 'Asia/Kolkata' },
      windows: { type: [windowSchema], default: [] },
    },
  },
  { timestamps: true },
);

menuItemSchema.index({ kitchen: 1, category: 1, sortOrder: 1 });

export const MenuItem = model<IMenuItem>('MenuItem', menuItemSchema);
