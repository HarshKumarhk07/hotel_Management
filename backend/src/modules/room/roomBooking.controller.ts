import type { Request } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as service from './roomBooking.service';
import { generateInvoicePdfBuffer } from './roomInvoicePdf.service';
import { uploadFile } from '@/services/cloudinary.service';
import { AppError } from '@/utils/AppError';
import { ROLES } from '@/constants';

export const uploadIdProof = asyncHandler(async (req: Request, res) => {
  if (!req.file) {
    throw AppError.badRequest('No document uploaded', 'MISSING_FILE');
  }
  const result = await uploadFile(req.file.buffer, 'kds/docs/id');
  return ok(res, { url: result.url });
});

export const searchRooms = asyncHandler(async (req: Request, res) => {
  const q = req.query as any;
  const availableRooms = await service.searchAvailableRooms({
    checkInDate: q.checkInDate,
    checkOutDate: q.checkOutDate,
    floor: q.floor ? Number(q.floor) : undefined,
    roomType: q.roomType,
    minPrice: q.minPrice ? Number(q.minPrice) : undefined,
    maxPrice: q.maxPrice ? Number(q.maxPrice) : undefined,
    guestCount: q.guestCount ? Number(q.guestCount) : undefined,
  });
  return ok(res, { rooms: availableRooms });
});

export const createBooking = asyncHandler(async (req: Request, res) => {
  const booking = await service.createRoomBooking(req.body);
  return created(res, { booking });
});

export const getGuestBookings = asyncHandler(async (req: Request, res) => {
  const { email, phone } = req.query;
  const bookings = await service.getGuestBookings({
    email: email as string,
    phone: phone as string,
  });
  return ok(res, { bookings });
});

export const getBookingById = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const booking = await service.getBookingDetail(id);
  return ok(res, { booking });
});

export const listBookings = asyncHandler(async (req: Request, res) => {
  const { page, limit, search, status } = req.query;
  const { items, meta } = await service.listRoomBookings({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    search: search as string,
    status: status as string,
  });
  return ok(res, { bookings: items }, 200, meta);
});

export const updateBookingStatus = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const booking = await service.updateBookingStatus(id, status, staffActor(req));
  return ok(res, { booking });
});

export const setRoomStatus = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const room = await service.setRoomStatus(id, status);
  return ok(res, { room });
});

export const getBookingInvoice = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const invoiceData = await service.getBookingInvoiceData(id);
  return ok(res, { invoice: invoiceData });
});

export const downloadBookingInvoice = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const invoiceData = await service.getBookingInvoiceData(id);
  const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-room-${id}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.end(pdfBuffer);
});

export const checkIn = asyncHandler(async (req: Request, res) => {
  const booking = await service.checkInGuest(req.params.id, staffActor(req));
  return ok(res, { booking });
});

export const checkOut = asyncHandler(async (req: Request, res) => {
  const result = await service.checkOutGuest(req.params.id, staffActor(req));
  return ok(res, result);
});

/** The human-readable actor recorded on timeline entries and audit logs. */
function staffActor(req: Request) {
  return req.auth?.email || 'Staff';
}

export const upgradeRoom = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const { newRoomId } = req.body;
  const result = await service.upgradeRoom(id, newRoomId, staffActor(req));
  return ok(res, result);
});

export const transferRoom = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const { newRoomId } = req.body;
  const result = await service.transferRoom(id, newRoomId, staffActor(req));
  return ok(res, result);
});

export const getTransferOptions = asyncHandler(async (req: Request, res) => {
  const options = await service.getTransferOptions(req.params.id);
  return ok(res, options);
});

export const confirmTransferPayment = asyncHandler(async (req: Request, res) => {
  const result = await service.confirmTransferPayment(req.params.id, staffActor(req));
  return ok(res, result);
});

export const cancelPendingTransfer = asyncHandler(async (req: Request, res) => {
  const result = await service.cancelPendingTransfer(req.params.id, staffActor(req));
  return ok(res, result);
});

export const markTransferRefundProcessed = asyncHandler(async (req: Request, res) => {
  const booking = await service.markTransferRefundProcessed(req.params.id, staffActor(req));
  return ok(res, { booking });
});

export const recordPayment = asyncHandler(async (req: Request, res) => {
  const booking = await service.recordBookingPayment(
    req.params.id,
    { status: req.body.status, method: req.body.method, reference: req.body.reference },
    staffActor(req),
  );
  return ok(res, { booking });
});

export const getReports = asyncHandler(async (_req: Request, res) => {
  const reports = await service.getReports();
  return ok(res, { reports });
});

export const createRazorpayOrder = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const orderDetails = await service.createBookingRazorpayOrder(id);
  return ok(res, orderDetails);
});

export const verifyPayment = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const booking = await service.verifyBookingPayment(id, req.body);
  return ok(res, { booking });
});

export const cancelGuestBooking = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const { reason, confirmationNumber } = req.body;

  // No email is ever collected from the guest here — ownership is proven by the
  // signed-in session or by the confirmation number printed on their own ticket.
  const booking = await service.cancelGuestBooking(
    id,
    {
      email: req.auth?.email,
      role: req.auth?.role,
      confirmationNumber,
      isStaff: req.auth?.role === ROLES.SUPER_ADMIN || req.auth?.role === ROLES.KITCHEN_OWNER,
    },
    reason,
  );
  return ok(res, { booking });
});

