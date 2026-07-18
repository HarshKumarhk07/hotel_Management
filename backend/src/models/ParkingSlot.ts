import { Schema, model, type Document, type Types } from 'mongoose';

export interface IParkingSlot extends Document {
  _id: Types.ObjectId;
  slotNumber: string;
  isOccupied: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const parkingSlotSchema = new Schema<IParkingSlot>(
  {
    slotNumber: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true, 
      index: true 
    },
    isOccupied: { type: Boolean, default: false, index: true },
    notes: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

export const ParkingSlot = model<IParkingSlot>('ParkingSlot', parkingSlotSchema);
