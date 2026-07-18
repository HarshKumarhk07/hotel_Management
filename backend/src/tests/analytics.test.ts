import request from 'supertest';
import { createApp } from '@/app';
import { Kitchen, Order, Room } from '@/models';
import { ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();

async function seed() {
  const kitchen = await Kitchen.create({ name: 'A Kitchen', slug: `ak-${Date.now()}-${Math.round(Math.random() * 1e6)}` });
  const room = await Room.create({
    roomNumber: '101', floor: 1, kitchen: kitchen._id,
    qr: { token: `t-${Math.round(Math.random() * 1e9)}`, isActive: true, version: 1 },
  });
  const customer = await createUserWithToken(ROLES.CUSTOMER);

  const baseItem = {
    menuItem: room._id, name: 'Pizza', foodLabel: 'VEG' as const, unitPrice: 150, taxPercent: 0,
    quantity: 2, cancelledQuantity: 0, lineSubtotal: 300, lineTax: 0, lineTotal: 300,
  };
  const makeOrder = (n: string, status: string, paymentStatus: string) =>
    Order.create({
      orderNumber: n, kitchen: kitchen._id, room: room._id,
      roomSnapshot: { roomNumber: room.roomNumber, floor: 1 }, customer: customer.user._id,
      items: [baseItem],
      pricing: { subtotal: 300, taxTotal: 0, serviceCharge: 0, discount: 0, total: 300, currency: 'INR' },
      status,
      payment: { method: 'COD', status: paymentStatus, amount: 300, currency: 'INR' },
      refund: { status: 'NOT_REQUIRED', amount: 0 },
      estimatedPrepMinutes: 20,
    });

  await makeOrder('ORD-A1', 'DELIVERED', 'PAID');
  await makeOrder('ORD-A2', 'CANCELLED', 'PENDING');
  await makeOrder('ORD-A3', 'NEW_ORDER', 'PENDING');

  return { kitchen, customer };
}

describe('Analytics — summary', () => {
  it('aggregates orders, revenue, and status counts', async () => {
    await seed();
    const admin = await createUserWithToken(ROLES.SUPER_ADMIN);
    const res = await request(app).get('/api/v1/analytics/summary').set('Authorization', admin.bearer).expect(200);
    const d = res.body.data;
    expect(d.totalOrders).toBe(3);
    expect(d.revenue).toBe(300); // only the PAID order counts
    expect(d.completedOrders).toBe(1);
    expect(d.cancelledOrders).toBe(1);
    expect(d.pendingOrders).toBe(1);
  });

  it('scopes a kitchen owner to their own kitchen only', async () => {
    await seed(); // kitchen A with 3 orders
    const otherKitchen = await Kitchen.create({ name: 'B', slug: `bk-${Date.now()}` });
    const owner = await createUserWithToken(ROLES.KITCHEN_OWNER, { kitchen: otherKitchen._id.toString() });
    const res = await request(app).get('/api/v1/analytics/summary').set('Authorization', owner.bearer).expect(200);
    expect(res.body.data.totalOrders).toBe(0); // none in their kitchen
  });

  it('forbids customers', async () => {
    const customer = await createUserWithToken(ROLES.CUSTOMER);
    await request(app).get('/api/v1/analytics/summary').set('Authorization', customer.bearer).expect(403);
  });
});

describe('Analytics — items & exports', () => {
  it('returns best-selling items', async () => {
    await seed();
    const admin = await createUserWithToken(ROLES.SUPER_ADMIN);
    const res = await request(app).get('/api/v1/analytics/top-items').set('Authorization', admin.bearer).expect(200);
    expect(res.body.data.topItems[0].name).toBe('Pizza');
    expect(res.body.data.topItems[0].quantitySold).toBe(6); // 2 per order × 3 orders
  });

  it('exports an orders report as CSV', async () => {
    await seed();
    const admin = await createUserWithToken(ROLES.SUPER_ADMIN);
    const res = await request(app)
      .get('/api/v1/analytics/export?format=csv&report=orders')
      .set('Authorization', admin.bearer)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('orders-report.csv');
    expect(res.text).toContain('Order #');
    expect(res.text).toContain('ORD-A1');
  });

  it('exports a summary report as XLSX', async () => {
    await seed();
    const admin = await createUserWithToken(ROLES.SUPER_ADMIN);
    const res = await request(app)
      .get('/api/v1/analytics/export?format=xlsx&report=summary')
      .set('Authorization', admin.bearer)
      .buffer(true)
      .parse((response, cb) => {
        const data: Buffer[] = [];
        response.on('data', (c: Buffer) => data.push(c));
        response.on('end', () => cb(null, Buffer.concat(data)));
      })
      .expect(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect((res.body as Buffer).length).toBeGreaterThan(0);
    // XLSX files are ZIP archives — verify the PK magic bytes.
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });
});
