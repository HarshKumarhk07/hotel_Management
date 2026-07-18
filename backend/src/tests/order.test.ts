import request from 'supertest';
import { createApp } from '@/app';
import { Category, Kitchen, MenuItem, Order, Room } from '@/models';
import { ORDER_STATUS, PAYMENT_STATUS, REFUND_STATUS, ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();

/**
 * Build a full ordering context: kitchen (10% service charge, COD on), a room,
 * a category, two in-stock items, plus customer & staff tokens.
 */
async function setupOrdering() {
  const kitchen = await Kitchen.create({
    name: 'Order Kitchen',
    slug: `ok-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    settings: { serviceChargePercent: 10, taxPercent: 5, acceptsCOD: true, acceptsRoomBilling: false },
  });
  const room = await Room.create({
    roomNumber: `R${Math.round(Math.random() * 1e6)}`,
    floor: 1,
    kitchen: kitchen._id,
    qr: { token: `tok-${Math.round(Math.random() * 1e9)}`, isActive: true, version: 1 },
  });
  const category = await Category.create({ kitchen: kitchen._id, name: 'Mains', slug: 'mains' });
  const itemA = await MenuItem.create({
    kitchen: kitchen._id, category: category._id, name: 'Curry', price: 200, taxPercent: 5, foodLabel: 'VEG',
  });
  const itemB = await MenuItem.create({
    kitchen: kitchen._id, category: category._id, name: 'Naan', price: 50, taxPercent: 5, foodLabel: 'VEG',
  });

  const customer = await createUserWithToken(ROLES.CUSTOMER);
  const staff = await createUserWithToken(ROLES.KITCHEN_OWNER, { kitchen: kitchen._id.toString() });
  return { kitchen, room, category, itemA, itemB, customer, staff };
}

async function addToCart(bearer: string, room: string, menuItem: string, quantity = 1) {
  return request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', bearer)
    .send({ room, menuItem, quantity })
    .expect(201);
}

describe('Cart', () => {
  it('adds an item and returns a pricing preview', async () => {
    const { room, itemA, customer } = await setupOrdering();
    const res = await addToCart(customer.bearer, room._id.toString(), itemA._id.toString(), 2);
    const cart = res.body.data.cart;
    expect(cart.lines).toHaveLength(1);
    // 200*2 sub=400, tax 5% =20, service 10% of 400 =40, total=460
    expect(cart.pricing.subtotal).toBe(400);
    expect(cart.pricing.taxTotal).toBe(20);
    expect(cart.pricing.serviceCharge).toBe(40);
    expect(cart.pricing.total).toBe(460);
  });

  it('rejects an out-of-stock item', async () => {
    const { room, itemA, customer } = await setupOrdering();
    await MenuItem.updateOne({ _id: itemA._id }, { $set: { inStock: false } });
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', customer.bearer)
      .send({ room: room._id.toString(), menuItem: itemA._id.toString(), quantity: 1 })
      .expect(409);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
  });
});

describe('Checkout', () => {
  it('rejects checkout with an empty cart', async () => {
    const { kitchen, customer } = await setupOrdering();
    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', customer.bearer)
      .send({ kitchen: kitchen._id.toString(), paymentMethod: 'COD' })
      .expect(400);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });

  it('places an order, freezes pricing, and clears the cart', async () => {
    const { kitchen, room, itemA, itemB, customer } = await setupOrdering();
    await addToCart(customer.bearer, room._id.toString(), itemA._id.toString(), 1); // 200
    await addToCart(customer.bearer, room._id.toString(), itemB._id.toString(), 2); // 100

    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', customer.bearer)
      .send({ kitchen: kitchen._id.toString(), paymentMethod: 'COD', customerNote: 'No onions' })
      .expect(201);

    const order = res.body.data.order;
    expect(order.orderNumber).toMatch(/^ORD-/);
    expect(order.status).toBe(ORDER_STATUS.NEW_ORDER);
    // subtotal 300, tax 15, service 30 => 345
    expect(order.pricing.total).toBe(345);
    expect(order.roomSnapshot.roomNumber).toBe(room.roomNumber);

    // cart cleared
    const cartRes = await request(app)
      .get(`/api/v1/cart/${kitchen._id}`)
      .set('Authorization', customer.bearer)
      .expect(200);
    expect(cartRes.body.data.cart).toBeNull();
  });

  it('rejects a payment method the kitchen does not accept', async () => {
    const { kitchen, room, itemA, customer } = await setupOrdering();
    await addToCart(customer.bearer, room._id.toString(), itemA._id.toString(), 1);
    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', customer.bearer)
      .send({ kitchen: kitchen._id.toString(), paymentMethod: 'ROOM_BILLING' })
      .expect(400);
    expect(res.body.error.code).toBe('ROOM_BILLING_DISABLED');
  });
});

describe('Order lifecycle', () => {
  async function placeOrder() {
    const ctx = await setupOrdering();
    await addToCart(ctx.customer.bearer, ctx.room._id.toString(), ctx.itemA._id.toString(), 2);
    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', ctx.customer.bearer)
      .send({ kitchen: ctx.kitchen._id.toString(), paymentMethod: 'COD' })
      .expect(201);
    return { ...ctx, orderId: res.body.data.order._id };
  }

  it('advances through valid transitions and rejects invalid ones', async () => {
    const { staff, orderId } = await placeOrder();
    const patch = (status: string) =>
      request(app).patch(`/api/v1/orders/${orderId}/status`).set('Authorization', staff.bearer).send({ status });

    await patch('ACCEPTED').expect(200);
    // skipping PREPARING → READY is invalid
    const bad = await patch('READY').expect(400);
    expect(bad.body.error.code).toBe('INVALID_TRANSITION');
    await patch('PREPARING').expect(200);
    await patch('READY').expect(200);
    const delivered = await patch('DELIVERED').expect(200);
    expect(delivered.body.data.order.status).toBe('DELIVERED');
    // COD settles to PAID on delivery
    expect(delivered.body.data.order.payment.status).toBe(PAYMENT_STATUS.PAID);
  });

  it('forbids a customer from changing status or cancelling', async () => {
    const { customer, orderId } = await placeOrder();
    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', customer.bearer)
      .send({ status: 'ACCEPTED' })
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', customer.bearer)
      .send({ reason: 'changed my mind' })
      .expect(403);
  });

  it('cancels an unpaid order with no refund required', async () => {
    const { staff, orderId } = await placeOrder();
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', staff.bearer)
      .send({ reason: 'Kitchen closed' })
      .expect(200);
    expect(res.body.data.order.status).toBe(ORDER_STATUS.CANCELLED);
    expect(res.body.data.order.refund.status).toBe(REFUND_STATUS.NOT_REQUIRED);
  });

  it('partially cancels items and recomputes totals', async () => {
    const { staff, itemA, orderId } = await placeOrder(); // 2x Curry, total 460
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel-items`)
      .set('Authorization', staff.bearer)
      .send({ reason: 'One unavailable', items: [{ menuItem: itemA._id.toString(), quantity: 1 }] })
      .expect(200);
    // now 1x Curry: sub 200, tax 10, service 20 => 230
    expect(res.body.data.order.pricing.total).toBe(230);
    expect(res.body.data.order.cancellation.scope).toBe('PARTIAL');
  });

  it('keeps internal notes private from customers', async () => {
    const { staff, customer, orderId } = await placeOrder();
    await request(app)
      .post(`/api/v1/orders/${orderId}/notes`)
      .set('Authorization', staff.bearer)
      .send({ note: 'VIP guest — complimentary dessert' })
      .expect(200);

    // staff sees it
    const staffRes = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', staff.bearer).expect(200);
    expect(JSON.stringify(staffRes.body)).toContain('VIP guest');

    // customer never does
    const custRes = await request(app).get(`/api/v1/orders/my/${orderId}`).set('Authorization', customer.bearer).expect(200);
    expect(JSON.stringify(custRes.body)).not.toContain('VIP guest');
    expect(custRes.body.data.order.internalNotes).toBeUndefined();
  });

  it('isolates orders across kitchens for kitchen owners', async () => {
    const { orderId } = await placeOrder();
    const otherKitchen = await Kitchen.create({ name: 'Other', slug: `oth-${Date.now()}` });
    const otherStaff = await createUserWithToken(ROLES.KITCHEN_OWNER, { kitchen: otherKitchen._id.toString() });
    const res = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', otherStaff.bearer).expect(403);
    expect(res.body.error.code).toBe('CROSS_TENANT_DENIED');
  });
});

describe('Order history (customer)', () => {
  it('lists only the customer’s own orders', async () => {
    const { kitchen, room, itemA, customer } = await setupOrdering();
    await addToCart(customer.bearer, room._id.toString(), itemA._id.toString(), 1);
    await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', customer.bearer)
      .send({ kitchen: kitchen._id.toString(), paymentMethod: 'COD' })
      .expect(201);

    // a different customer with an order of their own
    const other = await createUserWithToken(ROLES.CUSTOMER);
    await Order.create({
      orderNumber: 'ORD-OTHER01', kitchen: kitchen._id, room: room._id,
      roomSnapshot: { roomNumber: room.roomNumber, floor: 1 }, customer: other.user._id,
      items: [{ menuItem: itemA._id, name: 'Curry', foodLabel: 'VEG', unitPrice: 200, taxPercent: 5, quantity: 1, cancelledQuantity: 0, lineSubtotal: 200, lineTax: 10, lineTotal: 210 }],
      pricing: { subtotal: 200, taxTotal: 10, serviceCharge: 20, discount: 0, total: 230, currency: 'INR' },
      payment: { method: 'COD', status: 'PENDING', amount: 230, currency: 'INR' },
      refund: { status: 'NOT_REQUIRED', amount: 0 },
    });

    const res = await request(app).get('/api/v1/orders/my').set('Authorization', customer.bearer).expect(200);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });
});
