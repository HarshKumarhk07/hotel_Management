import { Schema, model, type Document, type Types } from 'mongoose';

export interface ISpecialRequests {
  lateCheckIn: boolean;
  extraBed: boolean;
  airportPickup: boolean;
  note?: string;
}

export interface IPriceBreakdown {
  roomPrice: number;
  nights: number;
  gst: number;
  serviceCharge: number;
  extraBedCharges: number;
  additionalCharges: number;
  couponCode?: string;
  discountAmount: number;
  grandTotal: number;
}

export interface IBookingPayment {
  method: string;
  status: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  paidAt?: Date;
}

export interface ITimelineEvent {
  status: string;
  timestamp: Date;
  note: string;
  updatedBy?: string;
}

export type TransferKind = 'NORMAL' | 'UPGRADE' | 'DOWNGRADE';
export type TransferState = 'PENDING_PAYMENT' | 'COMPLETED' | 'CANCELLED';

/**
 * A single room-transfer record. Same-category moves and downgrades complete
 * immediately; upgrades are parked in `PENDING_PAYMENT` until an admin confirms
 * the differential payment has been collected.
 */
export interface IRoomTransfer {
  type: TransferKind;
  state: TransferState;
  fromRoom: Types.ObjectId;
  toRoom: Types.ObjectId;
  fromRoomNumber: string;
  toRoomNumber: string;
  fromRoomType: string;
  toRoomType: string;
  fromFloor: number;
  toFloor: number;
  nights: number;
  /** Upgrade only — differential the guest still owes (incl. tax + service). */
  amountDue: number;
  /** Downgrade only — differential owed back to the guest. */
  refundAmount: number;
  refundStatus?: 'PENDING' | 'PROCESSED';
  requestedAt: Date;
  completedAt?: Date;
  requestedBy?: string;
  completedBy?: string;
  note?: string;
}

export interface IRoomBooking extends Document {
  _id: Types.ObjectId;
  room: Types.ObjectId;
  guestName: string;
  phone: string;
  email: string;
  checkInDate: Date;
  checkOutDate: Date;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID';
  address?: string;
  city?: string;
  country?: string;
  governmentId: string;
  idProofUrl: string;
  idProofType: string;
  specialRequests: ISpecialRequests;
  priceBreakdown: IPriceBreakdown;
  payment: IBookingPayment;
  confirmationNumber?: string;
  timeline: ITimelineEvent[];
  /** Completed/cancelled transfer history, newest appended last. */
  transfers: IRoomTransfer[];
  /** The single in-flight upgrade awaiting admin payment confirmation. */
  pendingTransfer?: IRoomTransfer;
  createdAt: Date;
  updatedAt: Date;
}

const specialRequestsSchema = new Schema<ISpecialRequests>(
  {
    lateCheckIn: { type: Boolean, default: false },
    extraBed: { type: Boolean, default: false },
    airportPickup: { type: Boolean, default: false },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const priceBreakdownSchema = new Schema<IPriceBreakdown>(
  {
    roomPrice: { type: Number, required: true },
    nights: { type: Number, required: true },
    gst: { type: Number, default: 0 },
    serviceCharge: { type: Number, default: 0 },
    extraBedCharges: { type: Number, default: 0 },
    additionalCharges: { type: Number, default: 0 },
    couponCode: { type: String },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
  },
  { _id: false }
);

const bookingPaymentSchema = new Schema<IBookingPayment>(
  {
    method: { type: String, default: 'RAZORPAY' },
    status: { type: String, default: 'PENDING' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paidAt: { type: Date },
  },
  { _id: false }
);

const timelineEventSchema = new Schema<ITimelineEvent>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, required: true },
    updatedBy: { type: String },
  },
  { _id: false }
);

const roomTransferSchema = new Schema<IRoomTransfer>(
  {
    type: { type: String, enum: ['NORMAL', 'UPGRADE', 'DOWNGRADE'], required: true },
    state: { type: String, enum: ['PENDING_PAYMENT', 'COMPLETED', 'CANCELLED'], required: true },
    fromRoom: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    toRoom: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    fromRoomNumber: { type: String, default: '' },
    toRoomNumber: { type: String, default: '' },
    fromRoomType: { type: String, default: '' },
    toRoomType: { type: String, default: '' },
    fromFloor: { type: Number, default: 0 },
    toFloor: { type: Number, default: 0 },
    nights: { type: Number, default: 1 },
    amountDue: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    refundStatus: { type: String, enum: ['PENDING', 'PROCESSED'] },
    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    requestedBy: { type: String },
    completedBy: { type: String },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const roomBookingSchema = new Schema<IRoomBooking>(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    guestName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    checkInDate: { type: Date, required: true, index: true },
    checkOutDate: { type: Date, required: true, index: true },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID'],
      default: 'PENDING',
      index: true,
    },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    governmentId: { type: String, required: true },
    idProofUrl: { type: String, required: true },
    idProofType: { type: String, enum: ['Aadhaar', 'Passport', 'Driving License', 'Voter ID', 'Other'], required: true },
    specialRequests: { type: specialRequestsSchema, default: () => ({}) },
    priceBreakdown: { type: priceBreakdownSchema, required: true },
    payment: { type: bookingPaymentSchema, default: () => ({}) },
    confirmationNumber: { type: String, unique: true, sparse: true, index: true },
    timeline: { type: [timelineEventSchema], default: [] },
    transfers: { type: [roomTransferSchema], default: [] },
    pendingTransfer: { type: roomTransferSchema, default: undefined },
  },
  { timestamps: true }
);

export const RoomBooking = model<IRoomBooking>('RoomBooking', roomBookingSchema);
