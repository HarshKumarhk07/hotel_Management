import mongoose, { Document, Schema } from 'mongoose';

export interface IRoomCategory extends Document {
  roomType: string;
  displayName: string;
  description: string;
  pricePerNight: number;
  capacity: number;
  amenities: string[];
  images: string[];
  
  // Audit Fields
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const RoomCategorySchema = new Schema<IRoomCategory>(
  {
    roomType: {
      type: String,
      required: true,
      unique: true,
    },
    displayName: { type: String, required: true },
    description: { type: String, default: '' },
    pricePerNight: { type: Number, required: true, min: 0 },
    capacity: { type: Number, default: 2 },
    amenities: { type: [String], default: [] },
    images: { type: [String], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const RoomCategory = mongoose.model<IRoomCategory>('RoomCategory', RoomCategorySchema);
