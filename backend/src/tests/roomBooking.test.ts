import request from 'supertest';
import { createApp } from '@/app';
import { Room, RoomBooking } from '@/models';
import { ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();
const api = '/api/v1/rooms';

async function adminBearer() {
  const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
  return bearer;
}

describe('Room Booking — API Endpoints', () => {
  let adminToken: string;
  let room1: any;
  let room2: any;

  beforeEach(async () => {
    adminToken = await adminBearer();
    await Room.deleteMany({});
    await RoomBooking.deleteMany({});

    room1 = await Room.create({
      roomNumber: '101',
      floor: 1,
      isActive: true,
      pricePerNight: 5000,
      qr: { token: 'qr-token-101', isActive: true, version: 1 },
    });

    room2 = await Room.create({
      roomNumber: '102',
      floor: 1,
      isActive: true,
      pricePerNight: 5000,
      qr: { token: 'qr-token-102', isActive: true, version: 1 },
    });
  });

  it('searches available rooms and returns empty/populated lists correctly', async () => {
    // Both rooms are available initially
    const res = await request(app)
      .get(`${api}/search`)
      .query({
        checkInDate: new Date('2026-08-01T12:00:00.000Z').toISOString(),
        checkOutDate: new Date('2026-08-05T12:00:00.000Z').toISOString(),
      })
      .expect(200);

    expect(res.body.data.rooms.length).toBe(2);

    // Book Room 101 for those dates
    await RoomBooking.create({
      room: room1._id,
      guestName: 'John Doe',
      phone: '+919999900000',
      email: 'john@example.com',
      checkInDate: new Date('2026-08-01T12:00:00.000Z'),
      checkOutDate: new Date('2026-08-05T12:00:00.000Z'),
      totalPrice: 20000,
      status: 'CONFIRMED',
      priceBreakdown: { roomPrice: 4000, nights: 5, grandTotal: 20000 },
    });

    // Search again, only Room 102 should be returned
    const res2 = await request(app)
      .get(`${api}/search`)
      .query({
        checkInDate: new Date('2026-08-01T12:00:00.000Z').toISOString(),
        checkOutDate: new Date('2026-08-05T12:00:00.000Z').toISOString(),
      })
      .expect(200);

    expect(res2.body.data.rooms.length).toBe(1);
    expect(res2.body.data.rooms[0].roomNumber).toBe(room2.roomNumber);
  });

  it('allows public booking submission', async () => {
    const payload = {
      room: room1._id.toString(),
      guestName: 'Jane Smith',
      phone: '+919876543210',
      email: 'jane@example.com',
      checkInDate: new Date('2026-09-10T12:00:00.000Z').toISOString(),
      checkOutDate: new Date('2026-09-15T12:00:00.000Z').toISOString(),
    };

    const res = await request(app)
      .post(`${api}/bookings`)
      .send(payload)
      .expect(201);

    expect(res.body.data.booking.guestName).toBe('Jane Smith');
    // 5000/night * 5 nights = 25000 base + 18% GST (4500) + 5% service charge (1250) = 30750
    expect(res.body.data.booking.totalPrice).toBe(30750);
    expect(res.body.data.booking.status).toBe('PENDING');
  });

  it('rejects double bookings', async () => {
    const payload = {
      room: room1._id.toString(),
      guestName: 'Jane Smith',
      phone: '+919876543210',
      email: 'jane@example.com',
      checkInDate: new Date('2026-09-10T12:00:00.000Z').toISOString(),
      checkOutDate: new Date('2026-09-15T12:00:00.000Z').toISOString(),
    };

    // First booking
    await request(app).post(`${api}/bookings`).send(payload).expect(201);

    // Conflicting booking
    await request(app).post(`${api}/bookings`).send(payload).expect(409);
  });

  it('allows lookup of bookings by phone or email', async () => {
    await RoomBooking.create({
      room: room1._id,
      guestName: 'Alex Mercer',
      phone: '+91111122222',
      email: 'alex@example.com',
      checkInDate: new Date('2026-10-01T12:00:00.000Z'),
      checkOutDate: new Date('2026-10-05T12:00:00.000Z'),
      totalPrice: 20000,
      status: 'CONFIRMED',
      priceBreakdown: { roomPrice: 4000, nights: 4, grandTotal: 20000 },
    });

    const res = await request(app)
      .get(`${api}/bookings/my-bookings`)
      .query({ email: 'alex@example.com' })
      .expect(200);

    expect(res.body.data.bookings.length).toBe(1);
    expect(res.body.data.bookings[0].guestName).toBe('Alex Mercer');
  });

  it('lets admin list all bookings and update booking status', async () => {
    const booking = await RoomBooking.create({
      room: room1._id,
      guestName: 'Robert Langdon',
      phone: '+919999888877',
      email: 'robert@example.com',
      checkInDate: new Date('2026-11-01T12:00:00.000Z'),
      checkOutDate: new Date('2026-11-05T12:00:00.000Z'),
      totalPrice: 20000,
      status: 'PENDING',
      priceBreakdown: { roomPrice: 4000, nights: 4, grandTotal: 20000 },
    });

    // List bookings (admin)
    const listRes = await request(app)
      .get(`${api}/admin/bookings`)
      .set('Authorization', adminToken)
      .expect(200);

    expect(listRes.body.data.bookings.length).toBeGreaterThanOrEqual(1);

    // Update status to CHECKED_IN
    const statusRes = await request(app)
      .patch(`${api}/bookings/${booking._id}/status`)
      .set('Authorization', adminToken)
      .send({ status: 'CHECKED_IN' })
      .expect(200);

    expect(statusRes.body.data.booking.status).toBe('CHECKED_IN');

    // Room status should update to OCCUPIED
    const updatedRoom = await Room.findById(room1._id);
    expect(updatedRoom!.status).toBe('OCCUPIED');
  });

  it('lets admin update room status directly (housekeeping)', async () => {
    const res = await request(app)
      .patch(`${api}/${room1._id}/status`)
      .set('Authorization', adminToken)
      .send({ status: 'MAINTENANCE' })
      .expect(200);

    expect(res.body.data.room.status).toBe('MAINTENANCE');

    const dbRoom = await Room.findById(room1._id);
    expect(dbRoom!.status).toBe('MAINTENANCE');
  });
});
