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

/**
 * Every room must point at a category that actually exists in the Room
 * Categories table — otherwise the room shows up on the booking page under a
 * class the guest can never filter for (the "EXECUTIVE" orphan problem).
 */
async function requireCategory(roomType?: string | null) {
  const known = await RoomCategory.find().select('roomType displayName').sort({ roomType: 1 });
  if (known.length === 0) {
    throw AppError.badRequest(
      'No room categories are configured. Create a room category before adding rooms.',
      'NO_ROOM_CATEGORIES',
    );
  }
  const wanted = (roomType || '').trim();
  if (!wanted) {
    throw AppError.badRequest('A room category is required', 'ROOM_TYPE_REQUIRED');
  }
  const category = known.find((c) => c.roomType.toUpperCase() === wanted.toUpperCase());
  if (!category) {
    throw AppError.badRequest(
      `"${wanted}" is not a configured room category. Available: ${known.map((c) => c.roomType).join(', ')}`,
      'ROOM_TYPE_UNKNOWN',
    );
  }
  return RoomCategory.findById(category._id);
}

/** Fields a room inherits from its category. Never touches roomNumber/floor/status. */
function categoryFields(category: { roomType: string; capacity: number; amenities: string[]; pricePerNight: number; images: string[] }) {
  return {
    roomType: category.roomType,
    capacity: category.capacity,
    amenities: category.amenities,
    pricePerNight: category.pricePerNight,
    images: category.images,
  };
}

export async function createRoom(input: CreateRoomInput) {
  await assertKitchenExists(input.kitchen);
  const dup = await Room.findOne({ roomNumber: input.roomNumber, floor: input.floor });
  if (dup) throw AppError.conflict('A room with this number already exists on this floor', 'ROOM_EXISTS');

  const category = await requireCategory(input.roomType || 'STANDARD');

  return Room.create({
    roomNumber: input.roomNumber,
    floor: input.floor,
    kitchen: input.kitchen,
    internalNote: input.internalNote,
    ...categoryFields(category!),
    isActive: true,
    qr: { token: generateQrToken(), isActive: true, version: 1, generatedAt: new Date() },
  });
}

/**
 * Rooms whose `roomType` no longer resolves to a Room Category, grouped by the
 * orphaned type. Surfaced to admins so the inconsistency is visible, not silent.
 */
export async function auditRoomCategories() {
  const categories = await RoomCategory.find().sort({ pricePerNight: 1 });
  const known = new Set(categories.map((c) => c.roomType.toUpperCase()));

  const rooms = await Room.find().select('roomNumber floor roomType isActive status pricePerNight');
  const orphans = rooms.filter((r) => !known.has((r.roomType || '').toUpperCase()));

  const byType = new Map<string, { roomType: string; count: number; rooms: { _id: string; roomNumber: string; floor: number }[] }>();
  for (const r of orphans) {
    const key = r.roomType || 'UNSET';
    const entry = byType.get(key) ?? { roomType: key, count: 0, rooms: [] };
    entry.count += 1;
    entry.rooms.push({ _id: r._id.toString(), roomNumber: r.roomNumber, floor: r.floor });
    byType.set(key, entry);
  }

  return {
    categories: categories.map((c) => ({
      _id: c._id.toString(),
      roomType: c.roomType,
      displayName: c.displayName,
      pricePerNight: c.pricePerNight,
      roomCount: rooms.filter((r) => (r.roomType || '').toUpperCase() === c.roomType.toUpperCase()).length,
    })),
    totalRooms: rooms.length,
    orphanCount: orphans.length,
    orphanGroups: [...byType.values()].sort((a, b) => b.count - a.count),
    isConsistent: orphans.length === 0,
  };
}

/**
 * Reassign orphaned rooms onto a real category, syncing the category's pricing
 * and amenities onto each migrated room. `fromRoomType` narrows the migration to
 * a single orphaned class; omit it to migrate every orphan.
 */
export async function migrateOrphanRooms(input: { toRoomType: string; fromRoomType?: string }) {
  const target = await requireCategory(input.toRoomType);
  const categories = await RoomCategory.find().select('roomType');
  const known = new Set(categories.map((c) => c.roomType.toUpperCase()));

  const rooms = await Room.find().select('roomNumber roomType');
  const orphans = rooms.filter((r) => {
    if (known.has((r.roomType || '').toUpperCase())) return false;
    if (input.fromRoomType) {
      return (r.roomType || '').toUpperCase() === input.fromRoomType.toUpperCase();
    }
    return true;
  });

  if (orphans.length === 0) {
    return { migrated: 0, toRoomType: target!.roomType, rooms: [] as string[] };
  }

  const ids = orphans.map((r) => r._id);
  await Room.updateMany({ _id: { $in: ids } }, { $set: categoryFields(target!) });

  return {
    migrated: orphans.length,
    toRoomType: target!.roomType,
    rooms: orphans.map((r) => r.roomNumber),
  };
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
    // Reject unknown categories outright rather than silently leaving the room
    // pointing at a class that no longer exists.
    const category = await requireCategory(input.roomType);
    room.roomType = category!.roomType;
    room.capacity = category!.capacity;
    room.amenities = category!.amenities;
    room.pricePerNight = category!.pricePerNight;
    room.images = category!.images;
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
