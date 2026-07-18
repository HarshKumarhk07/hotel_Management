import { Schema, model, type Document, type Types } from 'mongoose';
import {
  ALL_FOOD_LABELS,
  ALL_ORDER_STATUSES,
  ORDER_STATUS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  type FoodLabel,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type RefundStatus,
} from '@/constants';

/** A line item — a price-frozen snapshot of the menu item at order time. */
export interface IOrderItem {
  menuItem: Types.ObjectId;
  name: string;
  foodLabel: FoodLabel;
  unitPrice: number;
  taxPercent: number;
  quantity: number;
  /** Quantity cancelled (partial cancellation); <= quantity. */
  cancelledQuantity: number;
  note?: string;
  lineSubtotal: number; // unitPrice * activeQty
  lineTax: number;
  lineTotal: number;
}

export interface IStatusHistory {
  status: OrderStatus;
  at: Date;
  by?: Types.ObjectId;
  note?: string;
}

export interface IInternalNote {
  note: string;
  by: Types.ObjectId;
  at: Date;
  noteType: 'PREPARATION' | 'CUSTOMER_HANDLING' | 'REMARK';
}

export interface IGuestInfo {
  name: string;
  /** Stored lowercased + trimmed (normalized) so account linking is exact. */
  email: string;
  /** Stored as entered (for display). */
  phone: string;
  /** Digits-only (last 10) phone used for exact, query-able account matching. */
  phoneNormalized?: string;
}

export interface ITableSnapshot {
  number: string;
  section?: string;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  kitchen: Types.ObjectId;
  /** Set for room-service orders. */
  room?: Types.ObjectId;
  roomSnapshot?: { roomNumber: string; floor: number };
  /** Set for dine-in table orders. Exactly one of room/table must be present. */
  table?: Types.ObjectId;
  tableSnapshot?: ITableSnapshot;
  /** The owning account. Absent for guest orders until they are linked. */
  customer?: Types.ObjectId;
  /** Captured at checkout for guest (un-authenticated) orders. */
  guestInfo?: IGuestInfo;
  /** True once a guest order has been claimed by a registered account. */
  linkedToAccount: boolean;
  /** SHA-256 of the opaque token a guest uses to pay/track without logging in. */
  guestAccessTokenHash?: string;

  items: IOrderItem[];
  pricing: {
    subtotal: number;
    taxTotal: number;
    serviceCharge: number;
    discount: number;
    total: number;
    currency: string;
  };
  coupon?: Types.ObjectId;
  customerNote?: string;

  status: OrderStatus;
  statusHistory: IStatusHistory[];

  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    currency: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    paidAt?: Date;
    failureReason?: string;
  };

  refund: {
    status: RefundStatus;
    amount: number;
    reason?: string;
    razorpayRefundId?: string;
    processedAt?: Date;
  };

  cancellation?: {
    scope: 'FULL' | 'PARTIAL';
    reason: string;
    cancelledBy: Types.ObjectId;
    at: Date;
  };

  /** Private — Super Admin & Kitchen Owner only. Never serialised to customers. */
  internalNotes: IInternalNote[];

  estimatedPrepMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    menuItem: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    foodLabel: { type: String, enum: ALL_FOOD_LABELS, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, required: true, min: 0, max: 100 },
    quantity: { type: Number, required: true, min: 1 },
    cancelledQuantity: { type: Number, default: 0, min: 0 },
    note: { type: String, trim: true, maxlength: 300 },
    lineSubtotal: { type: Number, required: true, min: 0 },
    lineTax: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', required: true, index: true },
    // For room-service orders.
    room: { type: Schema.Types.ObjectId, ref: 'Room', index: true, sparse: true },
    roomSnapshot: {
      roomNumber: { type: String },
      floor: { type: Number },
    },
    // For dine-in table orders.
    table: { type: Schema.Types.ObjectId, ref: 'RestaurantTable', index: true, sparse: true },
    tableSnapshot: {
      number:  { type: String },
      section: { type: String },
    },
    // Optional: guest orders have no owner until they are linked to an account.
    customer: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestInfo: {
      name: { type: String, trim: true, maxlength: 120 },
      email: { type: String, lowercase: true, trim: true, index: true },
      phone: { type: String, trim: true },
      phoneNormalized: { type: String, index: true, sparse: true, select: false },
    },
    linkedToAccount: { type: Boolean, default: false, index: true },
    guestAccessTokenHash: { type: String, index: true, sparse: true, select: false },

    items: { type: [orderItemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    pricing: {
      subtotal: { type: Number, required: true, min: 0 },
      taxTotal: { type: Number, required: true, min: 0 },
      serviceCharge: { type: Number, required: true, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'INR' },
    },
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    customerNote: { type: String, trim: true, maxlength: 500 },

    status: {
      type: String,
      enum: ALL_ORDER_STATUSES,
      default: ORDER_STATUS.NEW_ORDER,
      index: true,
    },
    statusHistory: [
      {
        status: { type: String, enum: ALL_ORDER_STATUSES, required: true },
        at: { type: Date, default: Date.now },
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, trim: true, maxlength: 300 },
      },
    ],

    payment: {
      method: { type: String, enum: Object.values(PAYMENT_METHODS), required: true },
      status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'INR' },
      razorpayOrderId: { type: String, index: true, sparse: true },
      razorpayPaymentId: { type: String, index: true, sparse: true },
      razorpaySignature: { type: String },
      paidAt: { type: Date },
      failureReason: { type: String },
    },

    refund: {
      status: { type: String, enum: Object.values(REFUND_STATUS), default: REFUND_STATUS.NOT_REQUIRED },
      amount: { type: Number, default: 0, min: 0 },
      reason: { type: String, trim: true, maxlength: 300 },
      razorpayRefundId: { type: String },
      processedAt: { type: Date },
    },

    cancellation: {
      scope: { type: String, enum: ['FULL', 'PARTIAL'] },
      reason: { type: String, trim: true, maxlength: 300 },
      cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },

    internalNotes: {
      type: [
        {
          note: { type: String, required: true, trim: true, maxlength: 500 },
          by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          at: { type: Date, default: Date.now },
          noteType: {
            type: String,
            enum: ['PREPARATION', 'CUSTOMER_HANDLING', 'REMARK'],
            default: 'REMARK',
          },
        },
      ],
      default: [],
      select: false, // never returned unless explicitly requested by staff endpoints
    },
    estimatedPrepMinutes: { type: Number, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true },
);

orderSchema.index({ kitchen: 1, status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ table: 1, createdAt: -1 }); // session bill aggregation
// Drives guest-order → account linking lookups (unlinked guest orders by email).
orderSchema.index({ 'guestInfo.email': 1, linkedToAccount: 1 });

/** Every order must be owned by an account OR carry guest contact details,
 *  AND must be linked to a room (room service) OR a table (dine-in). */
orderSchema.pre('validate', function (this: IOrder, next) {
  if (!this.customer && !this.guestInfo?.email) {
    next(new Error('An order must have either a customer or guest contact details'));
    return;
  }
  if (!this.room && !this.table) {
    next(new Error('An order must be linked to either a room or a table'));
    return;
  }
  next();
});

export const Order = model<IOrder>('Order', orderSchema);
