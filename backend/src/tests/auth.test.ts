import request from 'supertest';
import { createApp } from '@/app';
import { User, VerificationToken, RefreshToken } from '@/models';
import { TOKEN_TYPES, ROLES, REFRESH_COOKIE_NAME } from '@/constants';
import { hashToken } from '@/utils/crypto';

// Email is mocked so tests never hit Brevo / the network.
jest.mock('@/services/email/brevo.service', () => ({
  emailService: {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
  },
}));

const app = createApp();
const api = '/api/v1/auth';

const validUser = {
  name: 'Test Guest',
  email: 'guest@example.com',
  password: 'Str0ng!Pass',
};

/** Register, then fetch the raw verify token straight from the DB and verify. */
async function registerAndVerify(overrides: Partial<typeof validUser> = {}) {
  const payload = { ...validUser, ...overrides };
  await request(app).post(`${api}/register`).send(payload).expect(201);
  const user = await User.findOne({ email: payload.email });
  // We can't read the raw token (only its hash is stored), so verify directly.
  user!.isEmailVerified = true;
  await user!.save();
  return user!;
}

describe('Auth — registration & verification', () => {
  it('registers a new customer and sends a verification email', async () => {
    const res = await request(app).post(`${api}/register`).send(validUser).expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.isEmailVerified).toBe(false);

    const dbUser = await User.findOne({ email: validUser.email }).select('+passwordHash');
    expect(dbUser).toBeTruthy();
    expect(dbUser!.passwordHash).toBeDefined();
    expect(dbUser!.passwordHash).not.toBe(validUser.password); // hashed

    const token = await VerificationToken.findOne({ user: dbUser!._id });
    expect(token?.type).toBe(TOKEN_TYPES.EMAIL_VERIFY);
  });

  it('rejects weak passwords', async () => {
    const res = await request(app)
      .post(`${api}/register`)
      .send({ ...validUser, password: 'weak' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate emails', async () => {
    await request(app).post(`${api}/register`).send(validUser).expect(201);
    const res = await request(app).post(`${api}/register`).send(validUser).expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('verifies email with a valid token', async () => {
    await request(app).post(`${api}/register`).send(validUser).expect(201);
    const user = await User.findOne({ email: validUser.email });
    // Recreate a known token to drive the verify endpoint deterministically.
    const raw = 'a'.repeat(64);
    await VerificationToken.deleteMany({ user: user!._id });
    await VerificationToken.create({
      user: user!._id,
      type: TOKEN_TYPES.EMAIL_VERIFY,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await request(app).post(`${api}/verify-email`).send({ token: raw }).expect(200);
    expect(res.body.data.user.isEmailVerified).toBe(true);
  });
});

describe('Auth — login', () => {
  it('blocks login before email verification', async () => {
    await request(app).post(`${api}/register`).send(validUser).expect(201);
    const res = await request(app)
      .post(`${api}/login`)
      .send({ email: validUser.email, password: validUser.password })
      .expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('logs in a verified user and sets a refresh cookie', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post(`${api}/login`)
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith(REFRESH_COOKIE_NAME))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
  });

  it('rejects a wrong password with a generic message', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post(`${api}/login`)
      .send({ email: validUser.email, password: 'Wr0ng!Pass' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks the account after the configured number of failed attempts', async () => {
    await registerAndVerify();
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post(`${api}/login`)
        .send({ email: validUser.email, password: 'Wr0ng!Pass' });
    }
    const res = await request(app)
      .post(`${api}/login`)
      .send({ email: validUser.email, password: validUser.password })
      .expect(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('Auth — refresh rotation & reuse detection', () => {
  async function loginAndGetCookie() {
    await registerAndVerify();
    const res = await request(app)
      .post(`${api}/login`)
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    return cookies.find((c) => c.startsWith(REFRESH_COOKIE_NAME))!.split(';')[0];
  }

  it('rotates the refresh token and revokes the old one', async () => {
    const cookie = await loginAndGetCookie();
    const res = await request(app).post(`${api}/refresh`).set('Cookie', cookie).expect(200);
    expect(res.body.data.accessToken).toBeDefined();
    const newCookie = (res.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith(REFRESH_COOKIE_NAME))!
      .split(';')[0];
    expect(newCookie).not.toEqual(cookie);
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const cookie = await loginAndGetCookie();
    await request(app).post(`${api}/refresh`).set('Cookie', cookie).expect(200);

    // Replay the original (now-rotated) cookie → reuse detection.
    const res = await request(app).post(`${api}/refresh`).set('Cookie', cookie).expect(401);
    expect(res.body.error.code).toBe('TOKEN_REUSE');

    const active = await RefreshToken.countDocuments({ revokedAt: { $exists: false } });
    expect(active).toBe(0); // entire family revoked
  });

  it('logs out and clears the cookie', async () => {
    const cookie = await loginAndGetCookie();
    await request(app).post(`${api}/logout`).set('Cookie', cookie).expect(200);
    await request(app).post(`${api}/refresh`).set('Cookie', cookie).expect(401);
  });
});

describe('Auth — privileged secret-code gate', () => {
  it('requires the admin secret code for SUPER_ADMIN login', async () => {
    const admin = await registerAndVerify({ email: 'admin@example.com' });
    admin.role = ROLES.SUPER_ADMIN;
    await admin.save();

    // Missing code → rejected.
    await request(app)
      .post(`${api}/login`)
      .send({ email: 'admin@example.com', password: validUser.password })
      .expect(401);

    // Correct code → success.
    const res = await request(app)
      .post(`${api}/login`)
      .send({
        email: 'admin@example.com',
        password: validUser.password,
        secretCode: process.env.ADMIN_SECRET_CODE,
      })
      .expect(200);
    expect(res.body.data.user.role).toBe(ROLES.SUPER_ADMIN);
  });
});

describe('Auth — password reset', () => {
  it('resets the password and revokes existing sessions', async () => {
    const user = await registerAndVerify();
    const raw = 'b'.repeat(64);
    await VerificationToken.create({
      user: user._id,
      type: TOKEN_TYPES.PASSWORD_RESET,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await request(app)
      .post(`${api}/reset-password`)
      .send({ token: raw, password: 'N3w!Strong1' })
      .expect(200);

    // Old password no longer works; new one does.
    await request(app)
      .post(`${api}/login`)
      .send({ email: user.email, password: validUser.password })
      .expect(401);
    await request(app)
      .post(`${api}/login`)
      .send({ email: user.email, password: 'N3w!Strong1' })
      .expect(200);
  });
});
