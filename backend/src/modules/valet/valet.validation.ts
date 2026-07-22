import { z } from 'zod';

export const checkInVehicleSchema = z.object({
  carNumber: z.string().trim().min(1, 'Car number is required'),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  color: z.string().trim().optional(),
  parkingSlot: z.string().trim().optional(),
  fuelLevel: z.string().trim().optional(),
  odometer: z.coerce.number().optional(),
  keyTag: z.string().trim().optional(),
  guestInfo: z.object({
    name: z.string().trim().min(1, 'Guest name is required'),
    roomNumber: z.string().trim().optional(),
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

export const createSlotSchema = z.object({
  slotNumber: z.string().trim().min(1, 'Slot number is required').max(10),
});
