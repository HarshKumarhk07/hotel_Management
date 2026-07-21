import { Schema, model, type Document, type Types } from 'mongoose';

export interface IBanquetHall extends Document {
  _id: Types.ObjectId;
  name: string;
  capacity: number;
  pricePerHour: number;
  pricePerPlate: number;
  isActive: boolean;
  kitchen: Types.ObjectId;
  description?: string;
  area?: string;
  eventTypes?: string[];
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const banquetHallSchema = new Schema<IBanquetHall>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    capacity: { type: Number, required: true, min: 1 },
    pricePerHour: { type: Number, required: true, min: 0 },
    pricePerPlate: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', index: true },
    description: { type: String, trim: true, maxlength: 500 },
    area: { type: String, trim: true, maxlength: 50 },
    eventTypes: [{ type: String, trim: true }],
    image: { type: String, trim: true },
  },
  { timestamps: true }
);

export const BanquetHall = model<IBanquetHall>('BanquetHall', banquetHallSchema);