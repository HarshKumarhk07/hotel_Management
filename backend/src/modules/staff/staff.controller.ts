import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { User, Role, Staff } from '@/models';
import { ROLES, STAFF_STATUS } from '@/constants';
import mongoose from 'mongoose';

// ── Roles ──────────────────────────────────────────────────────────────────────

export const listRoles = asyncHandler(async (req: Request, res: Response) => {
  const isSuper = req.auth!.role === ROLES.SUPER_ADMIN;
  const kitchenId = isSuper ? req.query.kitchenId as string : req.auth!.kitchenId;

  const q: any = {};
  if (kitchenId) {
    q.$or = [{ kitchen: kitchenId }, { isSystem: true }];
  } else if (!isSuper) {
    throw AppError.forbidden('Access denied');
  }

  const items = await Role.find(q).sort({ isSystem: -1, name: 1 });
  return ok(res, { roles: items });
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const isSuper = req.auth!.role === ROLES.SUPER_ADMIN;
  const kitchenId = isSuper ? req.body.kitchenId : req.auth!.kitchenId;

  if (!isSuper && !kitchenId) {
    throw AppError.badRequest('kitchenId is required');
  }

  const role = await Role.create({
    name: req.body.name,
    description: req.body.description,
    permissions: req.body.permissions,
    kitchen: kitchenId || undefined,
    isSystem: false,
  });

  return created(res, { role });
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw AppError.notFound('Role not found');
  if (role.isSystem) throw AppError.badRequest('System roles cannot be modified');

  // Tenant check for kitchen owners
  if (req.auth!.role === ROLES.KITCHEN_OWNER && role.kitchen?.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Access denied');
  }

  Object.assign(role, req.body);
  await role.save();
  return ok(res, { role });
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw AppError.notFound('Role not found');
  if (role.isSystem) throw AppError.badRequest('System roles cannot be deleted');

  if (req.auth!.role === ROLES.KITCHEN_OWNER && role.kitchen?.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Access denied');
  }

  // Check if role is in use
  const inUse = await Staff.exists({ role: role._id });
  if (inUse) throw AppError.badRequest('Role is currently assigned to staff');

  await role.deleteOne();
  return ok(res, { message: 'Role deleted successfully' });
});

// ── Staff ──────────────────────────────────────────────────────────────────────

export const listStaff = asyncHandler(async (req: Request, res: Response) => {
  const isSuper = req.auth!.role === ROLES.SUPER_ADMIN;
  const kitchenId = isSuper ? req.query.kitchenId as string : req.auth!.kitchenId;

  const q: any = {};
  if (kitchenId) q.kitchen = kitchenId;

  const items = await Staff.find(q)
    .populate('user', 'name email phone isActive lastLoginAt')
    .populate('role', 'name permissions')
    .sort({ createdAt: -1 });

  return ok(res, { staff: items });
});

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const isSuper = req.auth!.role === ROLES.SUPER_ADMIN;
  const kitchenId = isSuper ? req.body.kitchenId : req.auth!.kitchenId;

  if (!kitchenId) throw AppError.badRequest('kitchenId is required');

  const existingUser = await User.exists({ email: req.body.email });
  if (existingUser) throw AppError.conflict('Email already in use');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Create the user account with a standard placeholder role
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      role: ROLES.CUSTOMER, // Staff are authenticated as users, custom Role governs access
      kitchen: kitchenId,
      isEmailVerified: true,
    });
    (user as any).password = req.body.password;
    await user.save({ session });

    // 2. Create the staff record
    const staff = await Staff.create([{
      user: user._id,
      kitchen: kitchenId,
      role: req.body.roleId || undefined,
      employeeId: req.body.employeeId,
      designation: req.body.designation,
      status: STAFF_STATUS.ACTIVE,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const populated = await Staff.findById(staff[0]._id)
      .populate('user', 'name email phone isActive')
      .populate('role', 'name permissions');

    return created(res, { staff: populated });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) throw AppError.notFound('Staff member not found');

  if (req.auth!.role === ROLES.KITCHEN_OWNER && staff.kitchen?.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Access denied');
  }

  // Update staff fields
  if (req.body.roleId !== undefined) staff.role = req.body.roleId || undefined;
  if (req.body.designation !== undefined) staff.designation = req.body.designation;
  if (req.body.employeeId !== undefined) staff.employeeId = req.body.employeeId;
  if (req.body.status !== undefined) staff.status = req.body.status;

  await staff.save();

  // If status is updated, also update User's active status
  if (req.body.status) {
    const active = req.body.status === STAFF_STATUS.ACTIVE;
    await User.findByIdAndUpdate(staff.user, { isActive: active });
  }

  const populated = await Staff.findById(staff._id)
    .populate('user', 'name email phone isActive')
    .populate('role', 'name permissions');

  return ok(res, { staff: populated });
});

export const getStaffDetails = asyncHandler(async (req: Request, res: Response) => {
  const staff = await Staff.findById(req.params.id)
    .populate('user', 'name email phone isActive lastLoginAt')
    .populate('role', 'name permissions');

  if (!staff) throw AppError.notFound('Staff member not found');
  if (req.auth!.role === ROLES.KITCHEN_OWNER && staff.kitchen?.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Access denied');
  }

  return ok(res, { staff });
});
