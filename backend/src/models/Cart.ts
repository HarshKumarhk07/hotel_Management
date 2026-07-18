import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * A customer's active cart, scoped to the kitchen they're ordering from (resolved
 * from the scanned room's QR). One active cart per (customer, kitchen). Prices
 * are intentionally NOT stored here — they are recomputed from the live menu at
 * checkout so a stale cart can never lock in an old price.
 */
export interface ICartItem {
  menuItem: Types.ObjectId;
  quantity: number;
  note?: string;
}

export interface ICart extends Document {
  _id: Types.ObjectId;
  customer: Types.ObjectId;
  kitchen: Types.ObjectId;
  room: Types.ObjectId;
  items: ICartItem[];
  customerNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<ICart>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', required: true },
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    items: [
      {
        menuItem: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
        quantity: { type: Number, required: true, min: 1, max: 99 },
        note: { type: String, trim: true, maxlength: 300 },
      },
    ],
    customerNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

cartSchema.index({ customer: 1, kitchen: 1 }, { unique: true });

export const Cart = model<ICart>('Cart', cartSchema);
