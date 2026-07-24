import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { Complaint, Room, RoomBooking, type ComplaintStatus } from '@/models';
import { emitToAdmins, emitToUser } from '@/realtime/emit';
import { getPageParams, pageMeta } from '@/utils/pagination';
import { emailService } from '@/services/email/brevo.service';
import { logger } from '@/config/logger';
import type { FilterQuery } from 'mongoose';

const POPULATE = [
  { path: 'room', select: 'roomNumber floor roomType' },
  { path: 'assignedStaff', select: 'name email designation' },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Guests may only raise service tickets once they are physically in the hotel.
 * A future or merely confirmed reservation is not enough — housekeeping and
 * maintenance requests are meaningless before the guest occupies the room.
 */
async function requireCheckedInStay(roomId: string, identity: { email?: string; phone?: string }) {
  const orIdentity: FilterQuery<any>[] = [];
  if (identity.email) {
    orIdentity.push({
      email: { $regex: `^${escapeRegex(identity.email.trim())}$`, $options: 'i' },
    });
  }
  if (identity.phone) orIdentity.push({ phone: identity.phone.trim() });

  const base: FilterQuery<any> = { room: roomId };
  if (orIdentity.length > 0) base.$or = orIdentity;

  const checkedIn = await RoomBooking.findOne({ ...base, status: 'CHECKED_IN' });
  if (checkedIn) return checkedIn;

  // Distinguish "you have a stay but haven't arrived" from "this isn't your room",
  // so the guest gets an actionable message instead of a bare 403.
  const upcoming = await RoomBooking.findOne({
    ...base,
    status: { $in: ['PENDING', 'CONFIRMED'] },
  });

  if (upcoming) {
    throw AppError.forbidden(
      'You can request hotel services after completing check-in.',
      'CHECK_IN_REQUIRED',
    );
  }

  throw AppError.forbidden(
    'We could not find an active stay for this room under your details. Please contact the front desk.',
    'NO_ACTIVE_STAY',
  );
}

// Guest side: Create service ticket
export const createComplaint = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, guestName, phone, email, category, priority, description } = req.body;

  const room = await Room.findById(roomId);
  if (!room) throw AppError.notFound('Room not found');

  // Prefer the authenticated identity; fall back to the submitted details.
  const identity = { email: req.auth?.email || email, phone };
  const booking = await requireCheckedInStay(roomId, identity);

  const complaint = await Complaint.create({
    room: roomId,
    booking: booking._id,
    guestName,
    phone,
    email: identity.email,
    category,
    priority: priority || 'MEDIUM',
    description,
    status: 'PENDING',
    timeline: [
      {
        status: 'PENDING',
        timestamp: new Date(),
        note: 'Service request received.',
        updatedBy: guestName,
      },
    ],
  });

  const populated = await complaint.populate(POPULATE);

  // Trigger realtime alert for Admins/Staff and the guest's own ticket list
  emitToAdmins('complaint:new', populated);
  if (req.auth?.userId) emitToUser(req.auth.userId, 'complaint:new', populated);

  return created(res, { complaint: populated });
});

// Guest side: Track tickets by phone, email or room
export const getGuestComplaints = asyncHandler(async (req: Request, res: Response) => {
  const { phone, email, roomId } = req.query;

  const filter: FilterQuery<any> = {};
  if (phone) filter.phone = (phone as string).trim();
  if (email) {
    filter.email = {
      $regex: `^${escapeRegex((email as string).trim())}$`,
      $options: 'i',
    };
  }
  if (roomId) filter.room = roomId as string;

  if (!phone && !email && !roomId) {
    throw AppError.badRequest('Phone, Email, or Room ID is required');
  }

  const complaints = await Complaint.find(filter).populate(POPULATE).sort({ createdAt: -1 });

  return ok(res, { complaints });
});

// Guest side: can this guest currently raise a ticket, and for which rooms?
export const getServiceEligibility = asyncHandler(async (req: Request, res: Response) => {
  const email = (req.auth?.email || (req.query.email as string) || '').trim();
  const phone = (req.query.phone as string | undefined)?.trim();

  if (!email && !phone) {
    throw AppError.badRequest('Email or phone is required');
  }

  const orIdentity: FilterQuery<any>[] = [];
  if (email) orIdentity.push({ email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' } });
  if (phone) orIdentity.push({ phone });

  const stays = await RoomBooking.find({
    $or: orIdentity,
    status: { $in: ['CONFIRMED', 'CHECKED_IN'] },
  }).populate('room', 'roomNumber floor roomType');

  const checkedIn = stays.filter((s) => s.status === 'CHECKED_IN');

  return ok(res, {
    eligible: checkedIn.length > 0,
    reason:
      checkedIn.length > 0
        ? null
        : stays.length > 0
          ? 'You can request hotel services after completing check-in.'
          : 'No active stay found for your account.',
    rooms: checkedIn.map((s) => ({
      bookingId: s._id.toString(),
      roomId: (s.room as any)?._id?.toString(),
      roomNumber: (s.room as any)?.roomNumber,
      floor: (s.room as any)?.floor,
      roomType: (s.room as any)?.roomType,
    })),
  });
});

// Admin side: List tickets (paginated & filterable)
export const listComplaints = asyncHandler(async (req: Request, res: Response) => {
  const { status, category, search } = req.query;
  const { page, limit, skip } = getPageParams({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  const filter: FilterQuery<any> = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (search) {
    const rx = { $regex: escapeRegex(search as string), $options: 'i' };
    filter.$or = [{ guestName: rx }, { phone: rx }, { email: rx }, { description: rx }];
  }

  const [items, total] = await Promise.all([
    Complaint.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Complaint.countDocuments(filter),
  ]);

  return ok(res, { complaints: items }, 200, pageMeta(total, page, limit));
});

// Admin side: Update status / assign staff
export const updateComplaint = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, assignedStaff, staffNotes } = req.body;

  const complaint = await Complaint.findById(id);
  if (!complaint) throw AppError.notFound('Complaint not found');

  const previousStatus = complaint.status;

  if (assignedStaff !== undefined) {
    complaint.assignedStaff = assignedStaff || undefined;
  }
  if (staffNotes !== undefined) complaint.staffNotes = staffNotes;

  // Assigning staff to an untouched ticket implicitly advances it to ASSIGNED.
  let nextStatus: ComplaintStatus | undefined = status;
  if (!nextStatus && assignedStaff && previousStatus === 'PENDING') {
    nextStatus = 'ASSIGNED';
  }

  if (nextStatus && nextStatus !== previousStatus) {
    complaint.status = nextStatus;
    complaint.timeline.push({
      status: nextStatus,
      timestamp: new Date(),
      note: staffNotes || `Status changed from ${previousStatus} to ${nextStatus}.`,
      updatedBy: req.auth?.email || 'Staff',
    });
  }

  await complaint.save();
  const populated = await complaint.populate(POPULATE);

  // Alert updates in real-time
  emitToAdmins('complaint:updated', populated);

  if (nextStatus && nextStatus !== previousStatus && complaint.email) {
    emailService
      .sendServiceTicketStatus(
        complaint.email,
        complaint.guestName,
        complaint._id.toString().slice(-6).toUpperCase(),
        (populated.room as any)?.roomNumber || 'N/A',
        complaint.category,
        nextStatus,
        complaint.staffNotes,
      )
      .catch((err) => logger.error({ err }, 'Failed to send service ticket status email'));
  }

  return ok(res, { complaint: populated });
});
