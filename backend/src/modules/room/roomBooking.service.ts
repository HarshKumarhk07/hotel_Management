import { Room, RoomBooking, type IRoom } from '@/models';
import { AppError } from '@/utils/AppError';
import { getPageParams, pageMeta } from '@/utils/pagination';
import type { FilterQuery } from 'mongoose';

const PRICE_PER_NIGHT = 5000; // Luxury room price rate in INR

export async function searchAvailableRooms(query: {
  checkInDate: string;
  checkOutDate: string;
  floor?: number;
}) {
  const checkIn = new Date(query.checkInDate);
  const checkOut = new Date(query.checkOutDate);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    throw AppError.badRequest('Invalid check-in or check-out date format');
  }
  if (checkOut <= checkIn) {
    throw AppError.badRequest('Check-out date must be after check-in date');
  }

  // Find all booked room IDs for the selected dates
  const overlappingBookings = await RoomBooking.find({
    status: { $ne: 'CANCELLED' },
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn },
  }).select('room');

  const bookedRoomIds = overlappingBookings.map((b) => b.room);

  // Find all active rooms not in the bookedRoomIds list
  const filter: FilterQuery<IRoom> = {
    isActive: true,
    _id: { $nin: bookedRoomIds },
  };
  if (typeof query.floor === 'number') {
    filter.floor = query.floor;
  }

  const availableRooms = await Room.find(filter)
    .populate('kitchen', 'name')
    .sort({ floor: 1, roomNumber: 1 });

  return availableRooms;
}

export async function createRoomBooking(input: {
  room: string;
  guestName: string;
  phone: string;
  email: string;
  checkInDate: string;
  checkOutDate: string;
}) {
  const room = await Room.findById(input.room);
  if (!room) {
    throw AppError.notFound('Room not found');
  }
  if (!room.isActive) {
    throw AppError.badRequest('Room is currently inactive');
  }

  const checkIn = new Date(input.checkInDate);
  const checkOut = new Date(input.checkOutDate);

  if (checkOut <= checkIn) {
    throw AppError.badRequest('Check-out date must be after check-in date');
  }

  // Ensure room is not double booked
  const conflict = await RoomBooking.findOne({
    room: room._id,
    status: { $ne: 'CANCELLED' },
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn },
  });
  if (conflict) {
    throw AppError.conflict('Room is already booked during this date range', 'ROOM_BOOKED');
  }

  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  const totalPrice = nights * PRICE_PER_NIGHT;

  return RoomBooking.create({
    room: room._id,
    guestName: input.guestName,
    phone: input.phone,
    email: input.email,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    totalPrice,
    status: 'PENDING',
    paymentStatus: 'PENDING',
  });
}

export async function getGuestBookings(query: { email?: string; phone?: string }) {
  if (!query.email && !query.phone) {
    throw AppError.badRequest('Email or phone number is required to look up bookings');
  }

  const filter: FilterQuery<any> = {};
  if (query.email) filter.email = query.email.trim();
  if (query.phone) filter.phone = query.phone.trim();

  return RoomBooking.find(filter)
    .populate('room', 'roomNumber floor')
    .sort({ createdAt: -1 });
}

export async function listRoomBookings(query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  const { page, limit, skip } = getPageParams(query);
  const filter: FilterQuery<any> = {};

  if (query.status) {
    filter.status = query.status;
  }
  if (query.search) {
    filter.$or = [
      { guestName: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    RoomBooking.find(filter)
      .populate('room', 'roomNumber floor')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    RoomBooking.countDocuments(filter),
  ]);

  return { items, meta: pageMeta(total, page, limit) };
}

export async function updateBookingStatus(
  id: string,
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'
) {
  const booking = await RoomBooking.findById(id);
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  booking.status = status;
  if (status === 'CHECKED_IN') {
    booking.paymentStatus = 'PAID';
    // Auto update room status
    await Room.findByIdAndUpdate(booking.room, { status: 'OCCUPIED' });
  } else if (status === 'CHECKED_OUT') {
    // Auto update room status to CLEANING
    await Room.findByIdAndUpdate(booking.room, { status: 'CLEANING' });
  }

  await booking.save();
  return booking.populate('room', 'roomNumber floor');
}

export async function setRoomStatus(roomId: string, status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE') {
  const room = await Room.findById(roomId);
  if (!room) {
    throw AppError.notFound('Room not found');
  }
  room.status = status;
  await room.save();
  return room;
}
