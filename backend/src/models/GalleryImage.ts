import { Schema, model, type Document } from 'mongoose';

export interface IGalleryImage extends Document {
  url: string;
  title: string;
  description?: string;
  category?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const galleryImageSchema = new Schema<IGalleryImage>(
  {
    url: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    category: { type: String, trim: true, default: 'General' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const GalleryImage = model<IGalleryImage>('GalleryImage', galleryImageSchema);
