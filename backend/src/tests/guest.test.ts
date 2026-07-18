import request from 'supertest';
import { createApp } from '@/app';
import {
  Category,
  Kitchen,
  MenuItem,
  Order,
  Room,
  User,
  VerificationToken,
} from '@/models';
import { AUTH_PROVIDERS, ROLES, TOKEN_TYPES } from '@/constants';
import { generateSecureToken } from '@/utils/crypto';
import { signAccessToken } from '@/utils/jwt';

const app = createApp();
const rand = () => Math.round(Math.random() * 1e9);

async function setupKitchen() {
  const kitchen = await Kitchen.create({
    name: 'Guest Kitchen',
    slug: `gk-${Date.now()}-${rand()}`,
    settings: { serviceChargePercent: 0, taxPercent: 0, acceptsCOD: true, acceptsRoomBilling: false },
  });
  const room = await Room.create({
    roomNumber: `R${rand()}`,
    floor: 1,
    kitchen: kitchen._id,
    qr: { token: `tok-${rand()}`, isActive: true, version: 1 },
  });
  const category = await Category.create({ kitchen: kitchen._id, name: 'Mains', slug: 'mains' });
  const item = await MenuItem.create({
    kitchen: kitchen._id,
    category: category._id,
    name: 'Biryani',
    price: 250,
    taxPercent: 0,
    foodLabel: 'VEG',
  });
  return { kitchen, room, item };
}

function guestBody(
  kitchen: { _id: unknown },
  room: { _id: unknown },
  item: { _id: unknown },
  overrides: Record<string, unknown> = {},
) {
  return {
    kitchen: String(kitchen._id),
    room: String(room._id),
    items: [{ menuItem: String(item._id), quantity: 2 }],
    guest: { name: 'Guest Gourmet', email: 'guest@example.com', phone: '+91 98765 43210' },
    paymentMethod: 'COD',
    ...overrides,
  };
}

/** Create a user directly with full control over verification/phone. */
async function makeUser(opts: { email: string; phone?: string; verified?: boolean }) {
  const user = new User({
    name: 'Account Holder',
    email: opts.email,
    phone: opts.phone,
    role: ROLES.CUSTOMER,
    provider: AUTH_PROVIDERS.LOCAL,
    isEmailVerified: opts.verified ?? true,
  });
  (user as typeof user & { password?: string }).password = 'Str0ng!Pass';
  await user.save();
  return user;
}

function bearerFor(user: { _id: unknown; role: string; email: string }) {
  return `Bearer ${signAccessToken({ sub: String(user._id), role: user.role as never, email: user.email })}`;
}

describe('Guest checkout', () => {
  it('places an order with no authentication and returns an access token', async () => {
    const { kitchen, room, item } = await setupKitchen();
    const res = await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item))
      .expect(201);

    expect(res.body.data.guestAccessToken).toEqual(expect.any(String));
    expect(res.body.data.order.pricing.total).toBe(500); // 250 × 2, server-computed
    expect(res.body.data.order.guestInfo.email).toBe('guest@example.com');

    const order = await Order.findById(res.body.data.order._id).select('+guestAccessTokenHash');
    expect(order?.customer).toBeUndefined();
    expect(order?.linkedToAccount).toBe(false);
    expect(order?.guestAccessTokenHash).toEqual(expect.any(String));
    // The raw token is never persisted.
    expect(order?.guestAccessTokenHash).not.toBe(res.body.data.guestAccessToken);
  });

  it('rejects an invalid email', async () => {
    const { kitchen, room, item } = await setupKitchen();
    await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item, { guest: { name: 'X', email: 'not-an-email', phone: '9876543210' } }))
      .expect(400);
  });

  it('rejects an empty cart', async () => {
    const { kitchen, room, item } = await setupKitchen();
    await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item, { items: [] }))
      .expect(400);
  });
});

describe('Guest order tracking', () => {
  it('tracks an order by its access token, and 404s on a bad token', async () => {
    const { kitchen, room, item } = await setupKitchen();
    const res = await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item))
      .expect(201);
    const token = res.body.data.guestAccessToken as string;
    const orderNumber = res.body.data.order.orderNumber as string;

    const tracked = await request(app).get(`/api/v1/orders/track/${token}`).expect(200);
    expect(tracked.body.data.order.orderNumber).toBe(orderNumber);
    // Internal token hash never leaks to the client.
    expect(tracked.body.data.order.guestAccessTokenHash).toBeUndefined();

    await request(app).get(`/api/v1/orders/track/${'a'.repeat(64)}`).expect(404);
  });
});

describe('Automatic order linking', () => {
  it('links prior guest orders on login (verified email match)', async () => {
    const { kitchen, room, item } = await setupKitchen();
    const email = `buyer-${rand()}@example.com`;
    const user = await makeUser({ email });

    const res = await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item, { guest: { name: 'Buyer', email, phone: '9000000001' } }))
      .expect(201);
    const orderId = res.body.data.order._id as string;

    // Logging in triggers linking.
    await request(app).post('/api/v1/auth/login').send({ email, password: 'Str0ng!Pass' }).expect(200);

    const order = await Order.findById(orderId);
    expect(order?.customer?.toString()).toBe(user._id.toString());
    expect(order?.linkedToAccount).toBe(true);

    // And it now shows up in the account's order history.
    const mine = await request(app)
      .get('/api/v1/orders/my')
      .set('Authorization', bearerFor(user))
      .expect(200);
    expect(mine.body.data.orders.map((o: { _id: string }) => o._id)).toContain(orderId);
  });

  it('links prior guest orders when the email is verified', async () => {
    const { kitchen, room, item } = await setupKitchen();
    const email = `verify-${rand()}@example.com`;
    const user = await makeUser({ email, verified: false });

    const res = await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item, { guest: { name: 'Vee', email, phone: '9000000002' } }))
      .expect(201);
    const orderId = res.body.data.order._id as string;

    // Craft a real verification token for this user and hit the endpoint.
    const { raw, hash } = generateSecureToken();
    await VerificationToken.create({
      user: user._id,
      type: TOKEN_TYPES.EMAIL_VERIFY,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await request(app).post('/api/v1/auth/verify-email').send({ token: raw }).expect(200);

    const order = await Order.findById(orderId);
    expect(order?.customer?.toString()).toBe(user._id.toString());
    expect(order?.linkedToAccount).toBe(true);
  });

  it('does NOT link before the email is verified', async () => {
    const { kitchen, room, item } = await setupKitchen();
    const email = `unverified-${rand()}@example.com`;
    const user = await makeUser({ email, verified: false });

    const res = await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item, { guest: { name: 'Uma', email, phone: '9000000003' } }))
      .expect(201);
    const orderId = res.body.data.order._id as string;

    const link = await request(app)
      .post('/api/v1/orders/link-guest-orders')
      .set('Authorization', bearerFor(user))
      .expect(200);
    expect(link.body.data.linked).toBe(0);

    const order = await Order.findById(orderId);
    expect(order?.customer).toBeUndefined();
    expect(order?.linkedToAccount).toBe(false);
  });

  it('links by normalized phone (secondary match) even with a different email', async () => {
    const { kitchen, room, item } = await setupKitchen();
    // Guest used a different email but the same phone (formatted differently).
    await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item, { guest: { name: 'Pat', email: `guest-${rand()}@example.com`, phone: '+91 91234 56789' } }))
      .expect(201);

    const user = await makeUser({ email: `acct-${rand()}@example.com`, phone: '9123456789' });
    const link = await request(app)
      .post('/api/v1/orders/link-guest-orders')
      .set('Authorization', bearerFor(user))
      .expect(200);
    expect(link.body.data.linked).toBe(1);
  });

  it('never claims another person\'s orders (no email/phone overlap)', async () => {
    const { kitchen, room, item } = await setupKitchen();
    await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item, { guest: { name: 'Ann', email: `a-${rand()}@example.com`, phone: '9111111111' } }))
      .expect(201);

    const stranger = await makeUser({ email: `b-${rand()}@example.com`, phone: '9222222222' });
    const link = await request(app)
      .post('/api/v1/orders/link-guest-orders')
      .set('Authorization', bearerFor(stranger))
      .expect(200);
    expect(link.body.data.linked).toBe(0);
  });

  it('is idempotent — re-linking claims nothing new', async () => {
    const { kitchen, room, item } = await setupKitchen();
    const email = `idem-${rand()}@example.com`;
    const user = await makeUser({ email });
    await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send(guestBody(kitchen, room, item, { guest: { name: 'Ida', email, phone: '9333333333' } }))
      .expect(201);

    const first = await request(app)
      .post('/api/v1/orders/link-guest-orders')
      .set('Authorization', bearerFor(user))
      .expect(200);
    expect(first.body.data.linked).toBe(1);

    const second = await request(app)
      .post('/api/v1/orders/link-guest-orders')
      .set('Authorization', bearerFor(user))
      .expect(200);
    expect(second.body.data.linked).toBe(0);

    expect(await Order.countDocuments({ customer: user._id })).toBe(1);
  });
});
