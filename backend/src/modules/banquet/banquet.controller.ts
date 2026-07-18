import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import { AppError } from '@/utils/AppError';
import { BanquetHall, BanquetBooking } from '@/models';
import { ROLES } from '@/constants';
import * as pdfService from './pdf.service';

// ── Halls CRUD ──

export const listHalls = asyncHandler(async (req: Request, res: Response) => {
  const isSuper = req.auth?.role === ROLES.SUPER_ADMIN;
  const kitchenId = isSuper ? req.query.kitchenId as string : req.auth?.kitchenId;

  const q: any = {};
  if (kitchenId) q.kitchen = kitchenId;
  else if (!isSuper) {
    // If guest/customer lists halls, get active ones
    q.isActive = true;
  }

  const items = await BanquetHall.find(q).sort({ name: 1 });
  return ok(res, { halls: items });
});

export const createHall = asyncHandler(async (req: Request, res: Response) => {
  const isSuper = req.auth!.role === ROLES.SUPER_ADMIN;
  const kitchenId = isSuper ? req.body.kitchenId : req.auth!.kitchenId;

  if (!kitchenId) throw AppError.badRequest('kitchenId is required');

  const hall = await BanquetHall.create({
    name: req.body.name,
    capacity: req.body.capacity,
    pricePerHour: req.body.pricePerHour,
    pricePerPlate: req.body.pricePerPlate || 0,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    kitchen: kitchenId,
  });

  return created(res, { hall });
});

export const updateHall = asyncHandler(async (req: Request, res: Response) => {
  const hall = await BanquetHall.findById(req.params.id);
  if (!hall) throw AppError.notFound('Hall not found');

  if (req.auth!.role === ROLES.KITCHEN_OWNER && hall.kitchen.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Access denied');
  }

  Object.assign(hall, req.body);
  await hall.save();
  return ok(res, { hall });
});

export const deleteHall = asyncHandler(async (req: Request, res: Response) => {
  const hall = await BanquetHall.findById(req.params.id);
  if (!hall) throw AppError.notFound('Hall not found');

  if (req.auth!.role === ROLES.KITCHEN_OWNER && hall.kitchen.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Access denied');
  }

  // Check bookings before deleting
  const hasBookings = await BanquetBooking.exists({ hall: hall._id });
  if (hasBookings) {
    throw AppError.badRequest('Cannot delete hall with existing bookings');
  }

  await hall.deleteOne();
  return ok(res, { message: 'Hall deleted successfully' });
});

// ── Bookings CRUD ──

export const listBookings = asyncHandler(async (req: Request, res: Response) => {
  const isSuper = req.auth?.role === ROLES.SUPER_ADMIN;
  const kitchenId = isSuper ? req.query.kitchenId as string : req.auth?.kitchenId;

  const q: any = {};
  if (kitchenId) {
    const halls = await BanquetHall.find({ kitchen: kitchenId }).select('_id');
    q.hall = { $in: halls.map(h => h._id) };
  } else if (!isSuper) {
    // If guest/customer queries, filter by email/phone or let them see their bookings
    const { email, phone } = req.query;
    if (!email && !phone) throw AppError.badRequest('Search email or phone is required');
    if (email) q.email = email;
    if (phone) q.phone = phone;
  }

  const items = await BanquetBooking.find(q)
    .populate('hall', 'name capacity pricePerHour pricePerPlate')
    .sort({ startTime: 1 });

  return ok(res, { bookings: items });
});

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const { hallId, guestName, phone, email, eventDate, startTime, endTime, guestCount, eventType, menuPreset, paymentStatus } = req.body;

  const hall = await BanquetHall.findById(hallId);
  if (!hall) throw AppError.notFound('Banquet hall not found');
  if (!hall.isActive) throw AppError.badRequest('Banquet hall is currently inactive');

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) throw AppError.badRequest('End time must be after start time');

  // Check overlaps
  const overlap = await BanquetBooking.exists({
    hall: hallId,
    status: { $in: ['PENDING', 'CONFIRMED'] },
    $or: [
      { startTime: { $lt: end }, endTime: { $gt: start } },
    ],
  });

  if (overlap) {
    throw AppError.conflict('The hall is already booked or reserved for this time window');
  }

  // Calculate pricing
  const rentalHours = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
  const totalPrice = (rentalHours * hall.pricePerHour) + (guestCount * (hall.pricePerPlate || 0));

  const booking = await BanquetBooking.create({
    hall: hallId,
    guestName,
    phone,
    email,
    eventDate: new Date(eventDate),
    startTime: start,
    endTime: end,
    guestCount,
    eventType,
    menuPreset,
    totalPrice,
    status: 'PENDING',
    paymentStatus: paymentStatus || 'PENDING',
  });

  const populated = await BanquetBooking.findById(booking._id).populate('hall', 'name capacity');
  return created(res, { booking: populated });
});

export const updateBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await BanquetBooking.findById(req.params.id).populate('hall');
  if (!booking) throw AppError.notFound('Booking not found');

  const hall = booking.hall as any;
  if (req.auth!.role === ROLES.KITCHEN_OWNER && hall.kitchen.toString() !== req.auth!.kitchenId) {
    throw AppError.forbidden('Access denied');
  }

  if (req.body.status) booking.status = req.body.status;
  if (req.body.paymentStatus) booking.paymentStatus = req.body.paymentStatus;

  await booking.save();
  return ok(res, { booking });
});

export const downloadQuotation = asyncHandler(async (req: Request, res: Response) => {
  const booking = await BanquetBooking.findById(req.params.id).populate('hall');
  if (!booking) throw AppError.notFound('Booking not found');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=banquet-quotation-${booking._id}.pdf`);

  await pdfService.generateQuotationPdf(booking, res);
});

export const downloadEstimation = asyncHandler(async (req: Request, res: Response) => {
  const booking = await BanquetBooking.findById(req.params.id).populate('hall');
  if (!booking) throw AppError.notFound('Booking not found');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=banquet-estimation-${booking._id}.pdf`);

  await pdfService.generateEstimationPdf(booking, res);
});
