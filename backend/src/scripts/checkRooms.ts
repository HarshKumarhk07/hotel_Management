import mongoose from 'mongoose';
import { env } from '../config/env';
import { Room, RoomBooking } from '../models';

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  const totalRooms = await Room.countDocuments();
  console.log("Total Rooms:", totalRooms);
  
  const checkIn = new Date('2026-07-22T00:00:00.000Z');
  const checkOut = new Date('2026-07-30T00:00:00.000Z');
  
  const overlappingBookings = await RoomBooking.find({
    status: { $ne: 'CANCELLED' },
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn },
  }).select('room');
  
  const bookedRoomIds = overlappingBookings.map(b => b.room);
  console.log("Booked Room IDs for these dates:", bookedRoomIds);
  
  const availableRooms = await Room.find({
    isActive: true,
    status: 'AVAILABLE',
    _id: { $nin: bookedRoomIds },
  }).select('roomNumber capacity pricePerNight status');
  
  console.log("Rooms actually available for these dates:", availableRooms);

  process.exit(0);
}

run();
