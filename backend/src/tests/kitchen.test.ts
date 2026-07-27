import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '@/app';
import { Kitchen, User, Order } from '@/models';
import { ROLES, PAYMENT_METHODS } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();
const api = '/api/v1/kitchens';

describe('Kitchens — RBAC', () => {
  it('rejects unauthenticated access', async () => {
    await request(app).get(api).expect(401);
  });

  it('forbids non-admin roles', async () => {
    const { bearer } = await createUserWithToken(ROLES.CUSTOMER);
    const res = await request(app).get(api).set('Authorization', bearer).expect(403);
    expect(res.body.error.code).toBe('RBAC_DENIED');
  });
});

describe('Kitchens — CRUD (Super Admin)', () => {
  it('creates a kitchen and provisions its owner account', async () => {
    const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
    const res = await request(app)
      .post(api)
      .set('Authorization', bearer)
      .send({
        name: 'Rooftop Grill',
        owner: { name: 'Owner One', email: 'owner1@example.com', password: 'Str0ng!Pass' },
      })
      .expect(201);

    expect(res.body.data.kitchen.slug).toBe('rooftop-grill');

    const owner = await User.findOne({ email: 'owner1@example.com' });
    expect(owner?.role).toBe(ROLES.KITCHEN_OWNER);
    expect(owner?.isEmailVerified).toBe(true);
    expect(owner?.kitchen?.toString()).toBe(res.body.data.kitchen.id ?? res.body.data.kitchen._id);
  });

  it('generates unique slugs for duplicate names', async () => {
    const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
    await request(app).post(api).set('Authorization', bearer).send({ name: 'Cafe' }).expect(201);
    const res = await request(app).post(api).set('Authorization', bearer).send({ name: 'Cafe' }).expect(201);
    expect(res.body.data.kitchen.slug).toBe('cafe-1');
  });

  it('deactivating a kitchen also disables the owner login', async () => {
    const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
    const createRes = await request(app)
      .post(api)
      .set('Authorization', bearer)
      .send({
        name: 'Night Diner',
        owner: { name: 'Owner Two', email: 'owner2@example.com', password: 'Str0ng!Pass' },
      })
      .expect(201);
    const id = createRes.body.data.kitchen._id ?? createRes.body.data.kitchen.id;


    await request(app).patch(`${api}/${id}/deactivate`).set('Authorization', bearer).expect(200);

    const kitchen = await Kitchen.findById(id);
    const owner = await User.findOne({ email: 'owner2@example.com' }).select('+isActive');
    expect(kitchen?.isActive).toBe(false);
    expect(owner?.isActive).toBe(false);
  });

  it('lists kitchens with pagination metadata', async () => {
    const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
    await request(app).post(api).set('Authorization', bearer).send({ name: 'K1' }).expect(201);
    const res = await request(app).get(`${api}?limit=10`).set('Authorization', bearer).expect(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.kitchens).toBeInstanceOf(Array);
  });
});

describe('Kitchens — delete', () => {
  it('deletes a kitchen and its provisioned owner when it has no orders', async () => {
    const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
    const createRes = await request(app)
      .post(api)
      .set('Authorization', bearer)
      .send({
        name: 'Deletable Kitchen',
        owner: { name: 'Del Owner', email: 'del-owner@example.com', password: 'Str0ng!Pass' },
      })
      .expect(201);
    const id = createRes.body.data.kitchen._id ?? createRes.body.data.kitchen.id;

    await request(app).delete(`${api}/${id}`).set('Authorization', bearer).expect(204);

    expect(await Kitchen.findById(id)).toBeNull();
    expect(await User.findOne({ email: 'del-owner@example.com' })).toBeNull();
  });

  it('refuses to delete a kitchen that has orders', async () => {
    const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
    const createRes = await request(app)
      .post(api)
      .set('Authorization', bearer)
      .send({ name: 'Busy Kitchen' })
      .expect(201);
    const id = createRes.body.data.kitchen._id ?? createRes.body.data.kitchen.id;

    await Order.create({
      orderNumber: `DEL-${Date.now()}`,
      kitchen: id,
      table: new Types.ObjectId(),
      guestInfo: { name: 'Guest', email: 'guest-del@example.com', phone: '9876543210' },
      items: [
        {
          menuItem: new Types.ObjectId(),
          name: 'Test Item',
          foodLabel: 'VEG',
          unitPrice: 100,
          taxPercent: 5,
          quantity: 1,
          lineSubtotal: 100,
          lineTax: 5,
          lineTotal: 105,
        },
      ],
      pricing: { subtotal: 100, taxTotal: 5, serviceCharge: 0, discount: 0, total: 105 },
      payment: { method: PAYMENT_METHODS.COD, amount: 105 },
    });

    const res = await request(app).delete(`${api}/${id}`).set('Authorization', bearer).expect(409);
    expect(res.body.error.code).toBe('KITCHEN_HAS_ORDERS');
    expect(await Kitchen.findById(id)).not.toBeNull();
  });

  it('forbids a kitchen owner from deleting kitchens', async () => {
    const { bearer } = await createUserWithToken(ROLES.KITCHEN_OWNER);
    const id = new Types.ObjectId().toString();
    await request(app).delete(`${api}/${id}`).set('Authorization', bearer).expect(403);
  });
});
