import request from 'supertest';
import { createApp } from '@/app';
import { Category, Kitchen, MenuItem, Order, Room } from '@/models';
import { REFUND_STATUS, ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();

describe('Kitchen Owner Access Control & Features', () => {
  let kitchen1: any;
  let kitchen2: any;
  let owner1: any;
  let owner2: any;
  let room1: any;
  let category1: any;
  let item1: any;

  beforeEach(async () => {
    // Setup kitchen 1 (omit timings so it is always open)
    kitchen1 = await Kitchen.create({
      name: 'Kitchen One',
      slug: `k1-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      settings: { serviceChargePercent: 10, taxPercent: 5, acceptsCOD: true, acceptsRoomBilling: false },
    });
    owner1 = await createUserWithToken(ROLES.KITCHEN_OWNER, { kitchen: kitchen1._id.toString() });

    // Setup kitchen 2 (omit timings so it is always open)
    kitchen2 = await Kitchen.create({
      name: 'Kitchen Two',
      slug: `k2-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      settings: { serviceChargePercent: 10, taxPercent: 5, acceptsCOD: true, acceptsRoomBilling: false },
    });
    owner2 = await createUserWithToken(ROLES.KITCHEN_OWNER, { kitchen: kitchen2._id.toString() });

    // Setup menu item on kitchen 1
    category1 = await Category.create({ kitchen: kitchen1._id, name: 'Mains', slug: 'mains-1' });
    item1 = await MenuItem.create({
      kitchen: kitchen1._id,
      category: category1._id,
      name: 'Dish One',
      price: 200,
      taxPercent: 5,
      foodLabel: 'VEG',
      stockQuantity: 10,
    });

    room1 = await Room.create({
      roomNumber: `R-${Math.round(Math.random() * 1e6)}`,
      floor: 1,
      kitchen: kitchen1._id,
      qr: { token: `tok-${Math.round(Math.random() * 1e9)}`, isActive: true, version: 1 },
    });
  });

  describe('Isolation: Kitchen and Settings Access', () => {
    it('allows a kitchen owner to view their own kitchen', async () => {
      await request(app)
        .get(`/api/v1/kitchens/${kitchen1._id}`)
        .set('Authorization', owner1.bearer)
        .expect(200);
    });

    it('blocks a kitchen owner from viewing another kitchen', async () => {
      const res = await request(app)
        .get(`/api/v1/kitchens/${kitchen2._id}`)
        .set('Authorization', owner1.bearer)
        .expect(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_DENIED');
    });

    it('allows a kitchen owner to update their own kitchen settings', async () => {
      await request(app)
        .patch(`/api/v1/kitchens/${kitchen1._id}`)
        .set('Authorization', owner1.bearer)
        .send({ description: 'New Description' })
        .expect(200);
      const updated = await Kitchen.findById(kitchen1._id);
      expect(updated?.description).toBe('New Description');
    });

    it('blocks a kitchen owner from updating another kitchen settings', async () => {
      const res = await request(app)
        .patch(`/api/v1/kitchens/${kitchen2._id}`)
        .set('Authorization', owner1.bearer)
        .send({ description: 'Attacked description' })
        .expect(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_DENIED');
    });

    it('blocks a kitchen owner from getting another kitchen\'s dashboard', async () => {
      const res = await request(app)
        .get(`/api/v1/kitchens/my-kitchen/dashboard?kitchen=${kitchen2._id}`)
        .set('Authorization', owner1.bearer)
        .expect(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_DENIED');
    });
  });

  describe('Isolation: Menu Management', () => {
    it('blocks a kitchen owner from creating categories on another kitchen', async () => {
      const res = await request(app)
        .post('/api/v1/menu/categories')
        .set('Authorization', owner1.bearer)
        .send({ kitchen: kitchen2._id.toString(), name: 'Hacked Cat', slug: 'hacked' })
        .expect(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_DENIED');
    });

    it('blocks a kitchen owner from editing categories of another kitchen', async () => {
      const category2 = await Category.create({ kitchen: kitchen2._id, name: 'Desserts', slug: 'desserts' });
      const res = await request(app)
        .patch(`/api/v1/menu/categories/${category2._id}`)
        .set('Authorization', owner1.bearer)
        .send({ name: 'Hacked Name' })
        .expect(403);
      expect(res.body.error.code).toBe('CROSS_TENANT_DENIED');
    });
  });

  describe('Ordering and Kitchen Availability', () => {
    it('prevents checkout if kitchen is temporarily closed', async () => {
      // Temporarily close kitchen1
      await Kitchen.updateOne({ _id: kitchen1._id }, { $set: { temporarilyClosed: true } });

      const customer = await createUserWithToken(ROLES.CUSTOMER);
      
      // Add to cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', customer.bearer)
        .send({ room: room1._id.toString(), menuItem: item1._id.toString(), quantity: 1 })
        .expect(201);

      // Checkout should fail
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', customer.bearer)
        .send({ kitchen: kitchen1._id.toString(), paymentMethod: 'COD' })
        .expect(400);

      expect(res.body.error.code).toBe('KITCHEN_CLOSED');
    });

    it('prevents checkout if item stock is exhausted', async () => {
      // Set stock quantity to 0
      await MenuItem.updateOne({ _id: item1._id }, { $set: { stockQuantity: 0, inStock: false } });

      const customer = await createUserWithToken(ROLES.CUSTOMER);
      
      // Try to add to cart, should fail with OUT_OF_STOCK
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', customer.bearer)
        .send({ room: room1._id.toString(), menuItem: item1._id.toString(), quantity: 1 })
        .expect(409);

      expect(res.body.error.code).toBe('OUT_OF_STOCK');
    });

    it('decrements stock on successful checkout', async () => {
      const customer = await createUserWithToken(ROLES.CUSTOMER);
      
      // Add to cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', customer.bearer)
        .send({ room: room1._id.toString(), menuItem: item1._id.toString(), quantity: 3 })
        .expect(201);

      // Checkout
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', customer.bearer)
        .send({ kitchen: kitchen1._id.toString(), paymentMethod: 'COD' });

      if (res.status !== 201) {
        console.error('CHECKOUT FAIL DETAILS:', res.body);
      }
      expect(res.status).toBe(201);

      // Verify stock decremented to 7 (10 - 3)
      const updatedItem = await MenuItem.findById(item1._id);
      expect(updatedItem?.stockQuantity).toBe(7);
      expect(updatedItem?.inStock).toBe(true);
    });

    it('turns inStock false when stock quantity is reduced to 0', async () => {
      const customer = await createUserWithToken(ROLES.CUSTOMER);
      
      // Add to cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', customer.bearer)
        .send({ room: room1._id.toString(), menuItem: item1._id.toString(), quantity: 10 })
        .expect(201);

      // Checkout
      const res = await request(app)
        .post('/api/v1/orders/checkout')
        .set('Authorization', customer.bearer)
        .send({ kitchen: kitchen1._id.toString(), paymentMethod: 'COD' });

      if (res.status !== 201) {
        console.error('CHECKOUT ZERO FAIL DETAILS:', res.body);
      }
      expect(res.status).toBe(201);

      // Verify stock decremented to 0 and inStock is false
      const updatedItem = await MenuItem.findById(item1._id);
      expect(updatedItem?.stockQuantity).toBe(0);
      expect(updatedItem?.inStock).toBe(false);
    });
  });

  describe('Refund Requests Lifecycle', () => {
    let order: any;

    beforeEach(async () => {
      // Create a paid order
      order = await Order.create({
        orderNumber: `ORD-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
        kitchen: kitchen1._id,
        room: room1._id,
        roomSnapshot: { roomNumber: room1.roomNumber, floor: 1 },
        customer: owner1.user._id,
        items: [{
          menuItem: item1._id,
          name: item1.name,
          foodLabel: item1.foodLabel,
          unitPrice: item1.price,
          taxPercent: item1.taxPercent,
          quantity: 1,
          cancelledQuantity: 0,
          lineSubtotal: 200,
          lineTax: 10,
          lineTotal: 210,
        }],
        pricing: { subtotal: 200, taxTotal: 10, serviceCharge: 20, discount: 0, total: 230, currency: 'INR' },
        payment: { method: 'RAZORPAY', status: 'PAID', amount: 230, currency: 'INR', razorpayOrderId: 'fake-rzp-order' },
        refund: { status: 'NOT_REQUIRED', amount: 0 },
      });
    });

    it('allows a kitchen owner to request a refund for their kitchen\'s order', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/refund-request`)
        .set('Authorization', owner1.bearer)
        .send({ reason: 'Item out of stock' })
        .expect(200);

      expect(res.body.data.order.refund.status).toBe(REFUND_STATUS.REQUESTED);
      expect(res.body.data.order.refund.reason).toBe('Item out of stock');
    });

    it('blocks a kitchen owner from requesting a refund for another kitchen\'s order', async () => {
      const otherOrder = await Order.create({
        orderNumber: `ORD-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
        kitchen: kitchen2._id,
        room: room1._id,
        roomSnapshot: { roomNumber: 'Room 2', floor: 1 },
        customer: owner2.user._id,
        items: [{
          menuItem: item1._id,
          name: item1.name,
          foodLabel: item1.foodLabel,
          unitPrice: item1.price,
          taxPercent: item1.taxPercent,
          quantity: 1,
          cancelledQuantity: 0,
          lineSubtotal: 200,
          lineTax: 10,
          lineTotal: 210,
        }],
        pricing: { subtotal: 200, taxTotal: 10, serviceCharge: 20, discount: 0, total: 230, currency: 'INR' },
        payment: { method: 'RAZORPAY', status: 'PAID', amount: 230, currency: 'INR' },
        refund: { status: 'NOT_REQUIRED', amount: 0 },
      });

      const res = await request(app)
        .post(`/api/v1/orders/${otherOrder._id}/refund-request`)
        .set('Authorization', owner1.bearer)
        .send({ reason: 'Attempt hack' })
        .expect(403);

      expect(res.body.error.code).toBe('CROSS_TENANT_DENIED');
    });

    it('allows a Super Admin to approve a refund and blocks Kitchen Owner from doing so', async () => {
      // First make a refund request
      await request(app)
        .post(`/api/v1/orders/${order._id}/refund-request`)
        .set('Authorization', owner1.bearer)
        .send({ reason: 'Item out of stock' })
        .expect(200);

      // Kitchen owner tries to approve, should fail with 403
      await request(app)
        .post(`/api/v1/orders/${order._id}/refund-approve`)
        .set('Authorization', owner1.bearer)
        .expect(403);

      // Super admin approves
      const superAdmin = await createUserWithToken(ROLES.SUPER_ADMIN);
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/refund-approve`)
        .set('Authorization', superAdmin.bearer)
        .expect(200);

      expect(res.body.data.order.refund.status).toBe(REFUND_STATUS.REFUNDED);
    });

    it('allows a Super Admin to reject a refund request', async () => {
      // Make a refund request
      await request(app)
        .post(`/api/v1/orders/${order._id}/refund-request`)
        .set('Authorization', owner1.bearer)
        .send({ reason: 'Item out of stock' })
        .expect(200);

      const superAdmin = await createUserWithToken(ROLES.SUPER_ADMIN);
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/refund-reject`)
        .set('Authorization', superAdmin.bearer)
        .send({ reason: 'Invalid claim' })
        .expect(200);

      expect(res.body.data.order.refund.status).toBe(REFUND_STATUS.NOT_REQUIRED);
    });
  });

  describe('Internal Notes and Categorization', () => {
    let order: any;

    beforeEach(async () => {
      order = await Order.create({
        orderNumber: `ORD-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
        kitchen: kitchen1._id,
        room: room1._id,
        roomSnapshot: { roomNumber: room1.roomNumber, floor: 1 },
        customer: owner1.user._id,
        items: [{
          menuItem: item1._id,
          name: item1.name,
          foodLabel: item1.foodLabel,
          unitPrice: item1.price,
          taxPercent: item1.taxPercent,
          quantity: 1,
          cancelledQuantity: 0,
          lineSubtotal: 200,
          lineTax: 10,
          lineTotal: 210,
        }],
        pricing: { subtotal: 200, taxTotal: 10, serviceCharge: 20, discount: 0, total: 230, currency: 'INR' },
        payment: { method: 'COD', status: 'PENDING', amount: 230, currency: 'INR' },
        refund: { status: 'NOT_REQUIRED', amount: 0 },
      });
    });

    it('allows adding internal note with category and type', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/notes`)
        .set('Authorization', owner1.bearer)
        .send({ note: 'Cook medium rare', noteType: 'PREPARATION' })
        .expect(200);

      const notes = res.body.data.order.internalNotes;
      expect(notes).toHaveLength(1);
      expect(notes[0].note).toBe('Cook medium rare');
      expect(notes[0].noteType).toBe('PREPARATION');
    });

    it('defaults internal note type to REMARK if not provided', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/notes`)
        .set('Authorization', owner1.bearer)
        .send({ note: 'General note' })
        .expect(200);

      const notes = res.body.data.order.internalNotes;
      expect(notes).toHaveLength(1);
      expect(notes[0].note).toBe('General note');
      expect(notes[0].noteType).toBe('REMARK');
    });
  });
});
