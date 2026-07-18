import type { Request } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok, created } from '@/utils/apiResponse';
import * as service from './roomBooking.service';

export const searchRooms = asyncHandler(async (req: Request, res) => {
  const { checkInDate, checkOutDate, floor } = req.query;
  const availableRooms = await service.searchAvailableRooms({
    checkInDate: checkInDate as string,
    checkOutDate: checkOutDate as string,
    floor: floor ? Number(floor) : undefined,
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
