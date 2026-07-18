import request from 'supertest';
import { createApp } from '@/app';
import { Category, Coupon, CouponUserCounter, Kitchen, MenuItem, Order, Room } from '@/models';
import { ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();

async function setup() {
  const kitchen = await Kitchen.create({
    name: 'Coupon Kitchen',
    slug: `ck-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    settings: { serviceChargePercent: 0, taxPercent: 0, acceptsCOD: true, acceptsRoomBilling: false },
  });
  const room = await Room.create({
    roomNumber: `R${Math.round(Math.random() * 1e6)}`, floor: 1, kitchen: kitchen._id,
    qr: { token: `tok-${Math.round(Math.random() * 1e9)}`, isActive: true, version: 1 },
  });
  const category = await Category.create({ kitchen: kitchen._id, name: 'Mains', slug: 'mains' });
  const item = await MenuItem.create({
    kitchen: kitchen._id, category: category._id, name: 'Pizza', price: 500, taxPercent: 0, foodLabel: 'VEG',
  });
  const admin = await createUserWithToken(ROLES.SUPER_ADMIN);
  const customer = await createUserWithToken(ROLES.CUSTOMER);
  return { kitchen, room, item, admin, customer };
}

async function makeCoupon(adminBearer: string, body: Record<string, unknown>) {
  const res = await request(app).post('/api/v1/coupons').set('Authorization', adminBearer).send(body).expect(201);
  return res.body.data.coupon;
}

describe('Coupons — admin management', () => {
  it('creates a coupon and rejects duplicates', async () => {
    const { admin } = await setup();
    await makeCoupon(admin.bearer, { code: 'SAVE10', discountType: 'PERCENT', discountValue: 10 });
    const dup = await request(app)
      .post('/api/v1/coupons')
      .set('Authorization', admin.bearer)
      .send({ code: 'save10', discountType: 'PERCENT', discountValue: 10 })
      .expect(409);
    expect(dup.body.error.code).toBe('COUPON_EXISTS');
  });

  it('forbids non-admins from creating coupons', async () => {
    const { customer } = await setup();
    await request(app)
      .post('/api/v1/coupons')
      .set('Authorization', customer.bearer)
      .send({ code: 'X1', discountType: 'FIXED', discountValue: 50 })
      .expect(403);
  });
});

describe('Coupons — validate preview', () => {
  it('previews a percentage discount with a cap', async () => {
    const { admin, customer, kitchen } = await setup();
    await makeCoupon(admin.bearer, { code: 'HALF', discountType: 'PERCENT', discountValue: 50, maxDiscount: 100 });
    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set('Authorization', customer.bearer)
      .send({ code: 'HALF', kitchen: kitchen._id.toString(), subtotal: 500 })
      .expect(200);
    expect(res.body.data.discount).toBe(100); // 50% of 500 = 250, capped at 100
  });

  it('rejects when below minimum order value', async () => {
    const { admin, customer, kitchen } = await setup();
    await makeCoupon(admin.bearer, { code: 'MIN200', discountType: 'FIXED', discountValue: 50, minOrderValue: 200 });
    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set('Authorization', customer.bearer)
      .send({ code: 'MIN200', kitchen: kitchen._id.toString(), subtotal: 150 })
      .expect(400);
    expect(res.body.error.code).toBe('COUPON_MIN_ORDER');
  });
});

describe('Coupons — applied at checkout', () => {
  async function addAndCheckout(customerBearer: string, kitchenId: string, roomId: string, itemId: string, couponCode?: string) {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', customerBearer)
      .send({ room: roomId, menuItem: itemId, quantity: 1 })
      .expect(201);
    return request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', customerBearer)
      .send({ kitchen: kitchenId, paymentMethod: 'COD', couponCode });
  }

  it('applies a fixed discount and records the redemption + usage', async () => {
    const { admin, customer, kitchen, room, item } = await setup();
    const coupon = await makeCoupon(admin.bearer, { code: 'FLAT100', discountType: 'FIXED', discountValue: 100, usageLimit: 1 });

    const res = await addAndCheckout(customer.bearer, kitchen._id.toString(), room._id.toString(), item._id.toString(), 'FLAT100');
    expect(res.status).toBe(201);
    expect(res.body.data.order.pricing.discount).toBe(100);
    expect(res.body.data.order.pricing.total).toBe(400); // 500 - 100

    const updated = await Coupon.findById(coupon._id);
    expect(updated?.usedCount).toBe(1);
  });

  it('enforces the per-user limit on a second use', async () => {
    const { admin, customer, kitchen, room, item } = await setup();
    await makeCoupon(admin.bearer, { code: 'ONCE', discountType: 'FIXED', discountValue: 50, perUserLimit: 1 });

    const first = await addAndCheckout(customer.bearer, kitchen._id.toString(), room._id.toString(), item._id.toString(), 'ONCE');
    expect(first.status).toBe(201);

    const second = await addAndCheckout(customer.bearer, kitchen._id.toString(), room._id.toString(), item._id.toString(), 'ONCE');
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('COUPON_USER_LIMIT');
  });

  it('does not consume coupon usage when the code is invalid', async () => {
    const { customer, kitchen, room, item } = await setup();
    const res = await addAndCheckout(customer.bearer, kitchen._id.toString(), room._id.toString(), item._id.toString(), 'NOPE');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COUPON_INVALID');
    expect(await Order.countDocuments({ customer: customer.user._id })).toBe(0);
  });

  it('cannot exceed the per-user limit under concurrent checkouts', async () => {
    // Ensure the unique (coupon,user) index is built before the race so the
    // atomic guard is actually enforced.
    await CouponUserCounter.init();

    const { admin, customer, kitchen, room, item } = await setup();
    const coupon = await makeCoupon(admin.bearer, {
      code: 'SOLO',
      discountType: 'FIXED',
      discountValue: 50,
      perUserLimit: 1,
      usageLimit: 5,
    });

    // One cart, two simultaneous checkouts with the same coupon.
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', customer.bearer)
      .send({ room: room._id.toString(), menuItem: item._id.toString(), quantity: 1 })
      .expect(201);

    const fire = () =>
      request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', customer.bearer)
        .send({ kitchen: kitchen._id.toString(), paymentMethod: 'COD', couponCode: 'SOLO' });
    const [a, b] = await Promise.all([fire(), fire()]);

    // Exactly one checkout applies the coupon; the other is rejected.
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]);
    const rejected = [a, b].find((r) => r.status === 400);
    expect(rejected?.body.error.code).toBe('COUPON_USER_LIMIT');

    // The per-user counter and global usage both settle at exactly one.
    const counter = await CouponUserCounter.findOne({ coupon: coupon._id, user: customer.user._id });
    expect(counter?.count).toBe(1);
    const updated = await Coupon.findById(coupon._id);
    expect(updated?.usedCount).toBe(1); // loser's reservation was released
  });
});
