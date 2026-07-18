import { z } from 'zod';
import { ALL_PERMISSIONS, STAFF_STATUS } from '@/constants';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, 'Role name is required').max(60),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).min(1, 'At least one permission is required'),
  kitchenId: objectId.optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional(),
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleId: objectId.optional(),
  designation: z.string().trim().max(80).optional(),
  employeeId: z.string().trim().optional(),
  kitchenId: objectId.optional(),
});

export const updateStaffSchema = z.object({
  roleId: objectId.optional().nullable(),
  designation: z.string().trim().max(80).optional(),
  employeeId: z.string().trim().optional(),
  status: z.enum(Object.values(STAFF_STATUS) as [string, ...string[]]).optional(),
});
