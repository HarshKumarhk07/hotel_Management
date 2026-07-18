import request from 'supertest';
import { createApp } from '@/app';
import { RestaurantTable, Waitlist, Kitchen } from '@/models';
import { ROLES, TABLE_STATUS } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();
const api = '/api/v1/restaurant';

async function adminBearer() {
  const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
  return bearer;
}

describe('Restaurant Waitlist — API Endpoints', () => {
  let adminToken: string;
  let kitchen: any;
  let table1: any;
  let table2: any;

  beforeEach(async () => {
    adminToken = await adminBearer();
    await Waitlist.deleteMany({});
    await RestaurantTable.deleteMany({});
    await Kitchen.deleteMany({});

    kitchen = await Kitchen.create({
      name: 'Main Kitchen',
      slug: 'main-kitchen',
      timings: { open: '08:00', close: '22:00' },
      isActive: true,
    });

    table1 = await RestaurantTable.create({
      number: 'T1',
      floor: 0,
      capacity: 2,
      kitchen: kitchen._id,
      status: TABLE_STATUS.AVAILABLE,
      isActive: true,
      qr: { token: 'qr-table-t1', isActive: true, version: 1 },
    });

    table2 = await RestaurantTable.create({
      number: 'T2',
      floor: 0,
      capacity: 4,
      kitchen: kitchen._id,
      status: TABLE_STATUS.AVAILABLE,
      isActive: true,
      qr: { token: 'qr-table-t2', isActive: true, version: 1 },
    });
  });

  it('allows guest to join waitlist and fetches live status & position', async () => {
    // Join 1st guest
    const res1 = await request(app)
      .post(`${api}/waitlist`)
      .send({
        guestName: 'Alice Green',
        phone: '+919999911111',
        email: 'alice@example.com',
        guestsCount: 2,
      })
      .expect(201);

    expect(res1.body.data.waitlist.position).toBe(1);

    // Join 2nd guest
    const res2 = await request(app)
      .post(`${api}/waitlist`)
      .send({
        guestName: 'Bob White',
        phone: '+919999922222',
        email: 'bob@example.com',
        guestsCount: 4,
      })
      .expect(201);

    expect(res2.body.data.waitlist.position).toBe(2);

    // Check status of 2nd guest
    const statusRes = await request(app)
      .get(`${api}/waitlist/status`)
      .query({ email: 'bob@example.com' })
      .expect(200);

    expect(statusRes.body.data.position).toBe(2);
    expect(statusRes.body.data.estimatedWaitMinutes).toBe(20); // 2 * 10 mins
  });

  it('seats guest manually and triggers table occupancy', async () => {
    const guest = await Waitlist.create({
      guestName: 'Charlie Black',
      phone: '+919999933333',
      email: 'charlie@example.com',
      guestsCount: 2,
      position: 1,
    });

    const res = await request(app)
      .patch(`${api}/waitlist/${guest._id}/seat`)
      .set('Authorization', adminToken)
      .send({ tableId: table1._id.toString() })
      .expect(200);

    expect(res.body.data.waitlist.status).toBe('SEATED');
    expect(res.body.data.waitlist.assignedTable).toBe(table1._id.toString());

    const updatedTable = await RestaurantTable.findById(table1._id);
    expect(updatedTable!.status).toBe(TABLE_STATUS.OCCUPIED);
  });

  it('supports waitlist cancellation and shifts subsequent positions', async () => {
    const guest1 = await Waitlist.create({
      guestName: 'Alice Green',
      phone: '+919999911111',
      email: 'alice@example.com',
      guestsCount: 2,
      position: 1,
    });

    const guest2 = await Waitlist.create({
      guestName: 'Bob White',
      phone: '+919999922222',
      email: 'bob@example.com',
      guestsCount: 4,
      position: 2,
    });

    // Cancel Alice
    await request(app)
      .patch(`${api}/waitlist/${guest1._id}/cancel`)
      .set('Authorization', adminToken)
      .expect(200);

    // Bob should now be position 1
    const checkBob = await request(app)
      .get(`${api}/waitlist/status`)
      .query({ phone: '+919999922222' })
      .expect(200);

    expect(checkBob.body.data.position).toBe(1);
    expect(checkBob.body.data.estimatedWaitMinutes).toBe(10);
    expect(checkBob.body.data.guestName).toBe(guest2.guestName);
  });

  it('auto-assigns available tables to fitting waitlist parties', async () => {
    // Guest 1 (party of 4)
    await Waitlist.create({
      guestName: 'Bob White',
      phone: '+919999922222',
      email: 'bob@example.com',
      guestsCount: 4,
      position: 1,
    });

    // Guest 2 (party of 2)
    await Waitlist.create({
      guestName: 'Alice Green',
      phone: '+919999911111',
      email: 'alice@example.com',
      guestsCount: 2,
      position: 2,
    });

    // Trigger auto assign
    const res = await request(app)
      .post(`${api}/waitlist/auto-assign`)
      .set('Authorization', adminToken)
      .expect(200);

    expect(res.body.data.assigned.length).toBe(2);

    const dbTable1 = await RestaurantTable.findById(table1._id);
    const dbTable2 = await RestaurantTable.findById(table2._id);
    expect(dbTable1!.status).toBe(TABLE_STATUS.OCCUPIED);
    expect(dbTable2!.status).toBe(TABLE_STATUS.OCCUPIED);
  });
});
