import crypto from 'node:crypto';
import { startSession, type FilterQuery } from 'mongoose';
import { User, Vehicle, ParkingSlot, ValetActivity, Room, Order, type ValetStatus, type IVehicle } from '@/models';
import { uploadImage } from '@/services/cloudinary.service';
import { emailService } from '@/services/email/brevo.service';
import { recordAudit } from '@/services/audit.service';
import { hashPassword } from '@/utils/crypto';
import { AUDIT_ACTIONS, ROLES, SOCKET_EVENTS } from '@/constants';
import { getPageParams, pageMeta } from '@/utils/pagination';
import { AppError } from '@/utils/AppError';
import { getIO } from '@/realtime/socket';
import { logger } from '@/config/logger';

interface PhotoFile {
  buffer: Buffer;
  mimetype: string;
}

export async function uploadValetPhoto(file: PhotoFile, description: string): Promise<{ url: string; publicId: string }> {
  try {
    const result = await uploadImage(file.buffer, 'kds/valet');
    return { url: result.url, publicId: result.publicId };
  } catch (err) {
    logger.error({ err, description }, 'Failed to upload valet photo to Cloudinary');
    throw AppError.internal(`Failed to upload ${description} photo`, 'UPLOAD_FAILED');
  }
}

export async function checkInVehicle(
  valetManagerId: string,
  input: {
    carNumber: string;
    brand: string;
    model: string;
    color: string;
    parkingSlot: string;
    fuelLevel?: string;
    odometer?: number;
    keyTag: string;
    guestInfo: {
      name: string;
      roomNumber: string;
      phone: string;
      email: string;
    };
  },
  photos: {
    front: PhotoFile;
    rear: PhotoFile;
    left: PhotoFile;
    right: PhotoFile;
    dashboard: PhotoFile;
    damage?: PhotoFile[];
  }
) {
  // 1. Check if vehicle is already checked in and not yet delivered
  const activeVehicle = await Vehicle.findOne({
    carNumber: { $regex: new RegExp(`^${input.carNumber.replace(/\s+/g, '')}$`, 'i') },
    status: { $ne: 'DELIVERED' }
  });
  if (activeVehicle) {
    throw AppError.conflict('Vehicle with this car number is already parked/requested in the system', 'VEHICLE_ALREADY_EXISTS');
  }

  // 2. Validate and reserve slot
  const slot = await ParkingSlot.findOne({ slotNumber: input.parkingSlot });
  if (!slot) {
    throw AppError.notFound('Parking slot does not exist', 'SLOT_NOT_FOUND');
  }
  if (slot.isOccupied) {
    throw AppError.conflict('Parking slot is already occupied', 'SLOT_OCCUPIED');
  }

  // 3. Upload images
  const uploadedPhotos: any = {};
  uploadedPhotos.front = await uploadValetPhoto(photos.front, 'Front');
  uploadedPhotos.rear = await uploadValetPhoto(photos.rear, 'Rear');
  uploadedPhotos.left = await uploadValetPhoto(photos.left, 'Left');
  uploadedPhotos.right = await uploadValetPhoto(photos.right, 'Right');
  uploadedPhotos.dashboard = await uploadValetPhoto(photos.dashboard, 'Dashboard');

  if (photos.damage && photos.damage.length > 0) {
    uploadedPhotos.damage = [];
    for (let i = 0; i < photos.damage.length; i++) {
      const p = await uploadValetPhoto(photos.damage[i], `Damage #${i + 1}`);
      uploadedPhotos.damage.push(p);
    }
  }

  const session = await startSession();
  try {
    let savedVehicle!: any;
    await session.withTransaction(async () => {
      // 4. Update slot state
      slot.isOccupied = true;
      await slot.save({ session });

      // 5. Create vehicle file
      const secureToken = crypto.randomBytes(24).toString('hex');
      savedVehicle = new Vehicle({
        secureToken,
        carNumber: input.carNumber,
        brand: input.brand,
        model: input.model,
        color: input.color,
        parkingSlot: input.parkingSlot,
        fuelLevel: input.fuelLevel,
        odometer: input.odometer,
        keyTag: input.keyTag,
        status: 'PARKED',
        guestInfo: input.guestInfo,
        photos: uploadedPhotos,
        statusHistory: [
          {
            status: 'PARKED',
            at: new Date(),
            by: valetManagerId as any,
            notes: 'Initial check-in'
          }
        ]
      });

      await savedVehicle.save({ session });

      // 6. Create activity audit record
      await ValetActivity.create(
        [
          {
            valetManager: valetManagerId,
            vehicle: savedVehicle._id,
            action: 'CHECKIN',
            details: `Checked in vehicle ${input.carNumber} to slot ${input.parkingSlot}`
          }
        ],
        { session }
      );
    });

    // Send check-in email (best effort, async)
    void emailService.sendValetCheckIn(
      savedVehicle.guestInfo.email,
      savedVehicle.guestInfo.name,
      savedVehicle.carNumber,
      savedVehicle.parkingSlot,
      savedVehicle.checkedInAt.toISOString(),
      savedVehicle.secureToken
    );

    // Record audit log entry
    void recordAudit({
      action: AUDIT_ACTIONS.VALET_VEHICLE_CHECKIN,
      actor: valetManagerId,
      role: ROLES.VALET_MANAGER,
      metadata: { carNumber: savedVehicle.carNumber, slot: savedVehicle.parkingSlot }
    });

    // Notify sockets
    try {
      getIO().to('valets').emit(SOCKET_EVENTS.VALET_NEW, savedVehicle);
      getIO().to('admins').emit(SOCKET_EVENTS.VALET_NEW, savedVehicle);
    } catch {
      /* Socket server might not be initialized in tests */
    }

    return savedVehicle;
  } finally {
    await session.endSession();
  }
}

export async function updateValetStatus(
  userId: string,
  userRole: string,
  vehicleId: string,
  newStatus: ValetStatus,
  notes?: string
) {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) {
    throw AppError.notFound('Vehicle file not found', 'VEHICLE_NOT_FOUND');
  }

  // Validate state machine transitions
  const transitions: Record<ValetStatus, ValetStatus[]> = {
    PARKED: ['REQUESTED', 'BRINGING'],
    REQUESTED: ['BRINGING', 'READY'],
    BRINGING: ['READY'],
    READY: ['DELIVERED'],
    DELIVERED: []
  };

  if (!transitions[vehicle.status].includes(newStatus) && vehicle.status !== newStatus) {
    throw AppError.badRequest(
      `Cannot transition vehicle status from ${vehicle.status} to ${newStatus}`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const session = await startSession();
  try {
    await session.withTransaction(async () => {
      vehicle.status = newStatus;
      vehicle.statusHistory.push({
        status: newStatus,
        at: new Date(),
        by: userId as any,
        notes
      });

      if (newStatus === 'REQUESTED') {
        vehicle.requestedAt = new Date();
      } else if (newStatus === 'DELIVERED') {
        vehicle.deliveredAt = new Date();
        // Free the parking slot
        const slot = await ParkingSlot.findOne({ slotNumber: vehicle.parkingSlot });
        if (slot) {
          slot.isOccupied = false;
          await slot.save({ session });
        }
      }

      await vehicle.save({ session });

      // Create activity record
      await ValetActivity.create(
        [
          {
            valetManager: userId,
            vehicle: vehicle._id,
            action: `STATUS_${newStatus}`,
            details: `Updated status of vehicle ${vehicle.carNumber} to ${newStatus}. Notes: ${notes ?? 'none'}`
          }
        ],
        { session }
      );
    });

    // Map audits
    const auditMap: Record<ValetStatus, string> = {
      PARKED: AUDIT_ACTIONS.VALET_VEHICLE_CHECKIN,
      REQUESTED: AUDIT_ACTIONS.VALET_VEHICLE_REQUESTED,
      BRINGING: AUDIT_ACTIONS.VALET_VEHICLE_BRINGING,
      READY: AUDIT_ACTIONS.VALET_VEHICLE_READY,
      DELIVERED: AUDIT_ACTIONS.VALET_VEHICLE_DELIVERED
    };

    void recordAudit({
      action: auditMap[newStatus] as any,
      actor: userId,
      role: userRole as any,
      metadata: { carNumber: vehicle.carNumber, status: newStatus }
    });

    // Trigger emails
    if (newStatus === 'READY') {
      void emailService.sendValetReady(vehicle.guestInfo.email, vehicle.guestInfo.name, vehicle.carNumber);
    } else if (newStatus === 'DELIVERED') {
      void emailService.sendValetDelivered(vehicle.guestInfo.email, vehicle.guestInfo.name, vehicle.carNumber);
    }

    // Notify sockets
    try {
      getIO().emit(SOCKET_EVENTS.VALET_UPDATED, vehicle);
    } catch {
      /* ignore */
    }

    return vehicle;
  } finally {
    await session.endSession();
  }
}

export async function requestVehicleByGuest(carNumber: string, notes?: string) {
  // Normalize plate query
  const queryNum = carNumber.replace(/\s+/g, '');
  const vehicle = await Vehicle.findOne({
    carNumber: { $regex: new RegExp(`^${queryNum}$`, 'i') },
    status: 'PARKED'
  });

  if (!vehicle) {
    // Check if it is already requested or bringing
    const inProgress = await Vehicle.findOne({
      carNumber: { $regex: new RegExp(`^${queryNum}$`, 'i') },
      status: { $in: ['REQUESTED', 'BRINGING', 'READY'] }
    });
    if (inProgress) {
      throw AppError.badRequest('Vehicle request is already in progress', 'REQUEST_ALREADY_IN_PROGRESS');
    }
    throw AppError.notFound('No parked vehicle found with this plate number', 'PARKED_VEHICLE_NOT_FOUND');
  }

  vehicle.status = 'REQUESTED';
  vehicle.requestedAt = new Date();
  vehicle.statusHistory.push({
    status: 'REQUESTED',
    at: new Date(),
    notes: notes ?? 'Requested by guest via tracking portal'
  });

  await vehicle.save();

  // Audit log as anonymous guest action
  void recordAudit({
    action: AUDIT_ACTIONS.VALET_VEHICLE_REQUESTED,
    actorEmail: vehicle.guestInfo.email,
    metadata: { carNumber: vehicle.carNumber, source: 'guest_tracking' }
  });

  // Notify socket
  try {
    getIO().emit(SOCKET_EVENTS.VALET_UPDATED, vehicle);
  } catch {
    /* ignore */
  }

  return vehicle;
}

export async function resolveRoomGuest(token: string) {
  const room = await Room.findOne({ 'qr.token': token });
  if (!room) {
    throw AppError.notFound('Room QR token is not recognized', 'QR_UNKNOWN');
  }
  if (!room.qr.isActive) {
    throw AppError.forbidden('Room QR is disabled', 'QR_DISABLED');
  }
  if (!room.isActive) {
    throw AppError.forbidden('Room is inactive', 'ROOM_INACTIVE');
  }

  // Find the last dining order associated with this room to extract guest info
  const lastOrder = await Order.findOne({ room: room._id })
    .sort({ createdAt: -1 })
    .populate('customer', 'name email phone');

  const guestDetails = {
    name: '',
    roomNumber: room.roomNumber,
    phone: '',
    email: '',
    foundFromOrder: false
  };

  if (lastOrder) {
    if (lastOrder.customer) {
      const cust = lastOrder.customer as any;
      guestDetails.name = cust.name;
      guestDetails.phone = cust.phone ?? '';
      guestDetails.email = cust.email;
      guestDetails.foundFromOrder = true;
    } else if (lastOrder.guestInfo) {
      guestDetails.name = lastOrder.guestInfo.name;
      guestDetails.phone = lastOrder.guestInfo.phone;
      guestDetails.email = lastOrder.guestInfo.email;
      guestDetails.foundFromOrder = true;
    }
  }

  return guestDetails;
}

export async function listVehicles(query: {
  page?: number;
  limit?: number;
  status?: ValetStatus;
  search?: string;
  activeOnly?: boolean;
}) {
  const { page, limit, skip } = getPageParams(query);
  const filter: FilterQuery<IVehicle> = {};

  if (query.status) {
    filter.status = query.status;
  } else if (query.activeOnly) {
    filter.status = { $in: ['PARKED', 'REQUESTED', 'BRINGING', 'READY'] };
  }

  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    filter.$or = [
      { carNumber: searchRegex },
      { 'guestInfo.name': searchRegex },
      { 'guestInfo.roomNumber': searchRegex }
    ];
  }

  const [items, total] = await Promise.all([
    Vehicle.find(filter)
      .sort({ checkedInAt: -1 })
      .skip(skip)
      .limit(limit),
    Vehicle.countDocuments(filter)
  ]);

  return { items, meta: pageMeta(total, page, limit) };
}

function maskName(name: string): string {
  if (!name) return '';
  const parts = name.split(/\s+/);
  return parts
    .map((p) => {
      if (p.length <= 2) return p;
      return p[0] + '*'.repeat(p.length - 2) + p[p.length - 1];
    })
    .join(' ');
}

function maskEmail(email: string): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  return '*'.repeat(clean.length - 4) + clean.slice(-4);
}

function maskRoom(room: string): string {
  if (!room) return '';
  const clean = room.trim();
  if (clean.length <= 1) return '*';
  return clean[0] + '*'.repeat(clean.length - 1);
}

export async function getVehicleDetails(carNumber: string) {
  const queryNum = carNumber.replace(/\s+/g, '');
  const vehicle = await Vehicle.findOne({
    carNumber: { $regex: new RegExp(`^${queryNum}$`, 'i') },
    status: { $ne: 'DELIVERED' }
  });
  if (!vehicle) {
    throw AppError.notFound('No active valet file found with this plate number', 'VEHICLE_NOT_FOUND');
  }

  // Return masked representation to prevent public PII leakage
  const plain = vehicle.toObject();
  if (plain.guestInfo) {
    plain.guestInfo.name = maskName(plain.guestInfo.name);
    plain.guestInfo.email = maskEmail(plain.guestInfo.email);
    plain.guestInfo.phone = maskPhone(plain.guestInfo.phone);
    plain.guestInfo.roomNumber = maskRoom(plain.guestInfo.roomNumber);
  }
  return plain;
}

export async function getValetOverview() {
  const activeCount = await Vehicle.countDocuments({ status: { $ne: 'DELIVERED' } });
  const parkedCount = await Vehicle.countDocuments({ status: 'PARKED' });
  const requestedCount = await Vehicle.countDocuments({ status: 'REQUESTED' });
  const bringingCount = await Vehicle.countDocuments({ status: 'BRINGING' });
  const readyCount = await Vehicle.countDocuments({ status: 'READY' });
  
  const totalSlots = await ParkingSlot.countDocuments();
  const occupiedSlots = await ParkingSlot.countDocuments({ isOccupied: true });

  return {
    activeCount,
    parkedCount,
    requestedCount,
    bringingCount,
    readyCount,
    slots: {
      total: totalSlots,
      occupied: occupiedSlots,
      free: totalSlots - occupiedSlots
    }
  };
}

export async function listParkingSlots() {
  return ParkingSlot.find().sort({ slotNumber: 1 });
}

export async function getVehicleDetailsByToken(token: string) {
  const vehicle = await Vehicle.findOne({ secureToken: token });
  if (!vehicle) {
    throw AppError.notFound('No active valet session found for this token', 'VEHICLE_NOT_FOUND');
  }
  if (vehicle.status === 'DELIVERED') {
    throw AppError.notFound('Valet session has completed and is no longer active', 'SESSION_COMPLETED');
  }
  return vehicle;
}

export async function requestVehicleByToken(token: string, notes?: string) {
  const vehicle = await Vehicle.findOne({ secureToken: token });
  if (!vehicle) {
    throw AppError.notFound('No active valet session found for this token', 'VEHICLE_NOT_FOUND');
  }
  if (vehicle.status === 'DELIVERED') {
    throw AppError.badRequest('Valet session has already completed', 'SESSION_COMPLETED');
  }
  return requestVehicleByGuest(vehicle.carNumber, notes);
}

export async function listValetManagers(query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'online' | 'offline';
  activeState?: 'active' | 'disabled';
}) {
  const { page, limit, skip } = getPageParams(query);
  const filter: FilterQuery<any> = { role: ROLES.VALET_MANAGER };

  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    filter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { employeeId: searchRegex }
    ];
  }

  if (query.status) {
    filter.isOnline = query.status === 'online';
  }

  if (query.activeState) {
    filter.isActive = query.activeState === 'active';
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const items = await Promise.all(
    users.map(async (user) => {
      const [activeVehicles, vehiclesDeliveredToday] = await Promise.all([
        Vehicle.countDocuments({ status: { $ne: 'DELIVERED' }, 'statusHistory.by': user._id }),
        Vehicle.countDocuments({ status: 'DELIVERED', deliveredAt: { $gte: startOfToday }, 'statusHistory.by': user._id })
      ]);
      const plain = user.toObject();
      return {
        ...plain,
        activeVehicles,
        vehiclesDeliveredToday
      };
    })
  );

  return { items, meta: pageMeta(total, page, limit) };
}

export async function createValetManager(
  input: { name: string; email: string; phone: string; employeeId?: string },
  adminId: string
) {
  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const user = new User({
    name: input.name,
    email,
    phone: input.phone,
    employeeId: input.employeeId || undefined,
    role: ROLES.VALET_MANAGER,
    isEmailVerified: true,
    isActive: true
  });
  user.passwordHash = await hashPassword('Valet123!');
  await user.save();

  void recordAudit({
    action: AUDIT_ACTIONS.REGISTER,
    actor: adminId,
    actorEmail: email,
    role: ROLES.SUPER_ADMIN,
    metadata: { email, name: user.name, role: user.role }
  });

  void emailService.sendValetWelcome(user.email, user.name, 'Valet123!');

  return user;
}

export async function updateValetManager(
  id: string,
  input: { name?: string; email?: string; phone?: string; employeeId?: string; isActive?: boolean },
  adminId: string
) {
  const user = await User.findById(id);
  if (!user || user.role !== ROLES.VALET_MANAGER) {
    throw AppError.notFound('Valet manager not found', 'VALET_NOT_FOUND');
  }

  if (input.email) {
    const email = input.email.toLowerCase().trim();
    if (email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
      }
      user.email = email;
    }
  }

  if (input.name) user.name = input.name;
  if (input.phone) user.phone = input.phone;
  if (input.employeeId !== undefined) user.employeeId = input.employeeId || undefined;
  if (input.isActive !== undefined) user.isActive = input.isActive;

  await user.save();

  void recordAudit({
    action: AUDIT_ACTIONS.KITCHEN_UPDATED,
    actor: adminId,
    actorEmail: user.email,
    role: ROLES.SUPER_ADMIN,
    metadata: { email: user.email, name: user.name, isActive: user.isActive }
  });

  return user;
}

export async function resetValetPassword(id: string, adminId: string) {
  const user = await User.findById(id);
  if (!user || user.role !== ROLES.VALET_MANAGER) {
    throw AppError.notFound('Valet manager not found', 'VALET_NOT_FOUND');
  }

  user.passwordHash = await hashPassword('Valet123!');
  await user.save();

  void recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_RESET,
    actor: adminId,
    actorEmail: user.email,
    role: ROLES.SUPER_ADMIN,
    metadata: { email: user.email }
  });

  return user;
}

export async function getValetAdminStats() {
  const [
    totalValetManagers,
    onlineValetManagers,
    activeVehicles,
    requestedVehicles,
    bringingVehicles,
    gateVehicles,
    totalSlots,
    occupiedSlots
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.VALET_MANAGER }),
    User.countDocuments({ role: ROLES.VALET_MANAGER, isOnline: true }),
    Vehicle.countDocuments({ status: { $ne: 'DELIVERED' } }),
    Vehicle.countDocuments({ status: 'REQUESTED' }),
    Vehicle.countDocuments({ status: 'BRINGING' }),
    Vehicle.countDocuments({ status: 'READY' }),
    ParkingSlot.countDocuments(),
    ParkingSlot.countDocuments({ isOccupied: true })
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const deliveredToday = await Vehicle.countDocuments({
    status: 'DELIVERED',
    deliveredAt: { $gte: startOfToday }
  });

  return {
    totalValetManagers,
    onlineValetManagers,
    activeVehicles,
    requestedVehicles,
    bringingVehicles,
    gateVehicles,
    deliveredToday,
    totalSlots,
    occupiedSlots,
    freeSlots: totalSlots - occupiedSlots
  };
}

export async function getRecentValetActivity() {
  return ValetActivity.find()
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('valetManager', 'name email employeeId')
    .populate('vehicle', 'carNumber brand model parkingSlot status');
}
