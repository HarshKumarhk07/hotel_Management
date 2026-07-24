import crypto from 'node:crypto';
import {
  Room,
  RoomBooking,
  RoomCategory,
  BookingInvoice,
  Order,
  Vehicle,
  BanquetBooking,
  type IRoom,
  type IRoomTransfer,
  type TransferKind,
} from '@/models';
import { buildScanUrl } from '@/services/qr.service';
import { emitToAdmins } from '@/realtime/emit';
import { AppError } from '@/utils/AppError';
import { getPageParams, pageMeta } from '@/utils/pagination';
import type { FilterQuery } from 'mongoose';
import { validateCoupon, reserveCoupon } from '@/modules/coupon/coupon.service';
import { emailService } from '@/services/email/brevo.service';
import { logger } from '@/config/logger';
import { env } from '@/config/env';
import { recordAudit } from '@/services/audit.service';
import { AUDIT_ACTIONS } from '@/constants';

export async function searchAvailableRooms(query: {
  checkInDate: string;
  checkOutDate: string;
  floor?: number;
  roomType?: string;
  minPrice?: number;
  maxPrice?: number;
  guestCount?: number;
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

  // Find all active rooms not in the bookedRoomIds list and with AVAILABLE status
  const filter: FilterQuery<IRoom> = {
    isActive: true,
    status: 'AVAILABLE',
    _id: { $nin: bookedRoomIds },
  };
  if (typeof query.floor === 'number') {
    filter.floor = query.floor;
  }

  // The booking page must only ever surface rooms whose class still exists in
  // the Room Categories table, so its filter options and its results agree.
  const categories = await RoomCategory.find().select('roomType');
  const knownTypes = categories.map((c) => c.roomType);
  if (query.roomType) {
    const match = knownTypes.find((t) => t.toUpperCase() === query.roomType!.toUpperCase());
    if (!match) {
      throw AppError.badRequest('Unknown room category', 'ROOM_TYPE_UNKNOWN');
    }
    filter.roomType = match;
  } else if (knownTypes.length > 0) {
    filter.roomType = { $in: knownTypes };
  }
  if (typeof query.minPrice === 'number' || typeof query.maxPrice === 'number') {
    filter.pricePerNight = {};
    if (typeof query.minPrice === 'number') filter.pricePerNight.$gte = query.minPrice;
    if (typeof query.maxPrice === 'number') filter.pricePerNight.$lte = query.maxPrice;
  }
  if (typeof query.guestCount === 'number') {
    filter.capacity = { $gte: query.guestCount };
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
  address?: string;
  city?: string;
  country?: string;
  governmentId?: string;
  idProofUrl?: string;
  idProofType?: string;
  specialRequests?: {
    lateCheckIn?: boolean;
    extraBed?: boolean;
    airportPickup?: boolean;
    note?: string;
  };
  couponCode?: string;
  userId?: string;
  paymentMethod?: 'RAZORPAY' | 'CASH';
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
  // We consider CONFIRMED/CHECKED_IN as hard conflicts.
  // PENDING bookings are only considered conflicts if they were created in the last 15 minutes (to allow time for payment checkout).
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  const conflict = await RoomBooking.findOne({
    room: room._id,
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn },
    $or: [
      { status: { $in: ['CONFIRMED', 'CHECKED_IN'] } },
      { status: 'PENDING', createdAt: { $gt: fifteenMinsAgo } }
    ]
  });
  if (conflict) {
    throw AppError.conflict('Room is already booked during this date range', 'ROOM_BOOKED');
  }

  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
  const roomCharges = nights * room.pricePerNight;

  // Special requests charges
  const extraBedCharges = input.specialRequests?.extraBed ? 1000 * nights : 0;
  const additionalCharges = input.specialRequests?.airportPickup ? 1500 : 0;

  const subtotalBeforeTax = roomCharges + extraBedCharges + additionalCharges;

  // Calculate GST and Service Charge
  const gst = Math.round(subtotalBeforeTax * 0.18); // 18% GST
  const serviceCharge = Math.round(subtotalBeforeTax * 0.05); // 5% Service Charge

  let discountAmount = 0;

  if (input.couponCode) {
    try {
      const { coupon, discount } = await validateCoupon(input.couponCode, {
        userId: input.userId,
        kitchenId: room.kitchen?.toString() || '',
        subtotal: subtotalBeforeTax,
      });
      discountAmount = discount;
      await reserveCoupon(coupon._id.toString());
    } catch (err: any) {
      throw AppError.badRequest(err.message || 'Invalid coupon code', 'COUPON_INVALID');
    }
  }

  const grandTotal = Math.max(0, subtotalBeforeTax + gst + serviceCharge - discountAmount);
  const confirmationNumber = `CONF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const paymentMethod = input.paymentMethod || 'RAZORPAY';
  const isPayAtHotel = paymentMethod === 'CASH';
  const bookingStatus = isPayAtHotel ? 'CONFIRMED' : 'PENDING';

  const booking = await RoomBooking.create({
    room: room._id,
    guestName: input.guestName,
    phone: input.phone,
    email: input.email,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    totalPrice: grandTotal,
    status: bookingStatus,
    paymentStatus: 'PENDING',
    address: input.address,
    city: input.city,
    country: input.country,
    governmentId: input.governmentId,
    idProofUrl: input.idProofUrl,
    idProofType: input.idProofType,
    specialRequests: {
      lateCheckIn: !!input.specialRequests?.lateCheckIn,
      extraBed: !!input.specialRequests?.extraBed,
      airportPickup: !!input.specialRequests?.airportPickup,
      note: input.specialRequests?.note,
    },
    priceBreakdown: {
      roomPrice: room.pricePerNight,
      nights,
      gst,
      serviceCharge,
      extraBedCharges,
      additionalCharges,
      couponCode: input.couponCode,
      discountAmount,
      grandTotal,
    },
    payment: {
      method: paymentMethod,
      status: 'PENDING',
    },
    confirmationNumber,
    timeline: [
      {
        status: bookingStatus,
        timestamp: new Date(),
        note: isPayAtHotel
          ? 'Room reservation request confirmed. Payment to be settled at hotel.'
          : 'Room reservation request created. Awaiting payment.',
      },
    ],
  });

  void recordAudit({
    action: AUDIT_ACTIONS.ROOM_BOOKING_CREATED,
    actor: input.userId,
    metadata: { bookingId: booking._id, room: room._id, confirmationNumber }
  });

  // Always send a booking notification email immediately upon creation
  try {
    const populated = await booking.populate('room');
    const roomNum = (populated.room as any)?.roomNumber || 'N/A';

    if (isPayAtHotel) {
      // Pay at Hotel: send pending email indicating payment on arrival
      await emailService.sendRoomBookingPending(
        booking.email,
        booking.guestName,
        roomNum,
        booking.checkInDate.toISOString(),
        booking.checkOutDate.toISOString(),
        booking.confirmationNumber || 'N/A',
        booking.totalPrice,
        true
      );
    } else {
      // Online Razorpay: pending email — let guest know booking is held, pay when arrive if needed
      await emailService.sendRoomBookingPending(
        booking.email,
        booking.guestName,
        roomNum,
        booking.checkInDate.toISOString(),
        booking.checkOutDate.toISOString(),
        booking.confirmationNumber || 'N/A',
        booking.totalPrice,
        false
      );
    }
  } catch (err) {
    logger.error({ err }, 'Failed to dispatch booking notification email');
  }

  return booking;
}

export async function getGuestBookings(query: { email?: string; phone?: string }) {
  if (!query.email && !query.phone) {
    throw AppError.badRequest('Email or phone number is required to look up bookings');
  }

  const filter: FilterQuery<any> = {};
  if (query.email) {
    // Stored emails are not normalised, so match case-insensitively.
    filter.email = {
      $regex: `^${query.email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      $options: 'i',
    };
  }
  if (query.phone) filter.phone = query.phone.trim();

  return RoomBooking.find(filter)
    .populate('room')
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
      { confirmationNumber: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    RoomBooking.find(filter)
      .populate('room')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    RoomBooking.countDocuments(filter),
  ]);

  return { items, meta: pageMeta(total, page, limit) };
}

export async function updateBookingStatus(
  id: string,
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED',
  updatedBy?: string
) {
  const booking = await RoomBooking.findById(id);
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  booking.status = status;
  booking.timeline.push({
    status,
    timestamp: new Date(),
    note: `Booking status updated to ${status}.`,
    updatedBy,
  });

  // paymentStatus is never inferred from booking status — neither CONFIRMED nor
  // CHECKED_IN implies money was collected. It moves to PAID only via the
  // Razorpay webhook/verification or an explicit admin payment entry.
  if (status === 'CHECKED_IN') {
    await Room.findByIdAndUpdate(booking.room, { status: 'OCCUPIED' });
  } else if (status === 'CHECKED_OUT') {
    await booking.save();
    const checkoutResult = await checkOutGuest(id, updatedBy);
    return checkoutResult.booking;
  }

  await booking.save();

  void recordAudit({
    action: AUDIT_ACTIONS.ROOM_BOOKING_UPDATED,
    actor: updatedBy,
    metadata: { bookingId: booking._id, status }
  });

  const populated = await booking.populate('room');

  if (status === 'CONFIRMED') {
    try {
      const roomNum = (populated.room as any)?.roomNumber || 'N/A';
      if (booking.paymentStatus === 'PAID') {
        await emailService.sendRoomBookingConfirmation(
          booking.email,
          booking.guestName,
          roomNum,
          booking.checkInDate.toISOString(),
          booking.checkOutDate.toISOString(),
          booking.confirmationNumber || 'N/A',
          booking.totalPrice
        );
      } else {
        await emailService.sendRoomBookingPending(
          booking.email,
          booking.guestName,
          roomNum,
          booking.checkInDate.toISOString(),
          booking.checkOutDate.toISOString(),
          booking.confirmationNumber || 'N/A',
          booking.totalPrice,
          booking.payment?.method === 'CASH'
        );
      }
    } catch (err) {
      logger.error({ err }, 'Failed to dispatch room stay confirmation email');
    }
  }

  return populated;
}

/**
 * Explicit admin record of a settlement (typically a "Pay at Hotel" booking
 * collected at the front desk). This is the only path — besides the Razorpay
 * verification — that can flip a booking to PAID, which is what keeps unpaid
 * reservations out of the revenue figures.
 */
export async function recordBookingPayment(
  bookingId: string,
  input: { status: 'PAID' | 'PENDING'; method?: string; reference?: string },
  updatedBy?: string
) {
  const booking = await RoomBooking.findById(bookingId).populate('room');
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }
  if (booking.status === 'CANCELLED') {
    throw AppError.badRequest('Cannot record payment against a cancelled booking');
  }
  if (booking.paymentStatus === input.status) {
    throw AppError.conflict(`Payment is already marked ${input.status}`, 'PAYMENT_STATUS_UNCHANGED');
  }

  const method = input.method || booking.payment?.method || 'CASH';
  booking.paymentStatus = input.status;
  booking.payment.status = input.status;
  booking.payment.method = method;
  booking.payment.paidAt = input.status === 'PAID' ? new Date() : undefined;

  booking.timeline.push({
    status: booking.status,
    timestamp: new Date(),
    note:
      input.status === 'PAID'
        ? `Payment of ₹${booking.totalPrice} received via ${method}${input.reference ? ` (ref: ${input.reference})` : ''}.`
        : 'Payment marked as pending by the front desk.',
    updatedBy,
  });

  await booking.save();

  void recordAudit({
    action: AUDIT_ACTIONS.ROOM_BOOKING_PAYMENT_RECORDED,
    actor: updatedBy,
    metadata: { bookingId: booking._id, status: input.status, method, amount: booking.totalPrice },
  });

  if (input.status === 'PAID') {
    try {
      const roomNum = (booking.room as any)?.roomNumber || 'N/A';
      await emailService.sendRoomBookingConfirmation(
        booking.email,
        booking.guestName,
        roomNum,
        booking.checkInDate.toISOString(),
        booking.checkOutDate.toISOString(),
        booking.confirmationNumber || 'N/A',
        booking.totalPrice
      );
    } catch (err) {
      logger.error({ err }, 'Failed to dispatch payment-received confirmation email');
    }
  }

  return booking;
}

export async function setRoomStatus(roomId: string, status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'BLOCKED' | 'OUT_OF_SERVICE' | 'VIP_RESERVED') {
  const room = await Room.findById(roomId);
  if (!room) {
    throw AppError.notFound('Room not found');
  }
  room.status = status;
  await room.save();
  return room;
}

export async function getBookingDetail(bookingId: string) {
  const booking = await RoomBooking.findById(bookingId).populate('room');
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }
  return booking;
}

export async function getBookingInvoiceData(bookingId: string) {
  const booking = await RoomBooking.findById(bookingId).populate('room');
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  // Calculate stay duration
  const start = new Date(booking.checkInDate);
  const end = booking.checkOutDate ? new Date(booking.checkOutDate) : new Date();
  const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  let stayCost = booking.totalPrice;
  let stayBasePrice = booking.totalPrice / 1.18;
  let stayGst = booking.totalPrice - stayBasePrice;

  if (booking.priceBreakdown && booking.priceBreakdown.roomPrice) {
    stayBasePrice = booking.priceBreakdown.roomPrice * nights;
    stayGst = booking.priceBreakdown.gst;
    stayCost = booking.totalPrice;
  }

  // Query food orders delivered to this room during the stay period
  const orders = await Order.find({
    room: booking.room?._id,
    status: 'DELIVERED',
    createdAt: { $gte: start, $lte: end },
  }).sort({ createdAt: 1 });

  // Compute food charges totals
  let foodSubtotal = 0;
  let foodTax = 0;
  let foodServiceCharge = 0;
  let foodTotal = 0;
  let foodChargedToRoom = 0; // unpaid orders under ROOM_BILLING
  let foodPaidPreArrival = 0; // orders paid online or COD

  const itemizedOrders = orders.map((o) => {
    const isChargedToRoom = o.payment.method === 'ROOM_BILLING';

    foodSubtotal += o.pricing.subtotal;
    foodTax += o.pricing.taxTotal;
    foodServiceCharge += o.pricing.serviceCharge;
    foodTotal += o.pricing.total;

    if (isChargedToRoom) {
      foodChargedToRoom += o.pricing.total;
    } else {
      foodPaidPreArrival += o.pricing.total;
    }

    return {
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      subtotal: o.pricing.subtotal,
      tax: o.pricing.taxTotal,
      serviceCharge: o.pricing.serviceCharge,
      total: o.pricing.total,
      paymentMethod: o.payment.method,
      paymentStatus: o.payment.status,
    };
  });

  // Query valet activities for this guest phone/email
  const vehicles = await Vehicle.find({
    'guestInfo.phone': booking.phone,
    checkedInAt: { $gte: start, $lte: end },
  }).sort({ checkedInAt: 1 });

  const valetItems = vehicles.map((v) => ({
    carNumber: v.carNumber,
    brand: v.brand,
    model: v.model,
    checkedInAt: v.checkedInAt,
    deliveredAt: v.deliveredAt,
    status: v.status,
  }));

  // Query banquet bookings matching same email or phone
  const banquetBookings = await BanquetBooking.find({
    $or: [{ email: booking.email }, { phone: booking.phone }],
    eventDate: { $gte: start, $lte: end },
  }).populate('hall');

  let banquetTotal = 0;
  let banquetPaid = 0;
  let banquetDue = 0;

  const itemizedBanquets = banquetBookings.map((b) => {
    banquetTotal += b.totalPrice;
    if (b.paymentStatus === 'PAID') {
      banquetPaid += b.totalPrice;
    } else {
      banquetDue += b.totalPrice;
    }

    return {
      hallName: (b.hall as any)?.name || 'Banquet Hall',
      eventDate: b.eventDate,
      totalPrice: b.totalPrice,
      paymentStatus: b.paymentStatus,
    };
  });

  // Invoice calculations
  const isRoomPaid = booking.paymentStatus === 'PAID';

  const subtotal = stayBasePrice + foodSubtotal + (banquetTotal / 1.18);
  const taxTotal = stayGst + foodTax + (banquetTotal - (banquetTotal / 1.18));
  const serviceChargeTotal = foodServiceCharge;
  const grandTotal = stayCost + foodTotal + banquetTotal;

  const alreadyPaidTotal = (isRoomPaid ? stayCost : 0) + foodPaidPreArrival + banquetPaid;
  const balanceDue = (isRoomPaid ? 0 : stayCost) + foodChargedToRoom + banquetDue;

  return {
    booking,
    nights,
    stayCost,
    stayBasePrice,
    stayGst,
    orders: itemizedOrders,
    valet: valetItems,
    banquets: itemizedBanquets,
    pricing: {
      subtotal,
      taxTotal,
      serviceChargeTotal,
      grandTotal,
      alreadyPaidTotal,
      balanceDue,
    },
  };
}

export async function checkInGuest(bookingId: string, updatedBy?: string) {
  const booking = await RoomBooking.findById(bookingId);
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }
  if (booking.status === 'CANCELLED') {
    throw AppError.badRequest('Cannot check-in a cancelled booking');
  }
  if (booking.status === 'CHECKED_IN') {
    return booking;
  }

  booking.status = 'CHECKED_IN';
  booking.timeline.push({
    status: 'CHECKED_IN',
    timestamp: new Date(),
    note:
      booking.paymentStatus === 'PAID'
        ? 'Guest checked in successfully.'
        : 'Guest checked in successfully. Payment still pending — settle at the front desk.',
    updatedBy,
  });

  await Room.findByIdAndUpdate(booking.room, { status: 'OCCUPIED' });
  await booking.save();
  return booking.populate('room');
}

export async function checkOutGuest(bookingId: string, updatedBy?: string) {
  const invoiceData = await getBookingInvoiceData(bookingId);
  const { booking, stayCost, pricing, orders } = invoiceData;

  if (booking.status === 'CHECKED_OUT') {
    return { booking: await booking.populate('room') };
  }

  const invoiceNumber = `INV-RM-${booking._id.toString().substring(18).toUpperCase()}`;
  const foodCharges = orders.reduce((sum: number, o: any) => sum + o.total, 0);

  const invoice = await BookingInvoice.create({
    booking: booking._id,
    invoiceNumber,
    issuedAt: new Date(),
    guestDetails: {
      name: booking.guestName,
      email: booking.email,
      phone: booking.phone,
    },
    billingDetails: {
      roomCharges: stayCost,
      foodCharges,
      valetCharges: 0,
      extraBed: booking.priceBreakdown?.extraBedCharges || 0,
      subtotal: pricing.subtotal,
      gst: pricing.taxTotal,
      serviceCharge: pricing.serviceChargeTotal,
      discount: booking.priceBreakdown?.discountAmount || 0,
      grandTotal: pricing.grandTotal,
    },
    paymentSummary: {
      // Only what was actually collected — an unpaid "Pay at Hotel" stay must
      // not be recorded as settled just because the guest checked out.
      paidAmount: pricing.alreadyPaidTotal,
      method: booking.payment?.method || 'RAZORPAY',
      transactionId: booking.payment?.razorpayPaymentId || 'CASH',
    },
  });

  booking.status = 'CHECKED_OUT';
  booking.timeline.push({
    status: 'CHECKED_OUT',
    timestamp: new Date(),
    note: `Checked out. Invoice ${invoiceNumber} generated.`,
    updatedBy,
  });
  await booking.save();

  await Room.findByIdAndUpdate(booking.room, { status: 'CLEANING' });

  // Send post-checkout feedback email
  if (booking.email) {
    const roomNumberStr = (booking.room as any)?.roomNumber || '';
    const feedbackLink = `${env.APP_URL}/feedback?room=${encodeURIComponent(roomNumberStr)}`;
    emailService.sendCheckoutFeedback(
      booking.email,
      booking.guestName,
      roomNumberStr || 'Stay',
      feedbackLink
    ).catch((err) => logger.error({ err }, 'Failed to send checkout feedback email'));
  }

  return { booking: await booking.populate('room'), invoice };
}

// ─────────────────────────────────────────────────────────────────────────────
// Room transfer / upgrade / downgrade
// ─────────────────────────────────────────────────────────────────────────────

const GST_RATE = 0.18;
const SERVICE_RATE = 0.05;

/** Tax-inclusive value of a per-night rate difference over the remaining stay. */
function differentialTotal(perNightDelta: number, nights: number) {
  const base = Math.abs(perNightDelta) * nights;
  const gst = Math.round(base * GST_RATE);
  const serviceCharge = Math.round(base * SERVICE_RATE);
  return { base, gst, serviceCharge, total: base + gst + serviceCharge };
}

/** Nightly rate for a room, preferring its category's canonical price. */
async function nightlyRate(room: IRoom): Promise<number> {
  const category = await RoomCategory.findOne({
    roomType: { $regex: `^${(room.roomType || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  });
  return category?.pricePerNight ?? room.pricePerNight;
}

function transferEmailPayload(
  booking: { guestName: string; confirmationNumber?: string },
  transfer: IRoomTransfer,
  qrScanUrl?: string
) {
  return {
    name: booking.guestName,
    confirmationNumber: booking.confirmationNumber || 'N/A',
    oldRoomNumber: transfer.fromRoomNumber,
    oldRoomType: transfer.fromRoomType,
    oldFloor: transfer.fromFloor,
    newRoomNumber: transfer.toRoomNumber,
    newRoomType: transfer.toRoomType,
    newFloor: transfer.toFloor,
    transferTime: (transfer.completedAt ?? transfer.requestedAt).toISOString(),
    qrScanUrl,
    type: transfer.type,
    amountDue: transfer.amountDue,
    refundAmount: transfer.refundAmount,
  };
}

/** Move the physical room state after a transfer actually takes effect. */
async function applyRoomOccupancy(booking: { status: string }, fromRoomId: unknown, toRoomId: unknown) {
  if (booking.status === 'CHECKED_IN') {
    await Room.findByIdAndUpdate(fromRoomId, { status: 'CLEANING' });
    await Room.findByIdAndUpdate(toRoomId, { status: 'OCCUPIED' });
  } else {
    await Room.findByIdAndUpdate(fromRoomId, { status: 'AVAILABLE' });
    await Room.findByIdAndUpdate(toRoomId, { status: 'RESERVED' });
  }
}

/**
 * Request a room transfer for a booking.
 *
 * - Same category  → completes immediately, no billing change.
 * - Higher-priced category → parked as a PENDING_PAYMENT upgrade; the guest is
 *   asked for the differential and an admin confirms collection before the move
 *   takes effect.
 * - Lower-priced category → completes immediately and records a refund owed.
 */
export async function transferRoom(bookingId: string, newRoomId: string, updatedBy?: string) {
  const booking = await RoomBooking.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  if (['CHECKED_OUT', 'CANCELLED'].includes(booking.status)) {
    throw AppError.badRequest(
      `Cannot transfer a booking with status ${booking.status}`,
      'TRANSFER_NOT_ALLOWED',
    );
  }
  if (booking.pendingTransfer) {
    throw AppError.conflict(
      'This booking already has an upgrade awaiting payment confirmation. Confirm or cancel it first.',
      'TRANSFER_ALREADY_PENDING',
    );
  }

  const currentRoom = await Room.findById(booking.room);
  if (!currentRoom) throw AppError.notFound('Current room not found');

  if (currentRoom._id.toString() === newRoomId) {
    throw AppError.badRequest('The guest is already in this room', 'TRANSFER_SAME_ROOM');
  }

  const newRoom = await Room.findById(newRoomId);
  if (!newRoom) throw AppError.notFound('Target room not found');
  if (!newRoom.isActive) {
    throw AppError.badRequest('The target room is inactive', 'TARGET_ROOM_INACTIVE');
  }
  if (!['AVAILABLE', 'CLEANING'].includes(newRoom.status)) {
    throw AppError.badRequest(
      `The target room is currently ${newRoom.status} and cannot accept a transfer`,
      'TARGET_ROOM_UNAVAILABLE',
    );
  }

  // The target must also be free for this booking's dates — room status alone
  // says nothing about a reservation starting next week.
  const clash = await RoomBooking.findOne({
    _id: { $ne: booking._id },
    room: newRoom._id,
    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
    checkInDate: { $lt: booking.checkOutDate },
    checkOutDate: { $gt: booking.checkInDate },
  });
  if (clash) {
    throw AppError.conflict(
      'The target room is already reserved for these dates',
      'TARGET_ROOM_BOOKED',
    );
  }

  const nights = Math.max(
    1,
    Math.ceil((booking.checkOutDate.getTime() - booking.checkInDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const oldRate = await nightlyRate(currentRoom);
  const newRate = await nightlyRate(newRoom);
  const sameCategory = (currentRoom.roomType || '').toUpperCase() === (newRoom.roomType || '').toUpperCase();

  let type: TransferKind = 'NORMAL';
  let amountDue = 0;
  let refundAmount = 0;

  if (!sameCategory) {
    const delta = newRate - oldRate;
    if (delta > 0) {
      type = 'UPGRADE';
      amountDue = differentialTotal(delta, nights).total;
    } else if (delta < 0) {
      type = 'DOWNGRADE';
      refundAmount = differentialTotal(delta, nights).total;
    } else {
      // Different class, identical price — treat as a like-for-like move.
      type = 'NORMAL';
    }
  }

  const now = new Date();
  const transfer: IRoomTransfer = {
    type,
    state: type === 'UPGRADE' ? 'PENDING_PAYMENT' : 'COMPLETED',
    fromRoom: currentRoom._id,
    toRoom: newRoom._id,
    fromRoomNumber: currentRoom.roomNumber,
    toRoomNumber: newRoom.roomNumber,
    fromRoomType: currentRoom.roomType,
    toRoomType: newRoom.roomType,
    fromFloor: currentRoom.floor,
    toFloor: newRoom.floor,
    nights,
    amountDue,
    refundAmount,
    refundStatus: type === 'DOWNGRADE' ? 'PENDING' : undefined,
    requestedAt: now,
    requestedBy: updatedBy,
  };

  if (type === 'UPGRADE') {
    // Hold the upgrade; the guest stays put until the differential is settled.
    booking.pendingTransfer = transfer;
    booking.timeline.push({
      status: booking.status,
      timestamp: now,
      note: `Upgrade requested: Room ${currentRoom.roomNumber} (${currentRoom.roomType}) → Room ${newRoom.roomNumber} (${newRoom.roomType}). ₹${amountDue} due before the move completes.`,
      updatedBy,
    });
    await booking.save();
    await Room.findByIdAndUpdate(newRoom._id, { status: 'RESERVED' });

    void recordAudit({
      action: AUDIT_ACTIONS.ROOM_TRANSFER_REQUESTED,
      actor: updatedBy,
      metadata: { bookingId: booking._id, type, amountDue, from: currentRoom.roomNumber, to: newRoom.roomNumber },
    });

    try {
      await emailService.sendRoomUpgradePaymentPending(
        booking.email,
        transferEmailPayload(booking, transfer),
      );
    } catch (err) {
      logger.error({ err }, 'Failed to dispatch upgrade payment-pending email');
    }

    emitToAdmins('booking:transfer-pending', {
      bookingId: booking._id.toString(),
      guestName: booking.guestName,
      amountDue,
      from: currentRoom.roomNumber,
      to: newRoom.roomNumber,
    });

    return { booking: await booking.populate('room'), transfer };
  }

  // NORMAL and DOWNGRADE both take effect immediately.
  transfer.completedAt = now;
  transfer.completedBy = updatedBy;

  booking.room = newRoom._id;
  booking.transfers.push(transfer);
  booking.timeline.push({
    status: booking.status,
    timestamp: now,
    note:
      type === 'DOWNGRADE'
        ? `Room changed: Room ${currentRoom.roomNumber} (${currentRoom.roomType}) → Room ${newRoom.roomNumber} (${newRoom.roomType}). Refund of ₹${refundAmount} due to the guest.`
        : `Room transferred: Room ${currentRoom.roomNumber} → Room ${newRoom.roomNumber} (${newRoom.roomType}). No billing change.`,
    updatedBy,
  });

  if (type === 'DOWNGRADE') {
    booking.totalPrice = Math.max(0, booking.totalPrice - refundAmount);
    booking.priceBreakdown.roomPrice = newRate;
    booking.priceBreakdown.grandTotal = booking.totalPrice;
  }

  await booking.save();
  await applyRoomOccupancy(booking, currentRoom._id, newRoom._id);

  void recordAudit({
    action: AUDIT_ACTIONS.ROOM_TRANSFER_COMPLETED,
    actor: updatedBy,
    metadata: { bookingId: booking._id, type, refundAmount, from: currentRoom.roomNumber, to: newRoom.roomNumber },
  });

  try {
    await emailService.sendRoomTransfer(
      booking.email,
      transferEmailPayload(booking, transfer, buildScanUrl(newRoom.qr.token)),
    );
  } catch (err) {
    logger.error({ err }, 'Failed to dispatch room transfer email');
  }

  if (type === 'DOWNGRADE') {
    emitToAdmins('booking:refund-due', {
      bookingId: booking._id.toString(),
      guestName: booking.guestName,
      refundAmount,
      from: currentRoom.roomNumber,
      to: newRoom.roomNumber,
    });
  }

  return { booking: await booking.populate('room'), transfer };
}

/**
 * Admin confirms the upgrade differential was collected — only now does the
 * guest actually move rooms.
 */
export async function confirmTransferPayment(bookingId: string, updatedBy?: string) {
  const booking = await RoomBooking.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  const pending = booking.pendingTransfer;
  if (!pending) {
    throw AppError.badRequest('This booking has no upgrade awaiting payment', 'NO_PENDING_TRANSFER');
  }

  const newRoom = await Room.findById(pending.toRoom);
  if (!newRoom) throw AppError.notFound('Target room no longer exists');

  const now = new Date();
  pending.state = 'COMPLETED';
  pending.completedAt = now;
  pending.completedBy = updatedBy;

  booking.room = newRoom._id;
  booking.totalPrice += pending.amountDue;
  booking.priceBreakdown.additionalCharges =
    (booking.priceBreakdown.additionalCharges || 0) + pending.amountDue;
  booking.priceBreakdown.grandTotal = booking.totalPrice;
  booking.transfers.push(pending);
  booking.pendingTransfer = undefined;

  booking.timeline.push({
    status: booking.status,
    timestamp: now,
    note: `Upgrade payment of ₹${pending.amountDue} confirmed. Guest moved to Room ${pending.toRoomNumber} (${pending.toRoomType}).`,
    updatedBy,
  });

  await booking.save();
  await applyRoomOccupancy(booking, pending.fromRoom, newRoom._id);

  void recordAudit({
    action: AUDIT_ACTIONS.ROOM_TRANSFER_COMPLETED,
    actor: updatedBy,
    metadata: { bookingId: booking._id, type: 'UPGRADE', amountDue: pending.amountDue },
  });

  try {
    await emailService.sendRoomTransfer(
      booking.email,
      transferEmailPayload(booking, pending, buildScanUrl(newRoom.qr.token)),
    );
  } catch (err) {
    logger.error({ err }, 'Failed to dispatch upgrade completion email');
  }

  return { booking: await booking.populate('room'), transfer: pending };
}

/** Abandon a pending upgrade and release the room that was being held. */
export async function cancelPendingTransfer(bookingId: string, updatedBy?: string) {
  const booking = await RoomBooking.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  const pending = booking.pendingTransfer;
  if (!pending) {
    throw AppError.badRequest('This booking has no upgrade awaiting payment', 'NO_PENDING_TRANSFER');
  }

  pending.state = 'CANCELLED';
  pending.completedAt = new Date();
  pending.completedBy = updatedBy;
  booking.transfers.push(pending);
  booking.pendingTransfer = undefined;

  booking.timeline.push({
    status: booking.status,
    timestamp: new Date(),
    note: `Upgrade to Room ${pending.toRoomNumber} cancelled. The guest remains in Room ${pending.fromRoomNumber}.`,
    updatedBy,
  });

  await booking.save();
  await Room.findByIdAndUpdate(pending.toRoom, { status: 'AVAILABLE' });

  void recordAudit({
    action: AUDIT_ACTIONS.ROOM_TRANSFER_CANCELLED,
    actor: updatedBy,
    metadata: { bookingId: booking._id, to: pending.toRoomNumber },
  });

  return { booking: await booking.populate('room'), transfer: pending };
}

/** Mark a downgrade refund as settled. */
export async function markTransferRefundProcessed(bookingId: string, updatedBy?: string) {
  const booking = await RoomBooking.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  const pendingRefund = [...booking.transfers]
    .reverse()
    .find((t) => t.type === 'DOWNGRADE' && t.refundStatus === 'PENDING');

  if (!pendingRefund) {
    throw AppError.badRequest('No pending transfer refund on this booking', 'NO_PENDING_REFUND');
  }

  pendingRefund.refundStatus = 'PROCESSED';
  booking.timeline.push({
    status: booking.status,
    timestamp: new Date(),
    note: `Downgrade refund of ₹${pendingRefund.refundAmount} processed.`,
    updatedBy,
  });
  await booking.save();

  return booking.populate('room');
}

/** Back-compat alias — the upgrade path is decided by the category price delta. */
export async function upgradeRoom(bookingId: string, newRoomId: string, updatedBy?: string) {
  return transferRoom(bookingId, newRoomId, updatedBy);
}

/**
 * Rooms a booking may legally be transferred into, annotated with the billing
 * consequence so the admin sees the cost before committing.
 */
export async function getTransferOptions(bookingId: string) {
  const booking = await RoomBooking.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  const currentRoom = await Room.findById(booking.room);
  if (!currentRoom) throw AppError.notFound('Current room not found');

  const nights = Math.max(
    1,
    Math.ceil((booking.checkOutDate.getTime() - booking.checkInDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const clashes = await RoomBooking.find({
    _id: { $ne: booking._id },
    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
    checkInDate: { $lt: booking.checkOutDate },
    checkOutDate: { $gt: booking.checkInDate },
  }).select('room');
  const blocked = new Set(clashes.map((c) => c.room.toString()));

  const candidates = await Room.find({
    _id: { $ne: currentRoom._id },
    isActive: true,
    status: { $in: ['AVAILABLE', 'CLEANING'] },
  }).sort({ floor: 1, roomNumber: 1 });

  const oldRate = await nightlyRate(currentRoom);

  const options = [];
  for (const room of candidates) {
    if (blocked.has(room._id.toString())) continue;
    const rate = await nightlyRate(room);
    const sameCategory = (room.roomType || '').toUpperCase() === (currentRoom.roomType || '').toUpperCase();
    const delta = rate - oldRate;

    let type: TransferKind = 'NORMAL';
    let amountDue = 0;
    let refundAmount = 0;
    if (!sameCategory && delta > 0) {
      type = 'UPGRADE';
      amountDue = differentialTotal(delta, nights).total;
    } else if (!sameCategory && delta < 0) {
      type = 'DOWNGRADE';
      refundAmount = differentialTotal(delta, nights).total;
    }

    options.push({
      _id: room._id.toString(),
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomType: room.roomType,
      pricePerNight: rate,
      transferType: type,
      amountDue,
      refundAmount,
    });
  }

  return {
    nights,
    currentRoom: {
      _id: currentRoom._id.toString(),
      roomNumber: currentRoom.roomNumber,
      floor: currentRoom.floor,
      roomType: currentRoom.roomType,
      pricePerNight: oldRate,
    },
    pendingTransfer: booking.pendingTransfer ?? null,
    options,
  };
}

export async function getReports() {
  const totalRooms = await Room.countDocuments({ isActive: true });
  const occupiedRooms = await Room.countDocuments({ status: 'OCCUPIED' });
  const cleaningRooms = await Room.countDocuments({ status: 'CLEANING' });
  const maintenanceRooms = await Room.countDocuments({ status: 'MAINTENANCE' });

  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const revenueResult = await RoomBooking.aggregate([
    { $match: { paymentStatus: 'PAID' } },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } },
  ]);
  const totalRevenue = revenueResult[0]?.total || 0;

  const trends = await RoomBooking.aggregate([
    { $match: { paymentStatus: 'PAID' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        count: { $sum: 1 },
        revenue: { $sum: '$totalPrice' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    occupancy: {
      total: totalRooms,
      occupied: occupiedRooms,
      cleaning: cleaningRooms,
      maintenance: maintenanceRooms,
      rate: occupancyRate,
    },
    revenue: {
      total: totalRevenue,
    },
    trends,
  };
}

export async function createBookingRazorpayOrder(bookingId: string) {
  const booking = await RoomBooking.findById(bookingId).populate('room');
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }
  if (booking.payment?.status === 'PAID') {
    throw AppError.conflict('This booking is already paid', 'ALREADY_PAID');
  }

  const { getRazorpay } = await import('@/config/razorpay');
  const rzp = getRazorpay();
  const rzpOrder = await rzp.orders.create({
    amount: Math.round(booking.totalPrice * 100),
    currency: 'INR',
    receipt: booking.confirmationNumber || booking._id.toString(),
    notes: { bookingId: booking._id.toString() },
  });

  booking.payment = {
    method: 'RAZORPAY',
    status: 'PENDING',
    razorpayOrderId: rzpOrder.id,
  };
  await booking.save();

  const { env } = await import('@/config/env');
  return {
    keyId: env.RAZORPAY_KEY_ID || 'rzp_test_key',
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    confirmationNumber: booking.confirmationNumber,
  };
}

export async function verifyBookingPayment(
  bookingId: string,
  input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }
) {
  const booking = await RoomBooking.findById(bookingId);
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  const { verifyPaymentSignature } = await import('@/services/payment.service');
  const verified = verifyPaymentSignature(
    input.razorpayOrderId,
    input.razorpayPaymentId,
    input.razorpaySignature
  );

  if (!verified) {
    booking.payment.status = 'FAILED';
    booking.timeline.push({
      status: 'PENDING',
      timestamp: new Date(),
      note: 'Payment verification failed. Invalid signature.',
    });
    await booking.save();
    throw AppError.badRequest('Invalid payment signature', 'PAYMENT_SIGNATURE_INVALID');
  }

  booking.payment.status = 'PAID';
  booking.payment.razorpayPaymentId = input.razorpayPaymentId;
  booking.payment.razorpaySignature = input.razorpaySignature;
  booking.payment.paidAt = new Date();
  booking.paymentStatus = 'PAID';
  booking.status = 'CONFIRMED';
  booking.timeline.push({
    status: 'CONFIRMED',
    timestamp: new Date(),
    note: `Payment verified. Transaction ID: ${input.razorpayPaymentId}. Reservation confirmed.`,
  });

  await booking.save();
  const populated = await booking.populate('room');
  
  // Fire stay confirmation email
  try {
    const roomNum = (populated.room as any)?.roomNumber || 'N/A';
    await emailService.sendRoomBookingConfirmation(
      booking.email,
      booking.guestName,
      roomNum,
      booking.checkInDate.toISOString(),
      booking.checkOutDate.toISOString(),
      booking.confirmationNumber || 'N/A',
      booking.totalPrice
    );
  } catch (err) {
    logger.error({ err }, 'Failed to dispatch room stay confirmation email');
  }

  return populated;
}

/**
 * Cancel a booking on the guest's behalf.
 *
 * The guest is never asked to re-enter their email: ownership is proven by the
 * signed-in account matching the email already stored on the booking, by the
 * confirmation number that only appears on their own ticket, or by staff
 * privileges. `actor.email` is optional precisely so an expired session cannot
 * block a cancellation the guest is otherwise entitled to make.
 */
export async function cancelGuestBooking(
  bookingId: string,
  actor: { email?: string; role?: string; confirmationNumber?: string; isStaff?: boolean },
  reason?: string
) {
  const booking = await RoomBooking.findById(bookingId).populate('room');
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  const emailMatches =
    !!actor.email && actor.email.trim().toLowerCase() === (booking.email || '').trim().toLowerCase();
  const confirmationMatches =
    !!actor.confirmationNumber &&
    !!booking.confirmationNumber &&
    actor.confirmationNumber.trim().toUpperCase() === booking.confirmationNumber.trim().toUpperCase();

  if (!emailMatches && !confirmationMatches && !actor.isStaff) {
    throw AppError.forbidden(
      'You are not authorized to cancel this booking',
      'BOOKING_CANCEL_DENIED',
    );
  }

  if (['CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].includes(booking.status)) {
    throw AppError.badRequest(
      `Cannot cancel a booking with status ${booking.status}`,
      'BOOKING_NOT_CANCELLABLE',
    );
  }

  const cancelReason = reason?.trim() || 'Guest requested cancellation via portal';
  const refundNote =
    booking.paymentStatus === 'PAID'
      ? 'A refund has been initiated in line with our cancellation policy.'
      : 'No payment was collected, so no refund is required.';

  booking.status = 'CANCELLED';
  booking.pendingTransfer = undefined;
  booking.timeline.push({
    status: 'CANCELLED',
    timestamp: new Date(),
    note: `Booking cancelled by ${actor.isStaff ? 'hotel staff' : 'guest'}. Reason: ${cancelReason}. ${refundNote}`,
    updatedBy: actor.email,
  });

  await booking.save();

  // Free the room again so it returns to the availability search.
  await Room.findByIdAndUpdate(booking.room, { status: 'AVAILABLE' });

  void recordAudit({
    action: AUDIT_ACTIONS.ROOM_BOOKING_CANCELLED,
    actor: actor.email,
    metadata: { bookingId: booking._id, reason: cancelReason },
  });

  try {
    await emailService.sendRoomBookingCancelled(
      booking.email,
      booking.guestName,
      (booking.room as any)?.roomNumber || 'N/A',
      booking.confirmationNumber || 'N/A',
      cancelReason,
      refundNote
    );
  } catch (err) {
    logger.error({ err }, 'Failed to dispatch booking cancellation email');
  }

  return booking;
}
