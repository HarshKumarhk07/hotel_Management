import { Schema, model, type Types } from 'mongoose';

export type ValetStatus = 'PARKED' | 'REQUESTED' | 'BRINGING' | 'READY' | 'DELIVERED';

export interface IVehiclePhoto {
  url: string;
  publicId: string;
}

export interface IVehicleHistory {
  status: ValetStatus;
  at: Date;
  by?: Types.ObjectId;
  notes?: string;
}

export interface IVehicle {
  _id: Types.ObjectId;
  carNumber: string;
  brand: string;
  model: string;
  color: string;
  parkingSlot: string;
  fuelLevel?: string;
  odometer?: number;
  keyTag: string;
  status: ValetStatus;
  
  guestInfo: {
    name: string;
    roomNumber: string;
    phone: string;
    email: string;
  };
  
  photos: {
    front: IVehiclePhoto;
    rear: IVehiclePhoto;
    left: IVehiclePhoto;
    right: IVehiclePhoto;
    dashboard: IVehiclePhoto;
    damage?: IVehiclePhoto[];
  };
  
  secureToken: string;
  statusHistory: IVehicleHistory[];
  checkedInAt: Date;
  deliveredAt?: Date;
  requestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const vehiclePhotoSchema = new Schema<IVehiclePhoto>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const vehicleHistorySchema = new Schema<IVehicleHistory>(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false }
);

const vehicleSchema = new Schema<IVehicle>(
  {
    secureToken: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    carNumber: { 
      type: String, 
      required: true, 
      trim: true, 
      index: true 
    },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    parkingSlot: { type: String, required: true, trim: true, index: true },
    fuelLevel: { type: String, trim: true },
    odometer: { type: Number },
    keyTag: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PARKED', 'REQUESTED', 'BRINGING', 'READY', 'DELIVERED'],
      default: 'PARKED',
      index: true,
    },
    guestInfo: {
      name: { type: String, required: true, trim: true },
      roomNumber: { type: String, required: true, trim: true, index: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true, index: true },
    },
    photos: {
      front: { type: vehiclePhotoSchema, required: true },
      rear: { type: vehiclePhotoSchema, required: true },
      left: { type: vehiclePhotoSchema, required: true },
      right: { type: vehiclePhotoSchema, required: true },
      dashboard: { type: vehiclePhotoSchema, required: true },
      damage: [vehiclePhotoSchema],
    },
    statusHistory: [vehicleHistorySchema],
    checkedInAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
    requestedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound indexes for searching vehicles and filtering active requests
vehicleSchema.index({ status: 1, carNumber: 1 });
vehicleSchema.index({ 'guestInfo.roomNumber': 1, status: 1 });

export const Vehicle = model<IVehicle>('Vehicle', vehicleSchema);
