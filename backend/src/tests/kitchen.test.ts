import request from 'supertest';
import { createApp } from '@/app';
import { Kitchen, User } from '@/models';
import { ROLES } from '@/constants';
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
