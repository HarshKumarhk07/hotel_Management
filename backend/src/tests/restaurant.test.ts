import request from 'supertest';
import { createApp } from '@/app';
import { Kitchen } from '@/models';
import { ROLES, TABLE_STATUS } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();
const api = '/api/v1/restaurant';

async function adminBearer() {
  const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
  return bearer;
}

async function prepareKitchen() {
  return Kitchen.create({
    name: 'Test Restaurant Kitchen',
    slug: 'test-restaurant-kitchen-' + Date.now(),
    isActive: true,
  });
}

describe('Restaurant & Table Management Module', () => {
  it('runs the complete table and reservation lifecycle', async () => {
    const kitchen = await prepareKitchen();
    const kitchenId = kitchen._id.toString();
    const bearer = await adminBearer();

    // 1. Create table
    const createRes = await request(app)
      .post(`${api}/tables`)
      .set('Authorization', bearer)
      .send({
        number: 'T-99',
        capacity: 4,
        floor: 1,
        section: 'Main Hall',
        kitchenId,
      })
      .expect(200);

    expect(createRes.body.data.number).toBe('T-99');
    expect(createRes.body.data.qr.token).toBeDefined();
    expect(createRes.body.data.status).toBe(TABLE_STATUS.AVAILABLE);

    const tableId = createRes.body.data._id.toString();
    const qrToken = createRes.body.data.qr.token;

    // 2. Prevent duplicate table numbers
    await request(app)
      .post(`${api}/tables`)
      .set('Authorization', bearer)
      .send({
        number: 'T-99',
        capacity: 2,
        floor: 1,
        section: 'Main Hall',
        kitchenId,
      })
      .expect(409);

    // 3. Resolve table by token
    const resolveRes = await request(app)
      .get(`${api}/tables/resolve/${qrToken}`)
      .expect(200);

    expect(resolveRes.body.data.number).toBe('T-99');
    expect(resolveRes.body.data.status).toBe(TABLE_STATUS.AVAILABLE);

    // 4. Seat guests
    const seatRes = await request(app)
      .post(`${api}/tables/${tableId}/seat`)
      .set('Authorization', bearer)
      .send({
        partySize: 3,
        guestName: 'John Doe',
        phone: '9876543210',
      })
      .expect(200);

    expect(seatRes.body.data.status).toBe(TABLE_STATUS.OCCUPIED);
    expect(seatRes.body.data.currentSession.guestName).toBe('John Doe');

    // 5. Request bill
    const billRes = await request(app)
      .post(`${api}/tables/${tableId}/request-bill`)
      .set('Authorization', bearer)
      .expect(200);

    expect(billRes.body.data.status).toBe(TABLE_STATUS.BILLING);

    // 6. Close table
    const closeRes = await request(app)
      .post(`${api}/tables/${tableId}/close`)
      .set('Authorization', bearer)
      .expect(200);

    expect(closeRes.body.data.status).toBe(TABLE_STATUS.AVAILABLE);
    expect(closeRes.body.data.currentSession).toBeUndefined();
  });
});