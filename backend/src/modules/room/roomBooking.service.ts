import crypto from 'node:crypto';
import { Room, RoomBooking, BookingInvoice, Order, Vehicle, BanquetBooking, type IRoom } from '@/models';
import { AppError } from '@/utils/AppError';
import { getPageParams, pageMeta } from '@/utils/pagination';
import type { FilterQuery } from 'mongoose';
import { validateCoupon, reserveCoupon } from '@/modules/coupon/coupon.service';
import { emailService } from '@/services/email/brevo.service';
import { logger } from '@/config/logger';
import { env } from '@/config/env';

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
  if (query.roomType) {
    filter.roomType = query.roomType;
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

  // Always send a booking notification email immediately upon creation
  try {
    const populated = await booking.populate('room');
    const roomNum = (populated.room as any)?.roomNumber || 'N/A';

    if (isPayAtHotel) {
      // Pay at Hotel: confirmation email
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
  if (query.email) filter.email = query.email.trim();
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

  if (status === 'CONFIRMED') {
    booking.paymentStatus = 'PAID';
    booking.payment.status = 'PAID';
    booking.payment.paidAt = new Date();
  } else if (status === 'CHECKED_IN') {
    booking.paymentStatus = 'PAID';
    booking.payment.status = 'PAID';
    booking.payment.paidAt = new Date();
    await Room.findByIdAndUpdate(booking.room, { status: 'OCCUPIED' });
  } else if (status === 'CHECKED_OUT') {
    await booking.save();
    const checkoutResult = await checkOutGuest(id, updatedBy);
    return checkoutResult.booking;
  }

  await booking.save();
  const populated = await booking.populate('room');

  if (status === 'CONFIRMED') {
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
  }

  return populated;
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
  booking.paymentStatus = 'PAID';
  booking.timeline.push({
    status: 'CHECKED_IN',
    timestamp: new Date(),
    note: 'Guest checked in successfully.',
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
      paidAmount: pricing.grandTotal,
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

export async function upgradeRoom(bookingId: string, newRoomId: string, updatedBy?: string) {
  const booking = await RoomBooking.findById(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');
  if (['CHECKED_OUT', 'CANCELLED'].includes(booking.status)) {
    throw AppError.badRequest('Cannot upgrade room for this booking status');
  }

  const newRoom = await Room.findById(newRoomId);
  if (!newRoom) throw AppError.notFound('New room not found');
  if (newRoom.status !== 'AVAILABLE' || !newRoom.isActive) {
    throw AppError.badRequest('New room is not available');
  }

  const oldRoomId = booking.room;
  booking.room = newRoom._id;
  booking.timeline.push({
    status: booking.status,
    timestamp: new Date(),
    note: `Room transferred from Room #${oldRoomId} to Room #${newRoom.roomNumber}.`,
    updatedBy,
  });
  await booking.save();

  if (booking.status === 'CHECKED_IN') {
    await Room.findByIdAndUpdate(oldRoomId, { status: 'CLEANING' });
    await Room.findByIdAndUpdate(newRoom._id, { status: 'OCCUPIED' });
  }

  return booking.populate('room');
}

export async function transferRoom(bookingId: string, newRoomId: string, updatedBy?: string) {
  return upgradeRoom(bookingId, newRoomId, updatedBy);
}

export async function getReports() {
  const totalRooms = await Room.countDocuments({ isActive: true });
  const occupiedRooms = await Room.countDocuments({ status: 'OCCUPIED' });
  const cleaningRooms = await Room.countDocuments({ status: 'CLEANING' });
  const maintenanceRooms = await Room.countDocuments({ status: 'MAINTENANCE' });

  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const revenueResult = await RoomBooking.aggregate([
    { $match: { status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } } },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } },
  ]);
  const totalRevenue = revenueResult[0]?.total || 0;

  const trends = await RoomBooking.aggregate([
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

