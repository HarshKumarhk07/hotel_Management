import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '@/app';
import { Category, Kitchen, MenuItem, Order, Room } from '@/models';
import { PAYMENT_STATUS, REFUND_STATUS, ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

// Mock the Razorpay SDK client (order/refund creation) — signatures stay real.
// A single shared client (and shared spies) lets us assert how many times the
// gateway was actually hit, which is how we prove a refund runs at most once.
jest.mock('@/config/razorpay', () => {
  const client = {
    orders: {
      create: jest.fn(async (opts: { amount: number; currency: string }) => ({
        id: 'order_TEST123',
        amount: opts.amount,
        currency: opts.currency,
      })),
    },
    payments: {
      refund: jest.fn(async () => ({ id: 'rfnd_TEST123', status: 'processed' })),
    },
  };
  return { isRazorpayConfigured: () => true, getRazorpay: () => client, __client: client };
});

// Handle to the shared refund spy for call-count assertions.
const razorpayMock = jest.requireMock('@/config/razorpay') as {
  __client: { payments: { refund: jest.Mock } };
};

const app = createApp();
const KEY_SECRET = 'rzp_test_secret';
const WEBHOOK_SECRET = 'rzp_webhook_secret';

function paymentSig(orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}
function webhookSig(rawBody: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

async function placeRazorpayOrder() {
  const kitchen = await Kitchen.create({
    name: 'Pay Kitchen',
    slug: `pk-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    settings: { serviceChargePercent: 0, taxPercent: 0, acceptsCOD: true, acceptsRoomBilling: false },
  });
  const room = await Room.create({
    roomNumber: `R${Math.round(Math.random() * 1e6)}`,
    floor: 1,
    kitchen: kitchen._id,
    qr: { token: `tok-${Math.round(Math.random() * 1e9)}`, isActive: true, version: 1 },
  });
  const category = await Category.create({ kitchen: kitchen._id, name: 'Mains', slug: 'mains' });
  const item = await MenuItem.create({
    kitchen: kitchen._id, category: category._id, name: 'Thali', price: 300, taxPercent: 0, foodLabel: 'VEG',
  });
  const customer = await createUserWithToken(ROLES.CUSTOMER);
  const staff = await createUserWithToken(ROLES.KITCHEN_OWNER, { kitchen: kitchen._id.toString() });

  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', customer.bearer)
    .send({ room: room._id.toString(), menuItem: item._id.toString(), quantity: 1 })
    .expect(201);

  const res = await request(app)
    .post('/api/v1/orders/checkout')
    .set('Authorization', customer.bearer)
    .send({ kitchen: kitchen._id.toString(), paymentMethod: 'RAZORPAY' })
    .expect(201);

  return { kitchen, customer, staff, orderId: res.body.data.order._id as string };
}

describe('Payments — Razorpay order + verification', () => {
  it('creates a Razorpay order for a pending KDS order', async () => {
    const { customer, orderId } = await placeRazorpayOrder();
    const res = await request(app)
      .post(`/api/v1/payments/orders/${orderId}/razorpay`)
      .set('Authorization', customer.bearer)
      .expect(200);
    expect(res.body.data.razorpayOrderId).toBe('order_TEST123');
    expect(res.body.data.amount).toBe(30000); // 300 INR → paise
    expect(res.body.data.keyId).toBeDefined();
  });

  it('verifies a valid signature and marks the order paid', async () => {
    const { customer, orderId } = await placeRazorpayOrder();
    await request(app).post(`/api/v1/payments/orders/${orderId}/razorpay`).set('Authorization', customer.bearer).expect(200);

    const paymentId = 'pay_TEST999';
    const res = await request(app)
      .post(`/api/v1/payments/orders/${orderId}/verify`)
      .set('Authorization', customer.bearer)
      .send({
        razorpayOrderId: 'order_TEST123',
        razorpayPaymentId: paymentId,
        razorpaySignature: paymentSig('order_TEST123', paymentId),
      })
      .expect(200);
    expect(res.body.data.payment.status).toBe(PAYMENT_STATUS.PAID);

    const order = await Order.findById(orderId);
    expect(order?.payment.razorpayPaymentId).toBe(paymentId);
    expect(order?.payment.paidAt).toBeDefined();
  });

  it('rejects a forged signature and does not mark paid', async () => {
    const { customer, orderId } = await placeRazorpayOrder();
    await request(app).post(`/api/v1/payments/orders/${orderId}/razorpay`).set('Authorization', customer.bearer).expect(200);

    const res = await request(app)
      .post(`/api/v1/payments/orders/${orderId}/verify`)
      .set('Authorization', customer.bearer)
      .send({
        razorpayOrderId: 'order_TEST123',
        razorpayPaymentId: 'pay_X',
        razorpaySignature: 'deadbeef'.repeat(8),
      })
      .expect(400);
    expect(res.body.error.code).toBe('SIGNATURE_INVALID');

    const order = await Order.findById(orderId);
    expect(order?.payment.status).toBe(PAYMENT_STATUS.PENDING);
  });
});

describe('Payments — webhook', () => {
  it('marks an order paid on a signed payment.captured event', async () => {
    const { customer, orderId } = await placeRazorpayOrder();
    await request(app).post(`/api/v1/payments/orders/${orderId}/razorpay`).set('Authorization', customer.bearer).expect(200);

    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_HOOK1', order_id: 'order_TEST123' } } },
    });
    await request(app)
      .post('/api/v1/payments/webhook')
      .set('X-Razorpay-Signature', webhookSig(body))
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);

    const order = await Order.findById(orderId);
    expect(order?.payment.status).toBe(PAYMENT_STATUS.PAID);
  });

  it('rejects a webhook with a bad signature', async () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    await request(app)
      .post('/api/v1/payments/webhook')
      .set('X-Razorpay-Signature', 'wrong')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(401);
  });
});

describe('Payments — refund', () => {
  it('processes a refund after a paid order is cancelled', async () => {
    const { customer, staff, orderId } = await placeRazorpayOrder();
    await request(app).post(`/api/v1/payments/orders/${orderId}/razorpay`).set('Authorization', customer.bearer).expect(200);
    const paymentId = 'pay_REFUND1';
    await request(app)
      .post(`/api/v1/payments/orders/${orderId}/verify`)
      .set('Authorization', customer.bearer)
      .send({ razorpayOrderId: 'order_TEST123', razorpayPaymentId: paymentId, razorpaySignature: paymentSig('order_TEST123', paymentId) })
      .expect(200);

    // Staff cancels the now-paid order → refund INITIATED
    await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', staff.bearer)
      .send({ reason: 'Out of stock' })
      .expect(200);

    const res = await request(app)
      .post(`/api/v1/payments/orders/${orderId}/refund`)
      .set('Authorization', staff.bearer)
      .send({})
      .expect(200);
    expect(res.body.data.refund.status).toBe(REFUND_STATUS.REFUNDED);
    expect(res.body.data.refund.razorpayRefundId).toBe('rfnd_TEST123');
    expect(res.body.data.payment.status).toBe(PAYMENT_STATUS.REFUNDED);
  });

  it('refuses a refund when none is due', async () => {
    const { staff, orderId } = await placeRazorpayOrder(); // unpaid → no refund
    const res = await request(app)
      .post(`/api/v1/payments/orders/${orderId}/refund`)
      .set('Authorization', staff.bearer)
      .send({})
      .expect(400);
    expect(res.body.error.code).toBe('NO_REFUND_DUE');
  });

  it('processes at most one refund under concurrent requests', async () => {
    razorpayMock.__client.payments.refund.mockClear();

    const { customer, staff, orderId } = await placeRazorpayOrder();
    await request(app)
      .post(`/api/v1/payments/orders/${orderId}/razorpay`)
      .set('Authorization', customer.bearer)
      .expect(200);
    const paymentId = 'pay_CONCURRENT';
    await request(app)
      .post(`/api/v1/payments/orders/${orderId}/verify`)
      .set('Authorization', customer.bearer)
      .send({
        razorpayOrderId: 'order_TEST123',
        razorpayPaymentId: paymentId,
        razorpaySignature: paymentSig('order_TEST123', paymentId),
      })
      .expect(200);

    // Paid → cancel stages the refund (INITIATED).
    await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', staff.bearer)
      .send({ reason: 'Kitchen closed' })
      .expect(200);

    // Fire two refund requests simultaneously for the same order.
    const fire = () =>
      request(app)
        .post(`/api/v1/payments/orders/${orderId}/refund`)
        .set('Authorization', staff.bearer)
        .send({});
    const [a, b] = await Promise.all([fire(), fire()]);

    // Exactly one succeeds; the other is rejected (409 — already claimed/refunded).
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    // The gateway was invoked exactly once → no double refund.
    expect(razorpayMock.__client.payments.refund).toHaveBeenCalledTimes(1);

    const order = await Order.findById(orderId);
    expect(order?.refund.status).toBe(REFUND_STATUS.REFUNDED);
    expect(order?.payment.status).toBe(PAYMENT_STATUS.REFUNDED);
  });
});
