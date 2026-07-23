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

async function createRoom(bearer: string, roomNumber = '101', floor = 1) {
  const res = await request(app)
    .post(api)
    .set('Authorization', bearer)
    .send({ roomNumber, floor })
    .expect(201);
  return res.body.data.room;
}

describe('Rooms — CRUD & QR lifecycle', () => {
  it('creates a room with an active QR token', async () => {
    const bearer = await adminBearer();
    const room = await createRoom(bearer);
    expect(room.qr.token).toBeDefined();
    expect(room.qr.isActive).toBe(true);
    expect(room.qr.version).toBe(1);
  });

  it('prevents duplicate room numbers', async () => {
    const bearer = await adminBearer();
    await createRoom(bearer, '202', 2);
    const res = await request(app)
      .post(api)
      .set('Authorization', bearer)
      .send({ roomNumber: '202', floor: 2 })
      .expect(409);
    expect(res.body.error.code).toBe('ROOM_EXISTS');
  });

  it('regenerates the QR token and bumps the version', async () => {
    const bearer = await adminBearer();
    const room = await createRoom(bearer, '303', 3);
    const oldToken = room.qr.token;

    const res = await request(app)
      .post(`${api}/${room._id}/qr/generate`)
      .set('Authorization', bearer)
      .expect(200);

    expect(res.body.data.qr.token).not.toBe(oldToken);
    expect(res.body.data.room.qr.version).toBe(2);
    expect(res.body.data.qr.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('downloads the QR as a PNG', async () => {
    const bearer = await adminBearer();
    const room = await createRoom(bearer, '404', 4);
    const res = await request(app)
      .get(`${api}/${room._id}/qr/download?format=png`)
      .set('Authorization', bearer)
      .expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body).toBeInstanceOf(Buffer);
  });

  it('disables a QR and reassigns (swaps) tokens between rooms', async () => {
    const bearer = await adminBearer();
    const a = await createRoom(bearer, '501', 5);
    const b = await createRoom(bearer, '502', 5);
    const tokenA = a.qr.token;
    const tokenB = b.qr.token;

    const res = await request(app)
      .post(`${api}/${a._id}/qr/reassign`)
      .set('Authorization', bearer)
      .send({ targetRoomId: b._id })
      .expect(200);

    expect(res.body.data.source.qr.token).toBe(tokenB);
    expect(res.body.data.target.qr.token).toBe(tokenA);
  });
});

describe('Rooms — public QR resolution', () => {
  it('resolves an active QR token to room + kitchen (no auth, no internal note)', async () => {
    const bearer = await adminBearer();
    const room = await createRoom(bearer, '601', 6);
    // attach an internal note that must never leak
    await Room.updateOne({ _id: room._id }, { $set: { internalNote: 'VIP guest' } });

    await RoomBooking.create({
      room: room._id,
      guestName: 'Test Guest',
      phone: '+919999999999',
      email: 'test@example.com',
      checkInDate: new Date(Date.now() - 100000),
      checkOutDate: new Date(Date.now() + 86400000),
      totalPrice: 1000,
      status: 'CONFIRMED',
      governmentId: 'ID123',
      idProofUrl: 'https://example.com/id.jpg',
      idProofType: 'Aadhaar',
      priceBreakdown: { roomPrice: 1000, nights: 1, grandTotal: 1000 },
    });

    const res = await request(app).get(`${api}/resolve/${room.qr.token}`).expect(200);
    expect(res.body.data.room.roomNumber).toBe('601');
    expect(JSON.stringify(res.body)).not.toContain('VIP guest');
  });

  it('rejects a disabled QR', async () => {
    const bearer = await adminBearer();
    const room = await createRoom(bearer, '602', 6);

    await RoomBooking.create({
      room: room._id,
      guestName: 'Test Guest',
      phone: '+919999999999',
      email: 'test@example.com',
      checkInDate: new Date(Date.now() - 100000),
      checkOutDate: new Date(Date.now() + 86400000),
      totalPrice: 1000,
      status: 'CONFIRMED',
      governmentId: 'ID123',
      idProofUrl: 'https://example.com/id.jpg',
      idProofType: 'Aadhaar',
      priceBreakdown: { roomPrice: 1000, nights: 1, grandTotal: 1000 },
    });

    await request(app).patch(`${api}/${room._id}/qr/disable`).set('Authorization', bearer).expect(200);

    const res = await request(app).get(`${api}/resolve/${room.qr.token}`).expect(403);
    expect(res.body.error.code).toBe('QR_DISABLED');
  });

  it('returns 404 for an unknown token', async () => {
    const res = await request(app).get(`${api}/resolve/does-not-exist-token`).expect(404);
    expect(res.body.error.code).toBe('QR_UNKNOWN');
  });
});
