import request from 'supertest';
import { createApp } from '@/app';
import { Kitchen } from '@/models';
import { ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();
const api = '/api/v1/banners';

async function adminBearer() {
  const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
  return bearer;
}

async function prepareKitchen() {
  return Kitchen.create({
    name: 'Test Banner Kitchen',
    slug: 'test-banner-kitchen-' + Date.now(),
    isActive: true,
  });
}

describe('Banner & Offer Management Module', () => {
  it('runs the complete banner/offer lifecycle', async () => {
    const kitchen = await prepareKitchen();
    const kitchenId = kitchen._id.toString();
    const bearer = await adminBearer();

    // 1. Create a banner (admin)
    const createRes = await request(app)
      .post(api)
      .set('Authorization', bearer)
      .send({
        title: 'Super Deal 15%',
        subtitle: '15% off room service drinks',
        imageUrl: 'http://example.com/banner.png',
        linkUrl: '/menu?category=drinks',
        kitchenId,
      })
      .expect(201);

    expect(createRes.body.data.banner.title).toBe('Super Deal 15%');
    expect(createRes.body.data.banner.isActive).toBe(true);
    const bannerId = createRes.body.data.banner._id.toString();

    // 2. Fetch active banners (public)
    const activeRes = await request(app)
      .get(`${api}/active?kitchenId=${kitchenId}`)
      .expect(200);

    expect(activeRes.body.data.banners.length).toBeGreaterThan(0);
    expect(activeRes.body.data.banners[0].title).toBe('Super Deal 15%');

    // 3. Update banner (admin)
    const updateRes = await request(app)
      .patch(`${api}/${bannerId}`)
      .set('Authorization', bearer)
      .send({
        title: 'Super Deal 20%',
      })
      .expect(200);

    expect(updateRes.body.data.banner.title).toBe('Super Deal 20%');

    // 4. Delete banner (admin)
    await request(app)
      .delete(`${api}/${bannerId}`)
      .set('Authorization', bearer)
      .expect(200);

    // Verify it is gone
    const activeEmptyRes = await request(app)
      .get(`${api}/active?kitchenId=${kitchenId}`)
      .expect(200);

    expect(activeEmptyRes.body.data.banners.length).toBe(0);
  });
});