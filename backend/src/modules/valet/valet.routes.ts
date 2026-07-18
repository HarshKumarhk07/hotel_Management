import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { paymentLimiter } from '@/middleware/rateLimit';
import { ROLES } from '@/constants';
import { AppError } from '@/utils/AppError';
import * as ctrl from './valet.controller';
import {
  updateStatusSchema,
  carNumberParam,
  scanTokenParam,
  createValetManagerSchema,
  updateValetManagerSchema,
} from './valet.validation';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

// Multer middleware for uploading vehicle photos
const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(AppError.badRequest('Only JPEG, PNG, WebP, or AVIF images are allowed', 'BAD_IMAGE_TYPE'));
  },
}).fields([
  { name: 'front', maxCount: 1 },
  { name: 'rear', maxCount: 1 },
  { name: 'left', maxCount: 1 },
  { name: 'right', maxCount: 1 },
  { name: 'dashboard', maxCount: 1 },
  { name: 'damage', maxCount: 5 },
]);

const router = Router();

// ── Public Routes (Guest tracking & request flow with rate-limiting) ──
router.get('/track/:carNumber', paymentLimiter, validate({ params: carNumberParam }), ctrl.getDetails);
router.post('/request/:carNumber', paymentLimiter, validate({ params: carNumberParam }), ctrl.requestByGuest);
router.get('/session/:token', paymentLimiter, validate({ params: scanTokenParam }), ctrl.getDetailsByToken);
router.post('/session/:token/request', paymentLimiter, validate({ params: scanTokenParam }), ctrl.requestByToken);

// PDF Valet ticket & receipt download endpoints
router.get('/vehicles/:id/ticket', ctrl.downloadTicket);
router.get('/vehicles/:id/receipt', ctrl.downloadReceipt);

// ── Admin-Only Valet Management Routes (Super Admin Restricted) ──
router.post('/admin/managers', authenticate, authorize(ROLES.SUPER_ADMIN), validate({ body: createValetManagerSchema }), ctrl.createValetManager);
router.get('/admin/managers', authenticate, authorize(ROLES.SUPER_ADMIN), ctrl.listValetManagers);
router.patch('/admin/managers/:id', authenticate, authorize(ROLES.SUPER_ADMIN), validate({ body: updateValetManagerSchema }), ctrl.updateValetManager);
router.post('/admin/managers/:id/reset-password', authenticate, authorize(ROLES.SUPER_ADMIN), ctrl.resetValetPassword);
router.get('/admin/stats', authenticate, authorize(ROLES.SUPER_ADMIN), ctrl.getValetAdminStats);
router.get('/admin/activity', authenticate, authorize(ROLES.SUPER_ADMIN), ctrl.getRecentValetActivity);
router.get('/reports/export', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.VALET_MANAGER), ctrl.exportReport);

// ── Valet Manager / Super Admin Restricted Routes ──
router.use(authenticate, authorize(ROLES.VALET_MANAGER, ROLES.SUPER_ADMIN));

router.get('/resolve-room/:token', validate({ params: scanTokenParam }), ctrl.resolveRoom);
router.post('/check-in', uploadPhotos, ctrl.checkIn);
router.patch('/vehicles/:id/status', validate({ body: updateStatusSchema }), ctrl.updateStatus);
router.get('/vehicles', ctrl.list);
router.get('/overview', ctrl.overview);
router.get('/slots', ctrl.slots);

export default router;
