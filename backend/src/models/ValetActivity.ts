import { Schema, model, type Document, type Types } from 'mongoose';

export interface IValetActivity extends Document {
  _id: Types.ObjectId;
  valetManager: Types.ObjectId;
  vehicle: Types.ObjectId;
  action: string;
  details?: string;
  createdAt: Date;
}

const valetActivitySchema = new Schema<IValetActivity>(
  {
    valetManager: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    details: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ValetActivity = model<IValetActivity>('ValetActivity', valetActivitySchema);
