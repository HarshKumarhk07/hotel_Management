import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { Complaint, Room } from '@/models';
import { emitToAdmins } from '@/realtime/emit';
import { getPageParams, pageMeta } from '@/utils/pagination';
import type { FilterQuery } from 'mongoose';

// Guest side: Create Complaint
export const createComplaint = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, guestName, phone, email, category, priority, description } = req.body;

  const room = await Room.findById(roomId);
  if (!room) throw AppError.notFound('Room not found');

  const complaint = await Complaint.create({
    room: roomId,
    guestName,
    phone,
    email,
    category,
    priority: priority || 'MEDIUM',
    description,
    status: 'PENDING',
  });

  const populated = await complaint.populate('room', 'roomNumber floor');

  // Trigger realtime alert for Admins/Staff
  emitToAdmins('complaint:new', populated);

  return created(res, { complaint: populated });
});

// Guest side: Track Complaints by phone, email or room
export const getGuestComplaints = asyncHandler(async (req: Request, res: Response) => {
  const { phone, email, roomId } = req.query;

  const filter: FilterQuery<any> = {};
  if (phone) filter.phone = (phone as string).trim();
  if (email) filter.email = (email as string).trim();
  if (roomId) filter.room = roomId as string;

  if (!phone && !email && !roomId) {
    throw AppError.badRequest('Phone, Email, or Room ID is required');
  }

  const complaints = await Complaint.find(filter)
    .populate('room', 'roomNumber floor')
    .sort({ createdAt: -1 });

  return ok(res, { complaints });
});

// Admin side: List Complaints (paginated & filterable)
export const listComplaints = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, status, category, search } = req.query;
  const { page: pNum, limit: lNum, skip } = getPageParams({ page: Number(page), limit: Number(limit) });

  const filter: FilterQuery<any> = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { guestName: { $regex: search as string, $options: 'i' } },
      { phone: { $regex: search as string, $options: 'i' } },
      { description: { $regex: search as string, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Complaint.find(filter)
      .populate('room', 'roomNumber floor')
      .populate('assignedStaff', 'name email designation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lNum),
    Complaint.countDocuments(filter),
  ]);

  return ok(res, { complaints: items }, 200, pageMeta(total, pNum, lNum));
});

// Admin side: Update Status or Assign Staff
export const updateComplaint = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, assignedStaff, staffNotes } = req.body;

  const complaint = await Complaint.findById(id);
  if (!complaint) throw AppError.notFound('Complaint not found');

  if (status) complaint.status = status;
  if (assignedStaff !== undefined) complaint.assignedStaff = assignedStaff || undefined;
  if (staffNotes !== undefined) complaint.staffNotes = staffNotes;

  await complaint.save();
  const populated = await complaint.populate([
    { path: 'room', select: 'roomNumber floor' },
    { path: 'assignedStaff', select: 'name email designation' }
  ]);

  // Alert updates in real-time
  emitToAdmins('complaint:updated', populated);

  return ok(res, { complaint: populated });
});
