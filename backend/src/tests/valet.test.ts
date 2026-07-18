import request from 'supertest';
import { createApp } from '@/app';
import { Vehicle, ParkingSlot, Room } from '@/models';
import { ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();
const api = '/api/v1/valet';

async function valetBearer() {
  const { bearer, user } = await createUserWithToken(ROLES.VALET_MANAGER);
  return { bearer, user };
}

async function adminBearer() {
  const { bearer, user } = await createUserWithToken(ROLES.SUPER_ADMIN);
  return { bearer, user };
}

async function prepareSlot(slotNumber = 'P-99') {
  await ParkingSlot.deleteMany({ slotNumber });
  return ParkingSlot.create({
    slotNumber,
    isOccupied: false,
    notes: 'Test slot'
  });
}

describe('Valet Parking — API Endpoints', () => {
  let valetCreds: { bearer: string; user: any };

  beforeEach(async () => {
    await Vehicle.deleteMany({});
    valetCreds = await valetBearer();
  });

  it('lists free and occupied parking slots', async () => {
    await prepareSlot('P-88');
    const res = await request(app)
      .get(`${api}/slots`)
      .set('Authorization', valetCreds.bearer)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    const hasTestSlot = res.body.data.some((s: any) => s.slotNumber === 'P-88');
    expect(hasTestSlot).toBe(true);
  });

  it('resolves room QR token guest occupant info', async () => {
    const token = 'valet-qr-token-test';
    await Room.create({
      roomNumber: 'Valet-777',
      floor: 7,
      isActive: true,
      qr: { token, isActive: true, version: 1 }
    });

    const res = await request(app)
      .get(`${api}/resolve-room/${token}`)
      .set('Authorization', valetCreds.bearer)
      .expect(200);

    expect(res.body.data.roomNumber).toBe('Valet-777');
    expect(res.body.data.foundFromOrder).toBe(false);
  });

  it('allows public querying of a plate number status', async () => {
    const testVehicle = await Vehicle.create({
      secureToken: 'dummy-token-1',
      carNumber: 'KA03ZZ1234',
      brand: 'Toyota',
      model: 'Fortuner',
      color: 'White',
      parkingSlot: 'P-99',
      keyTag: 'K-099',
      status: 'PARKED',
      guestInfo: {
        name: 'John Doe',
        roomNumber: '101',
        phone: '9988776655',
        email: 'john@gmail.com'
      },
      photos: {
        front: { url: 'http://front.jpg', publicId: '1' },
        rear: { url: 'http://rear.jpg', publicId: '2' },
        left: { url: 'http://left.jpg', publicId: '3' },
        right: { url: 'http://right.jpg', publicId: '4' },
        dashboard: { url: 'http://dash.jpg', publicId: '5' }
      }
    });

    const res = await request(app)
      .get(`${api}/track/${testVehicle.carNumber}`)
      .expect(200);

    expect(res.body.data.carNumber).toBe('KA03ZZ1234');
    expect(res.body.data.status).toBe('PARKED');
  });

  it('allows guest to request retrieval of a parked vehicle', async () => {
    const testVehicle = await Vehicle.create({
      secureToken: 'dummy-token-2',
      carNumber: 'KA03ZZ5678',
      brand: 'Toyota',
      model: 'Innova',
      color: 'Black',
      parkingSlot: 'P-98',
      keyTag: 'K-098',
      status: 'PARKED',
      guestInfo: {
        name: 'Jane Doe',
        roomNumber: '102',
        phone: '9988776655',
        email: 'jane@gmail.com'
      },
      photos: {
        front: { url: 'http://front.jpg', publicId: '1' },
        rear: { url: 'http://rear.jpg', publicId: '2' },
        left: { url: 'http://left.jpg', publicId: '3' },
        right: { url: 'http://right.jpg', publicId: '4' },
        dashboard: { url: 'http://dash.jpg', publicId: '5' }
      }
    });

    const res = await request(app)
      .post(`${api}/request/${testVehicle.carNumber}`)
      .expect(200);

    expect(res.body.data.status).toBe('REQUESTED');
    expect(res.body.data.requestedAt).toBeDefined();
  });

  it('lets valet manager transition vehicle status', async () => {
    const testVehicle = await Vehicle.create({
      secureToken: 'dummy-token-3',
      carNumber: 'KA03ZZ1111',
      brand: 'Honda',
      model: 'City',
      color: 'Red',
      parkingSlot: 'P-97',
      keyTag: 'K-097',
      status: 'PARKED',
      guestInfo: {
        name: 'Bob',
        roomNumber: '103',
        phone: '9988776655',
        email: 'bob@gmail.com'
      },
      photos: {
        front: { url: 'http://front.jpg', publicId: '1' },
        rear: { url: 'http://rear.jpg', publicId: '2' },
        left: { url: 'http://left.jpg', publicId: '3' },
        right: { url: 'http://right.jpg', publicId: '4' },
        dashboard: { url: 'http://dash.jpg', publicId: '5' }
      }
    });
    const testVehicleId = testVehicle._id.toString();

    const res = await request(app)
      .patch(`${api}/vehicles/${testVehicleId}/status`)
      .set('Authorization', valetCreds.bearer)
      .send({ status: 'BRINGING', notes: 'Staff retrieval started' })
      .expect(200);

    expect(res.body.data.status).toBe('BRINGING');
    expect(res.body.data.statusHistory.length).toBe(1);
    expect(res.body.data.statusHistory[0].status).toBe('BRINGING');
  });
});

// ── Admin Valet Management Endpoints ────────────────────────────────────────────

describe('Valet Admin — Manager Management Endpoints', () => {
  let adminCreds: { bearer: string; user: any };

  beforeEach(async () => {
    adminCreds = await adminBearer();
  });

  // ── Auth guard ───────────────────────────────────────────────────────────────

  it('rejects unauthenticated requests to admin manager list', async () => {
    await request(app).get(`${api}/admin/managers`).expect(401);
  });

  it('rejects unauthenticated requests to admin manager create', async () => {
    await request(app).post(`${api}/admin/managers`).expect(401);
  });

  it('rejects valet manager role from admin list endpoint', async () => {
    const { bearer } = await valetBearer();
    await request(app)
      .get(`${api}/admin/managers`)
      .set('Authorization', bearer)
      .expect(403);
  });

  // ── GET /admin/stats ─────────────────────────────────────────────────────────

  it('returns valet admin stats for super admin', async () => {
    const res = await request(app)
      .get(`${api}/admin/stats`)
      .set('Authorization', adminCreds.bearer)
      .expect(200);

    const d = res.body.data;
    expect(typeof d.totalValetManagers).toBe('number');
    expect(typeof d.onlineValetManagers).toBe('number');
    expect(typeof d.activeVehicles).toBe('number');
    expect(typeof d.deliveredToday).toBe('number');
    expect(typeof d.totalSlots).toBe('number');
    expect(typeof d.freeSlots).toBe('number');
  });

  // ── GET /admin/activity ──────────────────────────────────────────────────────

  it('returns recent valet activity array for super admin', async () => {
    const res = await request(app)
      .get(`${api}/admin/activity`)
      .set('Authorization', adminCreds.bearer)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ── POST /admin/managers ─────────────────────────────────────────────────────

  it('creates a new valet manager and returns safe user object', async () => {
    const payload = {
      name: 'Test Valet',
      email: `valet-create-${Date.now()}@example-test.com`,
      phone: '+91 99999 00001',
      employeeId: 'VM-TEST-001',
    };

    const res = await request(app)
      .post(`${api}/admin/managers`)
      .set('Authorization', adminCreds.bearer)
      .send(payload)
      .expect(200);

    expect(res.body.data.email).toBe(payload.email);
    expect(res.body.data.role).toBe(ROLES.VALET_MANAGER);
    expect(res.body.data.isEmailVerified).toBe(true);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.employeeId).toBe('VM-TEST-001');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('rejects creating a valet manager with a duplicate email', async () => {
    const email = `dup-valet-${Date.now()}@example-test.com`;
    const payload = { name: 'Dup Valet', email, phone: '1234567890' };
    await request(app)
      .post(`${api}/admin/managers`)
      .set('Authorization', adminCreds.bearer)
      .send(payload)
      .expect(200);

    await request(app)
      .post(`${api}/admin/managers`)
      .set('Authorization', adminCreds.bearer)
      .send(payload)
      .expect(409);
  });

  it('rejects create payload missing required fields', async () => {
    await request(app)
      .post(`${api}/admin/managers`)
      .set('Authorization', adminCreds.bearer)
      .send({ name: 'No Email' })
      .expect(400);
  });

  // ── GET /admin/managers ──────────────────────────────────────────────────────

  it('lists valet managers with pagination metadata', async () => {
    await request(app)
      .post(`${api}/admin/managers`)
      .set('Authorization', adminCreds.bearer)
      .send({ name: 'List Test', email: `list-${Date.now()}@example-test.com`, phone: '0000000001' });

    const res = await request(app)
      .get(`${api}/admin/managers`)
      .set('Authorization', adminCreds.bearer)
      .expect(200);

    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(typeof res.body.data.meta.total).toBe('number');
    expect(res.body.data.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('filters managers by search query', async () => {
    const uniqueName = `SearchableValet${Date.now()}`;
    await request(app)
      .post(`${api}/admin/managers`)
      .set('Authorization', adminCreds.bearer)
      .send({ name: uniqueName, email: `srch-${Date.now()}@example-test.com`, phone: '1234567891' });

    const res = await request(app)
      .get(`${api}/admin/managers?search=${uniqueName}`)
      .set('Authorization', adminCreds.bearer)
      .expect(200);

    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0].name).toBe(uniqueName);
  });

  // ── PATCH /admin/managers/:id ────────────────────────────────────────────────

  it('updates a valet manager name and disables the account', async () => {
    const createRes = await request(app)
      .post(`${api}/admin/managers`)
      .set('Authorization', adminCreds.bearer)
      .send({ name: 'Before Update', email: `upd-${Date.now()}@example-test.com`, phone: '0000000002' });

    const { _id, email } = createRes.body.data;

    const updateRes = await request(app)
      .patch(`${api}/admin/managers/${_id}`)
      .set('Authorization', adminCreds.bearer)
      .send({ name: 'After Update', email, phone: '0000000002', isActive: false })
      .expect(200);

    expect(updateRes.body.data.name).toBe('After Update');
    expect(updateRes.body.data.isActive).toBe(false);
  });

  it('returns 404 when updating a non-existent manager', async () => {
    await request(app)
      .patch(`${api}/admin/managers/000000000000000000000001`)
      .set('Authorization', adminCreds.bearer)
      .send({ name: 'Ghost', email: 'ghost@test.com', phone: '0000' })
      .expect(404);
  });

  // ── POST /admin/managers/:id/reset-password ───────────────────────────────────

  it('resets a valet manager password to the default', async () => {
    const createRes = await request(app)
      .post(`${api}/admin/managers`)
      .set('Authorization', adminCreds.bearer)
      .send({ name: 'Reset Me', email: `rst-${Date.now()}@example-test.com`, phone: '0000000003' });

    const id = createRes.body.data._id;

    const res = await request(app)
      .post(`${api}/admin/managers/${id}/reset-password`)
      .set('Authorization', adminCreds.bearer)
      .expect(200);

    expect(res.body.data._id).toBe(id);
  });

  it('returns 404 when resetting password for unknown manager id', async () => {
    await request(app)
      .post(`${api}/admin/managers/000000000000000000000002/reset-password`)
      .set('Authorization', adminCreds.bearer)
      .expect(404);
  });

  // ── Reports & Receipts ────────────────────────────────────────────────────────

  describe('Reports & Receipts Endpoints', () => {
    let parkedVehicleId: string;

    beforeEach(async () => {
      const v = await Vehicle.create({
        secureToken: `tk-${Date.now()}`,
        carNumber: 'MH02AB1234',
        brand: 'Honda',
        model: 'City',
        color: 'Silver',
        parkingSlot: 'A-12',
        keyTag: 'K-12',
        status: 'PARKED',
        guestInfo: {
          name: 'James Bond',
          roomNumber: '007',
          phone: '9988776655',
          email: 'james@bond.com',
        },
        photos: {
          front: { url: 'http://front.jpg', publicId: '1' },
          rear: { url: 'http://rear.jpg', publicId: '2' },
          left: { url: 'http://left.jpg', publicId: '3' },
          right: { url: 'http://right.jpg', publicId: '4' },
          dashboard: { url: 'http://dash.jpg', publicId: '5' },
        },
      });
      parkedVehicleId = v._id.toString();
    });

    it('downloads valet ticket PDF', async () => {
      const res = await request(app)
        .get(`${api}/vehicles/${parkedVehicleId}/ticket`)
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
    });

    it('downloads valet receipt PDF', async () => {
      const res = await request(app)
        .get(`${api}/vehicles/${parkedVehicleId}/receipt`)
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
    });

    it('exports daily activity report as PDF', async () => {
      const res = await request(app)
        .get(`${api}/reports/export`)
        .set('Authorization', adminCreds.bearer)
        .query({ format: 'pdf' })
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
    });

    it('exports daily activity report as XLSX', async () => {
      const res = await request(app)
        .get(`${api}/reports/export`)
        .set('Authorization', adminCreds.bearer)
        .query({ format: 'xlsx' })
        .expect(200);

      expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
  });
});
