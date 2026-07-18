import { z } from 'zod';

export const checkInVehicleSchema = z.object({
  carNumber: z.string().trim().min(1, 'Car number is required'),
  brand: z.string().trim().min(1, 'Brand is required'),
  model: z.string().trim().min(1, 'Model is required'),
  color: z.string().trim().min(1, 'Color is required'),
  parkingSlot: z.string().trim().min(1, 'Parking slot is required'),
  fuelLevel: z.string().trim().optional(),
  odometer: z.coerce.number().optional(),
  keyTag: z.string().trim().min(1, 'Key tag is required'),
  guestInfo: z.object({
    name: z.string().trim().min(1, 'Guest name is required'),
    roomNumber: z.string().trim().min(1, 'Room number is required'),
    phone: z.string().trim().min(1, 'Phone is required'),
    email: z.string().trim().email('Valid email is required'),
  }),
});

export const updateStatusSchema = z.object({
  status: z.enum(['PARKED', 'REQUESTED', 'BRINGING', 'READY', 'DELIVERED']),
  notes: z.string().trim().max(300).optional(),
});

export const carNumberParam = z.object({
  carNumber: z.string().min(1, 'Car number is required'),
});

export const scanTokenParam = z.object({
  token: z.string().min(1, 'Scan token is required'),
});

export const createValetManagerSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required').max(120),
  email: z.string().trim().email('Valid email address is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  employeeId: z.string().trim().optional(),
});

export const updateValetManagerSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required').max(120),
  email: z.string().trim().email('Valid email address is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  employeeId: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});
