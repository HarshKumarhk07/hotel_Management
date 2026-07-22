import { OAuth2Client } from 'google-auth-library';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import {
  AUDIT_ACTIONS,
  AUTH_PROVIDERS,
  EMAIL_VERIFY_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  PRIVILEGED_ROLES,
  ROLES,
  TOKEN_TYPES,
  type Role,
} from '@/constants';
import { User, VerificationToken, type IUser } from '@/models';
import { emailService } from '@/services/email/brevo.service';
import { recordAudit } from '@/services/audit.service';
import { linkGuestOrders } from '@/services/orderLinking.service';
import {
  issueTokenPair,
  revokeAllUserSessions,
  type TokenPair,
} from '@/services/token.service';
import { generateSecureToken, hashToken, safeEqual } from '@/utils/crypto';
import type { DeviceInfo } from '@/utils/request';
import { AppError } from '@/utils/AppError';

export interface RequestMeta {
  ip?: string;
  device?: DeviceInfo;
}

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

function publicUser(user: IUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    provider: user.provider,
    avatarUrl: user.avatarUrl,
    kitchenId: user.kitchen?.toString(),
    isEmailVerified: user.isEmailVerified,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;

// ─────────────────────────────────────────────────────────────────────────────
// Email verification token helpers
// ─────────────────────────────────────────────────────────────────────────────
async function createVerificationToken(
  userId: string,
  type: (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES],
  ttlMs: number,
): Promise<string> {
  // Invalidate any outstanding tokens of the same type first.
  await VerificationToken.deleteMany({ user: userId, type });
  const { raw, hash } = generateSecureToken();
  await VerificationToken.create({
    user: userId,
    type,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────
export async function register(
  input: { name: string; email: string; password: string; phone?: string },
  meta: RequestMeta,
): Promise<{ user: PublicUser }> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const user = new User({
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: ROLES.CUSTOMER,
    provider: AUTH_PROVIDERS.LOCAL,
  });
  // Virtual setter triggers hashing in the pre-save hook.
  (user as IUser & { password?: string }).password = input.password;
  await user.save();

  const rawToken = await createVerificationToken(
    user._id.toString(),
    TOKEN_TYPES.EMAIL_VERIFY,
    EMAIL_VERIFY_TTL_MS,
  );
  const link = `${env.APP_URL}/verify-email?token=${rawToken}`;
  await emailService.sendVerificationEmail(user.email, user.name, link);

  void recordAudit({
    action: AUDIT_ACTIONS.REGISTER,
    actor: user._id.toString(),
    actorEmail: user.email,
    role: user.role,
    ip: meta.ip,
    userAgent: meta.device?.userAgent,
    browser: meta.device?.browser,
  });

  return { user: publicUser(user) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify email
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyEmail(rawToken: string): Promise<{ user: PublicUser }> {
  const tokenHash = hashToken(rawToken);
  const record = await VerificationToken.findOne({
    tokenHash,
    type: TOKEN_TYPES.EMAIL_VERIFY,
    usedAt: { $exists: false },
  });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('Verification link is invalid or has expired', 'TOKEN_INVALID');
  }

  const user = await User.findById(record.user);
  if (!user) throw AppError.notFound('User not found');

  user.isEmailVerified = true;
  await user.save();
  record.usedAt = new Date();
  await record.save();

  void recordAudit({
    action: AUDIT_ACTIONS.EMAIL_VERIFIED,
    actor: user._id.toString(),
    actorEmail: user.email,
    role: user.role,
  });

  // Now that the email is verified, claim any guest orders placed with it.
  await linkGuestOrders(user);

  return { user: publicUser(user) };
}

export async function resendVerification(emailAddr: string): Promise<void> {
  const user = await User.findOne({ email: emailAddr });
  // Always behave the same to avoid email enumeration.
  if (!user || user.isEmailVerified) return;
  const rawToken = await createVerificationToken(
    user._id.toString(),
    TOKEN_TYPES.EMAIL_VERIFY,
    EMAIL_VERIFY_TTL_MS,
  );
  const link = `${env.APP_URL}/verify-email?token=${rawToken}`;
  await emailService.sendVerificationEmail(user.email, user.name, link);
}

// ─────────────────────────────────────────────────────────────────────────────
// Login (with lockout + privileged secret-code gate + security alerts)
// ─────────────────────────────────────────────────────────────────────────────
function requiredSecretCode(role: Role): string | null {
  if (role === ROLES.SUPER_ADMIN) return env.ADMIN_SECRET_CODE;
  if (role === ROLES.KITCHEN_OWNER) return env.KITCHEN_SECRET_CODE;
  if (role === ROLES.VALET_MANAGER) return env.VALET_SECRET_CODE;
  return null;
}

async function registerFailedAttempt(user: IUser, meta: RequestMeta, reason: string): Promise<void> {
  user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;

  let locked = false;
  if (user.failedLoginAttempts >= env.MAX_LOGIN_ATTEMPTS) {
    user.lockedUntil = new Date(Date.now() + env.ACCOUNT_LOCK_MINUTES * 60_000);
    user.failedLoginAttempts = 0;
    locked = true;
  }
  await user.save();

  void recordAudit({
    action: locked ? AUDIT_ACTIONS.ACCOUNT_LOCKED : AUDIT_ACTIONS.LOGIN_FAILED,
    actor: user._id.toString(),
    actorEmail: user.email,
    role: user.role,
    ip: meta.ip,
    userAgent: meta.device?.userAgent,
    browser: meta.device?.browser,
    success: false,
    metadata: { reason },
  });

  if (locked) {
    // Security alert to the account owner and (for privileged roles) the SOC inbox.
    const time = new Date().toISOString();
    void emailService.sendSecurityAlert(user.email, {
      name: user.name,
      reason: `Your account was temporarily locked after ${env.MAX_LOGIN_ATTEMPTS} failed login attempts.`,
      ip: meta.ip,
      browser: meta.device?.browser,
      time,
    });
    if (PRIVILEGED_ROLES.includes(user.role) && env.SECURITY_ALERT_EMAIL) {
      void emailService.sendSecurityAlert(env.SECURITY_ALERT_EMAIL, {
        name: 'Security Team',
        reason: `Privileged account ${user.email} (${user.role}) was locked after repeated failed logins.`,
        ip: meta.ip,
        browser: meta.device?.browser,
        time,
      });
    }
  }
}

export async function login(
  input: { email: string; password: string; secretCode?: string },
  meta: RequestMeta,
): Promise<{ user: PublicUser; tokens: TokenPair }> {
  const user = await User.findOne({ email: input.email }).select(
    '+passwordHash +failedLoginAttempts +lockedUntil +isActive',
  );

  // Generic message to avoid revealing which accounts exist.
  const invalid = AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  if (!user) {
    void recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      actorEmail: input.email,
      ip: meta.ip,
      userAgent: meta.device?.userAgent,
      browser: meta.device?.browser,
      success: false,
      metadata: { reason: 'no_such_user' },
    });
    throw invalid;
  }

  if (!user.isActive) {
    throw AppError.forbidden('This account has been deactivated', 'ACCOUNT_DEACTIVATED');
  }

  if (user.isLocked()) {
    throw AppError.locked(
      `Account locked due to too many failed attempts. Try again in ${env.ACCOUNT_LOCK_MINUTES} minutes.`,
    );
  }

  // Privileged accounts must supply the correct secret code.
  const secret = requiredSecretCode(user.role);
  if (secret) {
    if (!input.secretCode || !safeEqual(input.secretCode, secret)) {
      void recordAudit({
        action: AUDIT_ACTIONS.SECRET_CODE_FAILED,
        actor: user._id.toString(),
        actorEmail: user.email,
        role: user.role,
        ip: meta.ip,
        browser: meta.device?.browser,
        success: false,
      });
      await registerFailedAttempt(user, meta, 'bad_secret_code');
      throw AppError.unauthorized('Invalid credentials or access code', 'INVALID_CREDENTIALS');
    }
  }

  const passwordOk = await user.comparePassword(input.password);
  if (!passwordOk) {
    await registerFailedAttempt(user, meta, 'bad_password');
    throw invalid;
  }

  if (!user.isEmailVerified) {
    throw AppError.forbidden('Please verify your email before logging in', 'EMAIL_NOT_VERIFIED');
  }

  // Success — reset counters, stamp login, issue tokens.
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  user.lastLoginIp = meta.ip;
  await user.save();

  const tokens = await issueTokenPair(user, { ip: meta.ip, device: meta.device });

  void recordAudit({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    actor: user._id.toString(),
    actorEmail: user.email,
    role: user.role,
    ip: meta.ip,
    userAgent: meta.device?.userAgent,
    browser: meta.device?.browser,
  });

  // Claim any guest orders placed with this (already verified) email/phone.
  await linkGuestOrders(user, meta);

  return { user: publicUser(user), tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth
// ─────────────────────────────────────────────────────────────────────────────
export async function googleLogin(
  idToken: string,
  meta: RequestMeta,
): Promise<{ user: PublicUser; tokens: TokenPair }> {
  if (!googleClient) {
    throw AppError.badRequest('Google sign-in is not configured', 'GOOGLE_DISABLED');
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw AppError.unauthorized('Invalid Google token', 'GOOGLE_INVALID');
  }
  if (!payload?.email) throw AppError.unauthorized('Google account has no email', 'GOOGLE_NO_EMAIL');

  let user = await User.findOne({ email: payload.email.toLowerCase() }).select('+isActive');

  if (!user) {
    user = await User.create({
      name: payload.name ?? payload.email.split('@')[0],
      email: payload.email.toLowerCase(),
      googleId: payload.sub,
      avatarUrl: payload.picture,
      provider: AUTH_PROVIDERS.GOOGLE,
      role: ROLES.CUSTOMER,
      isEmailVerified: Boolean(payload.email_verified),
    });
    void recordAudit({
      action: AUDIT_ACTIONS.REGISTER,
      actor: user._id.toString(),
      actorEmail: user.email,
      role: user.role,
      ip: meta.ip,
      metadata: { provider: 'google' },
    });
  } else {
    if (!user.isActive) {
      throw AppError.forbidden('This account has been deactivated', 'ACCOUNT_DEACTIVATED');
    }
    // Link Google to an existing local account on first Google sign-in.
    if (!user.googleId) {
      user.googleId = payload.sub;
      if (!user.isEmailVerified && payload.email_verified) user.isEmailVerified = true;
      if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
      await user.save();
    }
  }

  // Privileged accounts cannot bypass the secret-code gate via Google.
  if (PRIVILEGED_ROLES.includes(user.role)) {
    throw AppError.forbidden('Privileged accounts must sign in with email and access code', 'GOOGLE_PRIVILEGED');
  }

  user.lastLoginAt = new Date();
  user.lastLoginIp = meta.ip;
  await user.save();

  const tokens = await issueTokenPair(user, { ip: meta.ip, device: meta.device });

  void recordAudit({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    actor: user._id.toString(),
    actorEmail: user.email,
    role: user.role,
    ip: meta.ip,
    browser: meta.device?.browser,
    metadata: { provider: 'google' },
  });

  // Google accounts arrive email-verified, so claim matching guest orders too.
  if (user.isEmailVerified) await linkGuestOrders(user, meta);

  return { user: publicUser(user), tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Password reset
// ─────────────────────────────────────────────────────────────────────────────
export async function forgotPassword(emailAddr: string): Promise<void> {
  const user = await User.findOne({ email: emailAddr });
  // Uniform response regardless of existence (no enumeration).
  if (!user || user.provider === AUTH_PROVIDERS.GOOGLE) {
    void recordAudit({
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
      actorEmail: emailAddr,
      success: false,
      metadata: { reason: 'no_local_account' },
    });
    return;
  }

  const rawToken = await createVerificationToken(
    user._id.toString(),
    TOKEN_TYPES.PASSWORD_RESET,
    PASSWORD_RESET_TTL_MS,
  );
  const link = `${env.APP_URL}/reset-password?token=${rawToken}`;
  await emailService.sendPasswordResetEmail(user.email, user.name, link);

  void recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
    actor: user._id.toString(),
    actorEmail: user.email,
    role: user.role,
  });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const record = await VerificationToken.findOne({
    tokenHash,
    type: TOKEN_TYPES.PASSWORD_RESET,
    usedAt: { $exists: false },
  });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('Reset link is invalid or has expired', 'TOKEN_INVALID');
  }

  const user = await User.findById(record.user);
  if (!user) throw AppError.notFound('User not found');

  (user as IUser & { password?: string }).password = newPassword;
  // Reset lockout state on a successful recovery.
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await user.save();

  record.usedAt = new Date();
  await record.save();

  // Invalidate every existing session — a reset should log out all devices.
  await revokeAllUserSessions(user._id.toString(), 'password_reset');

  void recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_RESET,
    actor: user._id.toString(),
    actorEmail: user.email,
    role: user.role,
  });

  logger.info({ userId: user._id.toString() }, 'Password reset completed');
}

export async function checkRole(email: string): Promise<{ requiresSecretCode: boolean; role?: string }> {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('role');
  if (!user) {
    return { requiresSecretCode: false };
  }
  const requiresSecretCode = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.KITCHEN_OWNER || user.role === ROLES.VALET_MANAGER;
  return { requiresSecretCode, role: user.role };
}
