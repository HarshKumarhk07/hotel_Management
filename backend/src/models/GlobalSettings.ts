import mongoose, { Document, Schema } from 'mongoose';

export interface IGlobalSettings extends Document {
  // Hotel Information
  hotelName: string;
  contactNumber: string;
  email: string;
  address: string;

  // Booking Settings
  tableAdvancePercentage: number;
  enableTableAdvancePayment: boolean;
  enableOnlineTableBooking: boolean;
  tableLockDurationMinutes: number;

  // Business Settings
  currency: string;
  timezone: string;

  // Audit Fields
  updatedBy?: mongoose.Types.ObjectId;
}

const GlobalSettingsSchema = new Schema<IGlobalSettings>(
  {
    hotelName: { type: String, default: 'The Page Hotel' },
    contactNumber: { type: String, default: '+91 98765 43210' },
    email: { type: String, default: 'contact@thepagerohtak.com' },
    address: { type: String, default: 'Delhi NCR Road, Sector 15, Near Crown Landmark, India' },

    tableAdvancePercentage: { type: Number, default: 20, min: 0, max: 100 },
    enableTableAdvancePayment: { type: Boolean, default: false },
    enableOnlineTableBooking: { type: Boolean, default: true },
    tableLockDurationMinutes: { type: Number, default: 10, min: 1, max: 60 },

    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },

    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const GlobalSettings = mongoose.model<IGlobalSettings>('GlobalSettings', GlobalSettingsSchema);
