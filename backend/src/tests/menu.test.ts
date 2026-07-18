import request from 'supertest';
import { createApp } from '@/app';
import { Kitchen, MenuItem } from '@/models';
import { ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

// Cloudinary is mocked so image tests never hit the network.
jest.mock('@/services/cloudinary.service', () => ({
  uploadImage: jest.fn().mockResolvedValue({ url: 'https://cdn.test/x.png', publicId: 'kds/menu/x' }),
  deleteImage: jest.fn().mockResolvedValue(undefined),
}));

const app = createApp();
const api = '/api/v1/menu';

async function setupKitchenOwner() {
  const kitchen = await Kitchen.create({ name: 'Test Kitchen', slug: `tk-${Date.now()}` });
  const { bearer } = await createUserWithToken(ROLES.KITCHEN_OWNER, {
    kitchen: kitchen._id.toString(),
  });
  return { kitchen, bearer };
}

async function createCategory(bearer: string, name = 'Starters') {
  const res = await request(app)
    .post(`${api}/categories`)
    .set('Authorization', bearer)
    .send({ name })
    .expect(201);
  return res.body.data.category;
}

describe('Menu — categories', () => {
  it('lets a kitchen owner create a category scoped to their kitchen', async () => {
    const { kitchen, bearer } = await setupKitchenOwner();
    const cat = await createCategory(bearer);
    expect(cat.kitchen).toBe(kitchen._id.toString());
    expect(cat.slug).toBe('starters');
  });

  it('forbids customers from managing the menu', async () => {
    const { bearer } = await createUserWithToken(ROLES.CUSTOMER);
    await request(app).post(`${api}/categories`).set('Authorization', bearer).send({ name: 'X' }).expect(403);
  });

  it('requires a Super Admin to specify a kitchen', async () => {
    const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
    const res = await request(app)
      .post(`${api}/categories`)
      .set('Authorization', bearer)
      .send({ name: 'Desserts' })
      .expect(400);
    expect(res.body.error.code).toBe('KITCHEN_REQUIRED');
  });

  it('refuses to delete a category that still has items', async () => {
    const { bearer } = await setupKitchenOwner();
    const cat = await createCategory(bearer);
    await request(app)
      .post(`${api}/items`)
      .set('Authorization', bearer)
      .send({ category: cat._id, name: 'Soup', price: 120 })
      .expect(201);

    const res = await request(app)
      .delete(`${api}/categories/${cat._id}`)
      .set('Authorization', bearer)
      .expect(409);
    expect(res.body.error.code).toBe('CATEGORY_NOT_EMPTY');
  });
});

describe('Menu — items', () => {
  it('creates an item and toggles stock', async () => {
    const { bearer } = await setupKitchenOwner();
    const cat = await createCategory(bearer);
    const createRes = await request(app)
      .post(`${api}/items`)
      .set('Authorization', bearer)
      .send({ category: cat._id, name: 'Paneer Tikka', price: 250, foodLabel: 'VEG', taxPercent: 5 })
      .expect(201);
    const id = createRes.body.data.item._id;

    const stockRes = await request(app)
      .patch(`${api}/items/${id}/stock`)
      .set('Authorization', bearer)
      .send({ inStock: false })
      .expect(200);
    expect(stockRes.body.data.item.inStock).toBe(false);
  });

  it('rejects an item whose category belongs to another kitchen', async () => {
    const { bearer } = await setupKitchenOwner();
    const otherKitchen = await Kitchen.create({ name: 'Other', slug: `o-${Date.now()}` });
    const { bearer: otherBearer } = await createUserWithToken(ROLES.KITCHEN_OWNER, {
      kitchen: otherKitchen._id.toString(),
    });
    const otherCat = await createCategory(otherBearer, 'OtherCat');

    const res = await request(app)
      .post(`${api}/items`)
      .set('Authorization', bearer)
      .send({ category: otherCat._id, name: 'Sneaky', price: 100 })
      .expect(400);
    expect(res.body.error.code).toBe('CATEGORY_KITCHEN_MISMATCH');
  });

  it('uploads an image via mocked Cloudinary', async () => {
    const { bearer } = await setupKitchenOwner();
    const cat = await createCategory(bearer);
    const createRes = await request(app)
      .post(`${api}/items`)
      .set('Authorization', bearer)
      .send({ category: cat._id, name: 'Burger', price: 199 })
      .expect(201);
    const id = createRes.body.data.item._id;

    const res = await request(app)
      .post(`${api}/items/${id}/image`)
      .set('Authorization', bearer)
      .attach('image', Buffer.from('fake-png-bytes'), { filename: 'b.png', contentType: 'image/png' })
      .expect(200);
    expect(res.body.data.item.image.url).toBe('https://cdn.test/x.png');
  });
});

describe('Menu — public menu', () => {
  it('returns only active, in-stock items and hides empty categories', async () => {
    const { kitchen, bearer } = await setupKitchenOwner();
    const starters = await createCategory(bearer, 'Starters');
    const empty = await createCategory(bearer, 'Empty');

    // visible item
    await request(app)
      .post(`${api}/items`)
      .set('Authorization', bearer)
      .send({ category: starters._id, name: 'Spring Roll', price: 150 })
      .expect(201);
    // out-of-stock item (should be filtered out)
    const oos = await request(app)
      .post(`${api}/items`)
      .set('Authorization', bearer)
      .send({ category: starters._id, name: 'Sold Out', price: 150 })
      .expect(201);
    await MenuItem.updateOne({ _id: oos.body.data.item._id }, { $set: { inStock: false } });

    const res = await request(app).get(`${api}/public/${kitchen._id}`).expect(200);
    const categories = res.body.data.categories;
    expect(categories).toHaveLength(1); // 'Empty' hidden
    expect(categories[0].name).toBe('Starters');
    expect(categories[0].items.map((i: { name: string }) => i.name)).toEqual(['Spring Roll']);
    // sanity: the empty category id never appears
    expect(JSON.stringify(categories)).not.toContain(empty._id);
  });

  it('404s for an inactive kitchen', async () => {
    const { kitchen } = await setupKitchenOwner();
    await Kitchen.updateOne({ _id: kitchen._id }, { $set: { isActive: false } });
    await request(app).get(`${api}/public/${kitchen._id}`).expect(404);
  });
});
