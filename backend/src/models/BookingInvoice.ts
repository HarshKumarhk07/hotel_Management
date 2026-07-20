import { Schema, model, type Document, type Types } from 'mongoose';

export interface IBillingDetails {
  roomCharges: number;
  foodCharges: number;
  valetCharges: number;
  extraBed: number;
  subtotal: number;
  gst: number;
  serviceCharge: number;
  discount: number;
  grandTotal: number;
}

export interface IBookingInvoice extends Document {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  invoiceNumber: string;
  issuedAt: Date;
  guestDetails: {
    name: string;
    email: string;
    phone: string;
  };
  billingDetails: IBillingDetails;
  paymentSummary: {
    paidAmount: number;
    method: string;
    transactionId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const billingDetailsSchema = new Schema<IBillingDetails>(
  {
    roomCharges: { type: Number, required: true },
    foodCharges: { type: Number, default: 0 },
    valetCharges: { type: Number, default: 0 },
    extraBed: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    gst: { type: Number, default: 0 },
    serviceCharge: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
  },
  { _id: false }
);

const bookingInvoiceSchema = new Schema<IBookingInvoice>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'RoomBooking', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    issuedAt: { type: Date, default: Date.now },
    guestDetails: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    billingDetails: { type: billingDetailsSchema, required: true },
    paymentSummary: {
      paidAmount: { type: Number, required: true },
      method: { type: String, required: true },
      transactionId: { type: String },
    },
  },
  { timestamps: true }
);

export const BookingInvoice = model<IBookingInvoice>('BookingInvoice', bookingInvoiceSchema);
