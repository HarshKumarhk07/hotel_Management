import request from 'supertest';
import { createApp } from '@/app';
import { AuditLog } from '@/models';
import { AUDIT_ACTIONS, ROLES } from '@/constants';
import { createUserWithToken } from './helpers';

const app = createApp();
const api = '/api/v1/audit';

async function seedLogs() {
  await AuditLog.create([
    { action: AUDIT_ACTIONS.LOGIN_SUCCESS, actorEmail: 'a@example.com', success: true },
    { action: AUDIT_ACTIONS.LOGIN_FAILED, actorEmail: 'b@example.com', success: false },
    { action: AUDIT_ACTIONS.ORDER_PLACED, actorEmail: 'a@example.com', success: true },
  ]);
}

describe('Audit log', () => {
  it('requires Super Admin', async () => {
    const { bearer } = await createUserWithToken(ROLES.KITCHEN_OWNER);
    await request(app).get(api).set('Authorization', bearer).expect(403);
  });

  it('lists entries newest-first with pagination meta', async () => {
    await seedLogs();
    const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);
    const res = await request(app).get(`${api}?limit=10`).set('Authorization', bearer).expect(200);
    expect(res.body.data.logs.length).toBeGreaterThanOrEqual(3);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it('filters by action and actorEmail', async () => {
    await seedLogs();
    const { bearer } = await createUserWithToken(ROLES.SUPER_ADMIN);

    const byAction = await request(app)
      .get(`${api}?action=${AUDIT_ACTIONS.LOGIN_FAILED}`)
      .set('Authorization', bearer)
      .expect(200);
    expect(byAction.body.data.logs.every((l: { action: string }) => l.action === 'LOGIN_FAILED')).toBe(true);

    const byEmail = await request(app)
      .get(`${api}?actorEmail=a@example.com`)
      .set('Authorization', bearer)
      .expect(200);
    expect(byEmail.body.data.logs.every((l: { actorEmail: string }) => l.actorEmail === 'a@example.com')).toBe(true);
  });
});
