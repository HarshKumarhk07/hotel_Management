import { Schema, model, type Document, type Types } from 'mongoose';

export interface IBanner extends Document {
  _id: Types.ObjectId;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  kitchen?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 250 },
    imageUrl: { type: String, required: true },
    linkUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    kitchen: { type: Schema.Types.ObjectId, ref: 'Kitchen', index: true },
  },
  { timestamps: true }
);

export const Banner = model<IBanner>('Banner', bannerSchema);