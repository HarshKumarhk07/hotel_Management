import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import {
  forgotPasswordLimiter,
  emailVerifyLimiter,
  loginLimiter,
  registerLimiter,
} from '@/middleware/rateLimit';
import * as ctrl from './auth.controller';
import {
  forgotPasswordSchema,
  googleSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  checkRoleSchema,
} from './auth.validation';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication, sessions, and account recovery
 */

/**
 * @openapi
 * /auth/check-role:
 *   get:
 *     tags: [Auth]
 *     summary: Check if a user has a specific role
 *     responses:
 *       200: { description: Role status }
 */
router.get('/check-role', validate({ query: checkRoleSchema }), ctrl.checkRole);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new customer account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, description: "8+ chars, upper, lower, number, special" }
 *               phone: { type: string }
 *     responses:
 *       201: { description: Registered; verification email sent }
 *       409: { description: Email already in use }
 */
router.post('/register', registerLimiter, validate({ body: registerSchema }), ctrl.register);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email using the token from the verification link
 *     responses:
 *       200: { description: Email verified }
 *       400: { description: Invalid or expired token }
 */
router.post('/verify-email', emailVerifyLimiter, validate({ body: verifyEmailSchema }), ctrl.verifyEmail);

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the email-verification link
 *     responses:
 *       200: { description: Sent if applicable }
 */
router.post(
  '/resend-verification',
  emailVerifyLimiter,
  validate({ body: resendVerificationSchema }),
  ctrl.resendVerification,
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email + password (privileged roles also need secretCode)
 *     responses:
 *       200: { description: Access token returned; refresh token set as HttpOnly cookie }
 *       401: { description: Invalid credentials }
 *       423: { description: Account locked }
 */
router.post('/login', loginLimiter, validate({ body: loginSchema }), ctrl.login);

/**
 * @openapi
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in / up with a Google ID token
 *     responses:
 *       200: { description: Authenticated }
 *       401: { description: Invalid Google token }
 */
router.post('/google', loginLimiter, validate({ body: googleSchema }), ctrl.google);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate the refresh token and issue a new access token
 *     responses:
 *       200: { description: New token pair issued }
 *       401: { description: Missing/invalid refresh token (reuse → all sessions revoked) }
 */
router.post('/refresh', ctrl.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current refresh session and clear the cookie
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', ctrl.logout);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password-reset link
 *     responses:
 *       200: { description: Sent if the account exists }
 */
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate({ body: forgotPasswordSchema }),
  ctrl.forgotPassword,
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using the token from the reset link
 *     responses:
 *       200: { description: Password updated; all sessions revoked }
 *       400: { description: Invalid or expired token }
 */
router.post('/reset-password', validate({ body: resetPasswordSchema }), ctrl.resetPassword);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the currently authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */
router.get('/me', authenticate, ctrl.me);

export default router;
