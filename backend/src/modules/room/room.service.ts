import { startSession, type FilterQuery } from 'mongoose';
import { Kitchen, Room, RoomBooking, type IRoom } from '@/models';
import { RoomCategory } from '@/models/RoomCategory';
import { generateQrToken } from '@/services/qr.service';
import { getPageParams, pageMeta } from '@/utils/pagination';
import { AppError } from '@/utils/AppError';
import type { CreateRoomInput, UpdateRoomInput } from './room.validation';

async function assertKitchenExists(kitchenId?: string | null): Promise<void> {
  if (!kitchenId) return;
  const exists = await Kitchen.exists({ _id: kitchenId });
  if (!exists) throw AppError.badRequest('Referenced kitchen does not exist', 'KITCHEN_NOT_FOUND');
}

export async function createRoom(input: CreateRoomInput) {
  await assertKitchenExists(input.kitchen);
  const dup = await Room.findOne({ roomNumber: input.roomNumber, floor: input.floor });
  if (dup) throw AppError.conflict('A room with this number already exists on this floor', 'ROOM_EXISTS');

  const category = await RoomCategory.findOne({ roomType: input.roomType || 'STANDARD' });
  const categoryData = category ? {
    roomType: category.roomType,
    capacity: category.capacity,
    amenities: category.amenities,
    pricePerNight: category.pricePerNight,
    images: category.images,
  } : {
    roomType: input.roomType || 'STANDARD',
  };

  return Room.create({
    roomNumber: input.roomNumber,
    floor: input.floor,
    kitchen: input.kitchen,
    internalNote: input.internalNote,
    ...categoryData,
    isActive: true,
    qr: { token: generateQrToken(), isActive: true, version: 1, generatedAt: new Date() },
  });
}

export async function listRooms(query: {
  page?: number;
  limit?: number;
  floor?: number;
  isActive?: boolean;
  qrActive?: boolean;
  search?: string;
}) {
  const { page, limit, skip } = getPageParams(query);
  const filter: FilterQuery<IRoom> = {};
  if (typeof query.floor === 'number') filter.floor = query.floor;
  if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;
  if (typeof query.qrActive === 'boolean') filter['qr.isActive'] = query.qrActive;
  if (query.search) filter.roomNumber = { $regex: query.search, $options: 'i' };

  const [items, total] = await Promise.all([
    Room.find(filter)
      .populate('kitchen', 'name slug isActive')
      .sort({ floor: 1, roomNumber: 1 })
      .skip(skip)
      .limit(limit),
    Room.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(total, page, limit) };
}

export async function getRoom(id: string) {
  const room = await Room.findById(id)
    .select('+internalNote')
    .populate('kitchen', 'name slug isActive');
  if (!room) throw AppError.notFound('Room not found');
  return room;
}

export async function updateRoom(id: string, input: UpdateRoomInput) {
  const room = await Room.findById(id).select('+internalNote');
  if (!room) throw AppError.notFound('Room not found');

  if (input.roomNumber !== undefined && input.roomNumber !== room.roomNumber) {
    const targetFloor = input.floor ?? room.floor;
    const dup = await Room.findOne({ roomNumber: input.roomNumber, floor: targetFloor, _id: { $ne: room._id } });
    if (dup) throw AppError.conflict('A room with this number already exists on this floor', 'ROOM_EXISTS');
    room.roomNumber = input.roomNumber;
  }
  if (input.floor !== undefined) room.floor = input.floor;
  if (input.kitchen !== undefined) {
    await assertKitchenExists(input.kitchen);
    room.kitchen = (input.kitchen ?? undefined) as never;
  }
  if (input.internalNote !== undefined) room.internalNote = input.internalNote;
  if (input.roomType !== undefined && input.roomType !== room.roomType) {
    room.roomType = input.roomType as any;
    const category = await RoomCategory.findOne({ roomType: input.roomType });
    if (category) {
      room.capacity = category.capacity;
      room.amenities = category.amenities;
      room.pricePerNight = category.pricePerNight;
      room.images = category.images;
    }
  }

  await room.save();
  return room;
}

export async function deleteRoom(id: string) {
  const room = await Room.findByIdAndDelete(id);
  if (!room) throw AppError.notFound('Room not found');
  return room;
}

export async function setRoomActive(id: string, isActive: boolean) {
  const room = await Room.findById(id);
  if (!room) throw AppError.notFound('Room not found');
  room.isActive = isActive;
  await room.save();
  return room;
}

/** (Re)generate a room's QR token — invalidates any previously printed code. */
export async function regenerateQr(id: string) {
  const room = await Room.findById(id);
  if (!room) throw AppError.notFound('Room not found');
  room.qr.token = generateQrToken();
  room.qr.version += 1;
  room.qr.isActive = true;
  room.qr.generatedAt = new Date();
  room.qr.disabledAt = undefined;
  await room.save();
  return room;
}

export async function disableQr(id: string) {
  const room = await Room.findById(id);
  if (!room) throw AppError.notFound('Room not found');
  room.qr.isActive = false;
  room.qr.disabledAt = new Date();
  await room.save();
  return room;
}

/**
 * Reassign (swap) the QR tokens of two rooms. Use when a physical sticker is in
 * the wrong room: after swapping, each printed code resolves to the correct
 * room. The swap is atomic and preserves token uniqueness. Both rooms' QR
 * versions are bumped so the change is auditable.
 */
export async function reassignQr(sourceId: string, targetId: string) {
  if (sourceId === targetId) {
    throw AppError.badRequest('Source and target rooms must differ', 'SAME_ROOM');
  }
  const session = await startSession();
  try {
    let result!: { source: IRoom; target: IRoom };
    await session.withTransaction(async () => {
      const source = await Room.findById(sourceId).session(session);
      const target = await Room.findById(targetId).session(session);
      if (!source) throw AppError.notFound('Source room not found');
      if (!target) throw AppError.notFound('Target room not found');

      const sourceToken = source.qr.token;
      const targetToken = target.qr.token;
      const now = new Date();

      // The `qr.token` unique index is enforced on every write (not just at
      // commit), so a direct swap would momentarily duplicate a token. Park the
      // source on a throwaway token first to break the collision, then assign.
      source.qr.token = generateQrToken();
      await source.save({ session });

      target.qr.token = sourceToken;
      target.qr.version += 1;
      target.qr.generatedAt = now;
      target.qr.isActive = true;
      await target.save({ session });

      source.qr.token = targetToken;
      source.qr.version += 1;
      source.qr.generatedAt = now;
      source.qr.isActive = true;
      await source.save({ session });

      result = { source, target };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Public resolution of a scanned QR token → room + kitchen for the order screen.
 * Returns 404-style nulls for unknown/disabled rooms; never leaks internal notes.
 */
export async function resolveScan(token: string) {
  const room = await Room.findOne({ 'qr.token': token }).populate(
    'kitchen',
    'name slug isActive timings settings',
  );
  if (!room) throw AppError.notFound('This QR code is not recognised', 'QR_UNKNOWN');
  if (!room.qr.isActive) throw AppError.forbidden('This QR code has been disabled', 'QR_DISABLED');
  if (!room.isActive) throw AppError.forbidden('This room is currently unavailable', 'ROOM_INACTIVE');

  // Find the active booking for this room
  const activeBooking = await RoomBooking.findOne({
    room: room._id,
    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
    checkOutDate: { $gte: new Date() },
  }).sort({ checkInDate: 1 });

  if (!activeBooking) {
    throw AppError.notFound('No active reservation found for this room.', 'NO_RESERVATION');
  }

  return {
    room: { id: room._id.toString(), roomNumber: room.roomNumber, floor: room.floor },
    kitchen: room.kitchen,
    bookingId: activeBooking._id.toString(),
  };
}
