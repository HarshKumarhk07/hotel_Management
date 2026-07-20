import { Schema, model, type Document, type Types } from 'mongoose';

export interface IFeedback extends Document {
  _id: Types.ObjectId;
  guestName: string;
  email?: string;
  phone: string;
  roomNumber?: string;
  category: 'ROOM' | 'FOOD' | 'VALET' | 'GENERAL';
  rating: number;
  comment: string;
  createdAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    guestName: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    roomNumber: { type: String, trim: true },
    category: {
      type: String,
      enum: ['ROOM', 'FOOD', 'VALET', 'GENERAL'],
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5, index: true },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Feedback = model<IFeedback>('Feedback', feedbackSchema);
