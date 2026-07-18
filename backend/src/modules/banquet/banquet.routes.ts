import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './banquet.controller';
import {
  createHallSchema,
  updateHallSchema,
  createBookingSchema,
  updateBookingSchema,
} from './banquet.validation';

const router = Router();

// ── Public Routes (Customers booking) ──
router.use(optionalAuthenticate);
router.get('/halls', ctrl.listHalls);
router.post('/bookings', validate({ body: createBookingSchema }), ctrl.createBooking);
router.get('/bookings', ctrl.listBookings); // allows customers to look up by email/phone
router.get('/bookings/:id/quotation', ctrl.downloadQuotation);
router.get('/bookings/:id/estimation', ctrl.downloadEstimation);

// ── Protected Admin / Owner Routes ──
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER));

// Halls Admin
router.post('/halls', validate({ body: createHallSchema }), ctrl.createHall);
router.patch('/halls/:id', validate({ body: updateHallSchema }), ctrl.updateHall);
router.delete('/halls/:id', ctrl.deleteHall);

// Bookings Admin
router.patch('/bookings/:id', validate({ body: updateBookingSchema }), ctrl.updateBooking);

export default router;
