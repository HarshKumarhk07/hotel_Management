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
  governmentId?: string;
  specialRequests: ISpecialRequests;
  priceBreakdown: IPriceBreakdown;
  payment: IBookingPayment;
  confirmationNumber?: string;
  timeline: ITimelineEvent[];
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
    governmentId: { type: String },
    specialRequests: { type: specialRequestsSchema, default: () => ({}) },
    priceBreakdown: { type: priceBreakdownSchema, required: true },
    payment: { type: bookingPaymentSchema, default: () => ({}) },
    confirmationNumber: { type: String, unique: true, sparse: true, index: true },
    timeline: { type: [timelineEventSchema], default: [] },
  },
  { timestamps: true }
);

export const RoomBooking = model<IRoomBooking>('RoomBooking', roomBookingSchema);
