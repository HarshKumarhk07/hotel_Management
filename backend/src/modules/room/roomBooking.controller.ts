import type { Request } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as service from './roomBooking.service';
import { generateInvoicePdfBuffer } from './roomInvoicePdf.service';


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
  const booking = await service.updateBookingStatus(id, status);
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
  const { id } = req.params;
  const user = (req as any).user;
  const booking = await service.checkInGuest(id, user?.name || user?.email || 'Staff');
  return ok(res, { booking });
});

export const checkOut = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  const result = await service.checkOutGuest(id, user?.name || user?.email || 'Staff');
  return ok(res, result);
});

export const upgradeRoom = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const { newRoomId } = req.body;
  const user = (req as any).user;
  const booking = await service.upgradeRoom(id, newRoomId, user?.name || user?.email || 'Staff');
  return ok(res, { booking });
});

export const transferRoom = asyncHandler(async (req: Request, res) => {
  const { id } = req.params;
  const { newRoomId } = req.body;
  const user = (req as any).user;
  const booking = await service.transferRoom(id, newRoomId, user?.name || user?.email || 'Staff');
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

