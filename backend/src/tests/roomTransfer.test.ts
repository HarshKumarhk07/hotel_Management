import request from 'supertest';
import { createApp } from '@/app';
import { Room, RoomBooking } from '@/models';
import { ROLES } from '@/constants';
import { createUserWithToken, seedRoomCategory } from './helpers';

const app = createApp();
const api = '/api/v1/rooms';

/** A CONFIRMED, unpaid stay in `room` running 5 nights. */
async function makeBooking(room: any, overrides: Record<string, unknown> = {}) {
  return RoomBooking.create({
    room: room._id,
    guestName: 'Jane Smith',
    phone: '+919876543210',
    email: 'jane@example.com',
    checkInDate: new Date('2026-09-10T12:00:00.000Z'),
    checkOutDate: new Date('2026-09-15T12:00:00.000Z'),
    totalPrice: 30750,
    status: 'CONFIRMED',
    paymentStatus: 'PENDING',
    address: '12 Marine Drive',
    city: 'Mumbai',
    country: 'India',
    governmentId: 'ID1234',
    idProofUrl: 'https://example.com/id.jpg',
    idProofType: 'Aadhaar',
    priceBreakdown: { roomPrice: 5000, nights: 5, grandTotal: 30750 },
    payment: { method: 'CASH', status: 'PENDING' },
    confirmationNumber: `CONF-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
    ...overrides,
  });
}

describe('Room transfer / upgrade / downgrade', () => {
  let bearer: string;
  let standardA: any;
  let standardB: any;
  let deluxe: any;

  beforeEach(async () => {
    ({ bearer } = await createUserWithToken(ROLES.SUPER_ADMIN));
    await Room.deleteMany({});
    await RoomBooking.deleteMany({});

    await seedRoomCategory({ roomType: 'STANDARD', displayName: 'Standard', pricePerNight: 5000 });
    await seedRoomCategory({ roomType: 'DELUXE', displayName: 'Deluxe', pricePerNight: 10000 });

    const base = { isActive: true, status: 'AVAILABLE' as const, floor: 1 };
    standardA = await Room.create({
      ...base, roomNumber: '101', roomType: 'STANDARD', pricePerNight: 5000,
      qr: { token: 'qr-101', isActive: true, version: 1 },
    });
    standardB = await Room.create({
      ...base, roomNumber: '102', roomType: 'STANDARD', pricePerNight: 5000,
      qr: { token: 'qr-102', isActive: true, version: 1 },
    });
    deluxe = await Room.create({
      ...base, roomNumber: '201', roomType: 'DELUXE', pricePerNight: 10000, floor: 2,
      qr: { token: 'qr-201', isActive: true, version: 1 },
    });
  });

  it('completes a same-category transfer immediately with no billing change', async () => {
    const booking = await makeBooking(standardA);

    const res = await request(app)
      .post(`${api}/bookings/${booking._id}/transfer`)
      .set('Authorization', bearer)
      .send({ newRoomId: standardB._id.toString() })
      .expect(200);

    expect(res.body.data.transfer.type).toBe('NORMAL');
    expect(res.body.data.transfer.state).toBe('COMPLETED');

    const updated = await RoomBooking.findById(booking._id);
    expect(updated!.room.toString()).toBe(standardB._id.toString());
    expect(updated!.totalPrice).toBe(30750);
    expect(updated!.pendingTransfer).toBeFalsy();
  });

  it('holds an upgrade until the differential payment is confirmed', async () => {
    const booking = await makeBooking(standardA);

    const res = await request(app)
      .post(`${api}/bookings/${booking._id}/transfer`)
      .set('Authorization', bearer)
      .send({ newRoomId: deluxe._id.toString() })
      .expect(200);

    // (10000 - 5000) * 5 nights = 25000 + 18% GST + 5% service = 30750
    expect(res.body.data.transfer.type).toBe('UPGRADE');
    expect(res.body.data.transfer.state).toBe('PENDING_PAYMENT');
    expect(res.body.data.transfer.amountDue).toBe(30750);

    // Guest has not moved yet.
    const held = await RoomBooking.findById(booking._id);
    expect(held!.room.toString()).toBe(standardA._id.toString());
    expect(held!.pendingTransfer).toBeTruthy();

    await request(app)
      .post(`${api}/bookings/${booking._id}/transfer/confirm-payment`)
      .set('Authorization', bearer)
      .expect(200);

    const moved = await RoomBooking.findById(booking._id);
    expect(moved!.room.toString()).toBe(deluxe._id.toString());
    expect(moved!.totalPrice).toBe(30750 + 30750);
    expect(moved!.pendingTransfer).toBeFalsy();
    expect(moved!.transfers).toHaveLength(1);
  });

  it('records a refund and moves the guest immediately on a downgrade', async () => {
    const booking = await makeBooking(deluxe, {
      totalPrice: 61500,
      priceBreakdown: { roomPrice: 10000, nights: 5, grandTotal: 61500 },
    });

    const res = await request(app)
      .post(`${api}/bookings/${booking._id}/transfer`)
      .set('Authorization', bearer)
      .send({ newRoomId: standardA._id.toString() })
      .expect(200);

    expect(res.body.data.transfer.type).toBe('DOWNGRADE');
    expect(res.body.data.transfer.refundAmount).toBe(30750);

    const updated = await RoomBooking.findById(booking._id);
    expect(updated!.room.toString()).toBe(standardA._id.toString());
    expect(updated!.totalPrice).toBe(61500 - 30750);
    expect(updated!.transfers[0].refundStatus).toBe('PENDING');
  });

  it('rejects a transfer into a room already booked for the same dates', async () => {
    const booking = await makeBooking(standardA);
    await makeBooking(standardB, { email: 'other@example.com' });

    const res = await request(app)
      .post(`${api}/bookings/${booking._id}/transfer`)
      .set('Authorization', bearer)
      .send({ newRoomId: standardB._id.toString() })
      .expect(409);

    expect(res.body.error.code).toBe('TARGET_ROOM_BOOKED');
  });

  it('rejects a transfer into the same room', async () => {
    const booking = await makeBooking(standardA);

    const res = await request(app)
      .post(`${api}/bookings/${booking._id}/transfer`)
      .set('Authorization', bearer)
      .send({ newRoomId: standardA._id.toString() })
      .expect(400);

    expect(res.body.error.code).toBe('TRANSFER_SAME_ROOM');
  });

  it('rejects a transfer on a cancelled booking', async () => {
    const booking = await makeBooking(standardA, { status: 'CANCELLED' });

    const res = await request(app)
      .post(`${api}/bookings/${booking._id}/transfer`)
      .set('Authorization', bearer)
      .send({ newRoomId: standardB._id.toString() })
      .expect(400);

    expect(res.body.error.code).toBe('TRANSFER_NOT_ALLOWED');
  });
});

describe('Payment status', () => {
  let bearer: string;
  let room: any;

  beforeEach(async () => {
    ({ bearer } = await createUserWithToken(ROLES.SUPER_ADMIN));
    await Room.deleteMany({});
    await RoomBooking.deleteMany({});
    await seedRoomCategory({ roomType: 'STANDARD', pricePerNight: 5000 });

    room = await Room.create({
      roomNumber: '101', floor: 1, isActive: true, roomType: 'STANDARD', pricePerNight: 5000,
      qr: { token: 'qr-pay-101', isActive: true, version: 1 },
    });
  });

  it('creates a Pay-at-Hotel booking as CONFIRMED but unpaid', async () => {
    const res = await request(app)
      .post(`${api}/bookings`)
      .send({
        room: room._id.toString(),
        guestName: 'Jane Smith',
        phone: '+919876543210',
        email: 'jane@example.com',
        checkInDate: new Date('2026-09-10T12:00:00.000Z').toISOString(),
        checkOutDate: new Date('2026-09-15T12:00:00.000Z').toISOString(),
        address: '12 Marine Drive',
        city: 'Mumbai',
        country: 'India',
        governmentId: 'ID1234',
        idProofUrl: 'https://example.com/id.jpg',
        idProofType: 'Aadhaar',
        paymentMethod: 'CASH',
      })
      .expect(201);

    expect(res.body.data.booking.status).toBe('CONFIRMED');
    expect(res.body.data.booking.paymentStatus).toBe('PENDING');
    expect(res.body.data.booking.payment.method).toBe('CASH');
  });

  it('does not mark a booking paid just because the guest checked in', async () => {
    const booking = await makeBooking(room);

    await request(app)
      .post(`${api}/bookings/${booking._id}/checkin`)
      .set('Authorization', bearer)
      .expect(200);

    const updated = await RoomBooking.findById(booking._id);
    expect(updated!.status).toBe('CHECKED_IN');
    expect(updated!.paymentStatus).toBe('PENDING');
  });

  it('marks a booking paid only via the explicit admin payment entry', async () => {
    const booking = await makeBooking(room);

    await request(app)
      .patch(`${api}/bookings/${booking._id}/payment`)
      .set('Authorization', bearer)
      .send({ status: 'PAID', method: 'CASH' })
      .expect(200);

    const updated = await RoomBooking.findById(booking._id);
    expect(updated!.paymentStatus).toBe('PAID');
    expect(updated!.payment.paidAt).toBeTruthy();
  });
});

describe('Booking cancellation', () => {
  let room: any;

  beforeEach(async () => {
    await Room.deleteMany({});
    await RoomBooking.deleteMany({});
    await seedRoomCategory({ roomType: 'STANDARD', pricePerNight: 5000 });

    room = await Room.create({
      roomNumber: '101', floor: 1, isActive: true, roomType: 'STANDARD', pricePerNight: 5000,
      qr: { token: 'qr-cancel-101', isActive: true, version: 1 },
    });
  });

  it('cancels using the confirmation number without any email being supplied', async () => {
    const booking = await makeBooking(room);

    await request(app)
      .post(`${api}/bookings/${booking._id}/cancel`)
      .send({ reason: 'Change of plans', confirmationNumber: booking.confirmationNumber })
      .expect(200);

    const updated = await RoomBooking.findById(booking._id);
    expect(updated!.status).toBe('CANCELLED');
  });

  it('cancels for a signed-in guest whose account matches the booking email', async () => {
    const booking = await makeBooking(room);
    const { bearer } = await createUserWithToken(ROLES.CUSTOMER, { email: 'jane@example.com' });

    await request(app)
      .post(`${api}/bookings/${booking._id}/cancel`)
      .set('Authorization', bearer)
      .send({ reason: 'Change of plans' })
      .expect(200);

    const updated = await RoomBooking.findById(booking._id);
    expect(updated!.status).toBe('CANCELLED');
  });

  it('refuses to cancel without any proof of ownership', async () => {
    const booking = await makeBooking(room);

    const res = await request(app)
      .post(`${api}/bookings/${booking._id}/cancel`)
      .send({ reason: 'Not mine' })
      .expect(403);

    expect(res.body.error.code).toBe('BOOKING_CANCEL_DENIED');
  });
});
