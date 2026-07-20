import { Schema, model, type Document, type Types } from 'mongoose';

export interface IComplaint extends Document {
  _id: Types.ObjectId;
  room: Types.ObjectId;
  guestName: string;
  phone: string;
  category: 'HOUSEKEEPING' | 'MAINTENANCE' | 'ROOM_SERVICE' | 'OTHER';
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  assignedStaff?: Types.ObjectId;
  staffNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaint>(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    guestName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['HOUSEKEEPING', 'MAINTENANCE', 'ROOM_SERVICE', 'OTHER'],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'],
      default: 'PENDING',
      index: true,
    },
    assignedStaff: { type: Schema.Types.ObjectId, ref: 'Staff', index: true },
    staffNotes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

export const Complaint = model<IComplaint>('Complaint', complaintSchema);
