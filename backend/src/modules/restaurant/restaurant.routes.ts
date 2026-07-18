import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import {
  listTablesHandler,
  createTableHandler,
  updateTableHandler,
  deactivateTableHandler,
  regenerateQrHandler,
  seatTableHandler,
  requestBillHandler,
  closeTableHandler,
  getTableBillHandler,
  resolveTableHandler,
  availabilityHandler,
  listReservationsHandler,
  createReservationHandler,
  updateReservationHandler,
} from './restaurant.controller';
import * as waitlistCtrl from './waitlist.controller';
import {
  joinWaitlistSchema,
  checkWaitlistSchema,
  seatWaitlistSchema,
} from './restaurant.validation';

const router = Router();

// ─── Public (no auth) ────────────────────────────────────────────────────────
router.get('/availability',          availabilityHandler);
router.get('/tables/resolve/:token', resolveTableHandler);

// Guest Waitlist
router.post('/waitlist', validate({ body: joinWaitlistSchema }), waitlistCtrl.join);
router.get('/waitlist/status', validate({ query: checkWaitlistSchema }), waitlistCtrl.status);

// ─── Staff (admin + kitchen owner) ───────────────────────────────────────────
const staff = [authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER)];

router.get   ('/tables',                    ...staff, listTablesHandler);
router.post  ('/tables',                    ...staff, ...createTableHandler);
router.patch ('/tables/:id',                ...staff, ...updateTableHandler);
router.delete('/tables/:id',                ...staff, deactivateTableHandler);
router.post  ('/tables/:id/qr',             ...staff, regenerateQrHandler);
router.post  ('/tables/:id/seat',           ...staff, ...seatTableHandler);
router.post  ('/tables/:id/request-bill',   ...staff, requestBillHandler);
router.post  ('/tables/:id/close',          ...staff, closeTableHandler);
router.get   ('/tables/:id/bill',           ...staff, getTableBillHandler);

router.get   ('/reservations',              ...staff, listReservationsHandler);
router.post  ('/reservations',              ...staff, ...createReservationHandler);
router.patch ('/reservations/:id',          ...staff, ...updateReservationHandler);

// Waitlist Admin
router.get   ('/waitlist',                  ...staff, waitlistCtrl.list);
router.patch ('/waitlist/:id/seat',          ...staff, validate({ body: seatWaitlistSchema }), waitlistCtrl.seat);
router.patch ('/waitlist/:id/cancel',        ...staff, waitlistCtrl.cancel);
router.post  ('/waitlist/auto-assign',       ...staff, waitlistCtrl.autoAssign);

export default router;
