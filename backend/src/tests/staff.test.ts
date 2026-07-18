import request from 'supertest';
import { createApp } from '@/app';
import { Kitchen, User } from '@/models';
import { ROLES, STAFF_STATUS, PERMISSIONS } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();
const api = '/api/v1/staff';

async function adminBearer() {
  const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
  return bearer;
}

async function prepareKitchen() {
  return Kitchen.create({
    name: 'Test Staff Kitchen',
    slug: 'test-staff-kitchen-' + Date.now(),
    isActive: true,
  });
}

describe('Staff & RBAC Role Management Module', () => {
  it('runs the complete role and staff account provisioning lifecycle', async () => {
    const kitchen = await prepareKitchen();
    const kitchenId = kitchen._id.toString();
    const bearer = await adminBearer();

    // 1. Create a custom Role
    const roleRes = await request(app)
      .post(`${api}/roles`)
      .set('Authorization', bearer)
      .send({
        name: 'Head Chef',
        description: 'Manages menu items and accepts kitchen orders',
        permissions: [PERMISSIONS.MENU_MANAGE, PERMISSIONS.ORDER_UPDATE_STATUS],
        kitchenId,
      })
      .expect(201);

    expect(roleRes.body.data.role.name).toBe('Head Chef');
    expect(roleRes.body.data.role.permissions).toContain(PERMISSIONS.MENU_MANAGE);
    const roleId = roleRes.body.data.role._id.toString();

    // 2. Create Staff member (provisions the User account under the hood)
    const staffEmail = `chef-${Date.now()}@example.com`;
    const staffRes = await request(app)
      .post(api)
      .set('Authorization', bearer)
      .send({
        name: 'Gordon Chef',
        email: staffEmail,
        password: 'Password123!',
        roleId,
        designation: 'Sous Chef',
        employeeId: 'EMP- chef-001',
        kitchenId,
      })
      .expect(201);

    expect(staffRes.body.data.staff.designation).toBe('Sous Chef');
    expect(staffRes.body.data.staff.user.email).toBe(staffEmail);
    expect(staffRes.body.data.staff.status).toBe(STAFF_STATUS.ACTIVE);
    const staffId = staffRes.body.data.staff._id.toString();

    // 3. List Staff members
    const listRes = await request(app)
      .get(`${api}?kitchenId=${kitchenId}`)
      .set('Authorization', bearer)
      .expect(200);

    expect(listRes.body.data.staff.length).toBeGreaterThan(0);
    expect(listRes.body.data.staff[0].user.name).toBe('Gordon Chef');

    // 4. Update Staff status (suspend staff account, locks user login status)
    const updateRes = await request(app)
      .patch(`${api}/${staffId}`)
      .set('Authorization', bearer)
      .send({
        status: STAFF_STATUS.SUSPENDED,
      })
      .expect(200);

    expect(updateRes.body.data.staff.status).toBe(STAFF_STATUS.SUSPENDED);

    // Verify User isActive is disabled
    const user = await User.findOne({ email: staffEmail });
    expect(user?.isActive).toBe(false);
  });
});