import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/apiResponse';
import { User, Order, Vehicle, TableReservation, RoomBooking, BanquetBooking } from '@/models';

export const listGuests = asyncHandler(async (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim();
  if (q.length < 2) {
    // Return registered customers by default if no query
    const customers = await User.find({ role: 'CUSTOMER' }).limit(50).lean();
    const list = customers.map(u => ({
      userId: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: (u as any).phone,
    }));
    return ok(res, { guests: list });
  }

  const regex = new RegExp(q, 'i');

  // Query in parallel
  const [users, orders, vehicles, reservations] = await Promise.all([
    User.find({ role: 'CUSTOMER', $or: [{ name: regex }, { email: regex }, { phone: regex }] }).limit(50).lean(),
    Order.find({ $or: [{ 'guestInfo.name': regex }, { 'guestInfo.email': regex }, { 'guestInfo.phone': regex }] }).limit(50).lean(),
    Vehicle.find({ $or: [{ 'guestInfo.name': regex }, { 'guestInfo.phone': regex }] }).limit(50).lean(),
    TableReservation.find({ $or: [{ guestName: regex }, { email: regex }, { phone: regex }] }).limit(50).lean(),
  ]);

  const guestMap = new Map<string, { name: string; email?: string; phone?: string; userId?: string }>();

  // Helper to add to map uniquely by normalized phone or email
  const add = (name: string, email?: string, phone?: string, userId?: string) => {
    const key = (phone || email || name).toLowerCase().trim();
    if (!guestMap.has(key)) {
      guestMap.set(key, { name, email, phone, userId });
    }
  };

  users.forEach(u => add(u.name, u.email, (u as any).phone, u._id.toString()));
  orders.forEach(o => {
    if (o.guestInfo) {
      add(o.guestInfo.name, o.guestInfo.email, o.guestInfo.phone);
    }
  });
  vehicles.forEach(v => {
    if (v.guestInfo) {
      add(v.guestInfo.name, v.guestInfo.email, v.guestInfo.phone);
    }
  });
  reservations.forEach(r => add(r.guestName, r.email, r.phone));

  return ok(res, { guests: Array.from(guestMap.values()) });
});

export const getGuestDetails = asyncHandler(async (req: Request, res: Response) => {
  const { email, phone, userId, name } = req.query as Record<string, string>;

  const orQueries: any[] = [];
  if (userId) orQueries.push({ customer: userId });
  if (email) orQueries.push({ 'guestInfo.email': email });
  if (phone) orQueries.push({ 'guestInfo.phone': phone });

  // Get food orders
  const orders = orQueries.length > 0
    ? await Order.find({ $or: orQueries }).sort({ createdAt: -1 }).lean()
    : [];

  // Get valet vehicles
  const valetQueries: any[] = [];
  if (phone) valetQueries.push({ 'guestInfo.phone': phone });
  if (name) valetQueries.push({ 'guestInfo.name': name });
  const vehicles = valetQueries.length > 0
    ? await Vehicle.find({ $or: valetQueries }).sort({ createdAt: -1 }).lean()
    : [];

  // Get reservations
  const resQueries: any[] = [];
  if (email) resQueries.push({ email });
  if (phone) resQueries.push({ phone });
  const reservations = resQueries.length > 0
    ? await TableReservation.find({ $or: resQueries }).sort({ scheduledAt: -1 }).lean()
    : [];

  // Get room bookings
  const roomQueries: any[] = [];
  if (email) roomQueries.push({ email });
  if (phone) roomQueries.push({ phone });
  const roomBookings = roomQueries.length > 0
    ? await RoomBooking.find({ $or: roomQueries }).populate('room').sort({ checkInDate: -1 }).lean()
    : [];

  // Get banquet bookings
  const banquetQueries: any[] = [];
  if (email) banquetQueries.push({ email });
  if (phone) banquetQueries.push({ phone });
  const banquetBookings = banquetQueries.length > 0
    ? await BanquetBooking.find({ $or: banquetQueries }).populate('hall').sort({ eventDate: -1 }).lean()
    : [];

  return ok(res, {
    orders,
    vehicles,
    reservations,
    roomBookings,
    banquetBookings,
  });
});
