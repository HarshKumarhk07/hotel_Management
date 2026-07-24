import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { searchLimiter } from '@/middleware/rateLimit';
import { ROLES } from '@/constants';
import * as ctrl from './room.controller';
import * as bookingCtrl from './roomBooking.controller';
import {
  createRoomSchema,
  listRoomsSchema,
  qrFormatQuery,
  reassignQrSchema,
  roomIdParam,
  scanTokenParam,
  updateRoomSchema,
  createBookingSchema,
  updateBookingStatusSchema,
  setRoomStatusSchema,
  searchRoomsSchema,
  createCategorySchema,
  updateCategorySchema,
  categoryIdParam,
  cancelBookingSchema,
  transferRoomSchema,
  recordPaymentSchema,
  migrateCategorySchema,
} from './room.validation';
import * as categoryCtrl from './category.controller';
import { uploadDocument, uploadImage as uploadImageMw } from '@/middleware/upload';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Rooms
 *     description: Super Admin — hotel rooms & QR codes
 */

/**
 * @openapi
 * /rooms/resolve/{token}:
 *   get:
 *     tags: [Rooms]
 *     summary: Public — resolve a scanned QR token to a room + kitchen
 *     parameters: [{ name: token, in: path, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Room + kitchen }
 *       403: { description: QR disabled or room inactive }
 *       404: { description: Unknown QR }
 */
router.get('/resolve/:token', validate({ params: scanTokenParam }), ctrl.resolve);

// Admin Category Routes
router.post('/categories/upload-image', authenticate, authorize(ROLES.SUPER_ADMIN), uploadImageMw, categoryCtrl.uploadCategoryImage);

router.route('/categories')
  .post(authenticate, authorize(ROLES.SUPER_ADMIN), validate({ body: createCategorySchema }), categoryCtrl.createCategory)
  .get(categoryCtrl.listCategories); // Get list of categories should probably be public anyway for users to see, but leaving it open

// Category consistency tooling — report orphaned rooms and migrate them.
router.get('/categories-audit', authenticate, authorize(ROLES.SUPER_ADMIN), categoryCtrl.auditCategories);
router.post(
  '/categories-migrate',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validate({ body: migrateCategorySchema }),
  categoryCtrl.migrateOrphans,
);

router.route('/categories/:id')
  .get(validate({ params: categoryIdParam }), categoryCtrl.getCategory)
  .patch(authenticate, authorize(ROLES.SUPER_ADMIN), validate({ params: categoryIdParam, body: updateCategorySchema }), categoryCtrl.updateCategory)
  .delete(authenticate, authorize(ROLES.SUPER_ADMIN), validate({ params: categoryIdParam }), categoryCtrl.deleteCategory);

// Public Room Bookings
router.get('/search', searchLimiter, validate({ query: searchRoomsSchema }), bookingCtrl.searchRooms);
router.post('/bookings/upload-id', uploadDocument, bookingCtrl.uploadIdProof);
router.post('/bookings', validate({ body: createBookingSchema }), bookingCtrl.createBooking);
router.get('/bookings/my-bookings', bookingCtrl.getGuestBookings);
router.get('/bookings/:id', bookingCtrl.getBookingById);
router.post('/bookings/:id/razorpay', bookingCtrl.createRazorpayOrder);
router.post('/bookings/:id/verify', bookingCtrl.verifyPayment);
// Cancellation never prompts for an email: `optionalAuthenticate` lets a signed-in
// guest be matched against the email already stored on the booking, and the
// confirmation number on their own ticket authorises them if the session lapsed.
router.post(
  '/bookings/:id/cancel',
  optionalAuthenticate,
  validate({ body: cancelBookingSchema }),
  bookingCtrl.cancelGuestBooking,
);
router.get('/:id', validate({ params: roomIdParam }), ctrl.getOne);

// Booking Invoices — view requires auth, download is public (ID is the credential)
router.get('/bookings/:id/invoice', authenticate, bookingCtrl.getBookingInvoice);
router.get('/bookings/:id/invoice/download', bookingCtrl.downloadBookingInvoice);

// ── Everything below is Super-Admin only ──
router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

/**
 * @openapi
 * /rooms:
 *   post:
 *     tags: [Rooms]
 *     summary: Create a room (auto-generates its QR)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 *   get:
 *     tags: [Rooms]
 *     summary: List rooms (paginated; filter by floor/active/qrActive/search)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated rooms } }
 */
router
  .route('/')
  .post(validate({ body: createRoomSchema }), ctrl.create)
  .get(validate({ query: listRoomsSchema }), ctrl.list);

/**
 * @openapi
 * /rooms/{id}:
 *   get: { tags: [Rooms], summary: Get a room, security: [{ bearerAuth: [] }], responses: { 200: { description: Room } } }
 *   patch: { tags: [Rooms], summary: Update a room, security: [{ bearerAuth: [] }], responses: { 200: { description: Updated } } }
 *   delete: { tags: [Rooms], summary: Delete a room, security: [{ bearerAuth: [] }], responses: { 204: { description: Deleted } } }
 */
router
  .route('/:id')
  .patch(validate({ params: roomIdParam, body: updateRoomSchema }), ctrl.update)
  .delete(validate({ params: roomIdParam }), ctrl.remove);

router.patch('/:id/activate', validate({ params: roomIdParam }), ctrl.activate);
router.patch('/:id/deactivate', validate({ params: roomIdParam }), ctrl.deactivate);

/**
 * @openapi
 * /rooms/{id}/qr/generate:
 *   post: { tags: [Rooms], summary: (Re)generate the room QR token, security: [{ bearerAuth: [] }], responses: { 200: { description: New QR } } }
 * /rooms/{id}/qr/download:
 *   get:
 *     tags: [Rooms]
 *     summary: Download the room QR (png|svg|dataurl)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *       - { name: format, in: query, schema: { type: string, enum: [png, svg, dataurl] } }
 *     responses: { 200: { description: QR image } }
 * /rooms/{id}/qr/disable:
 *   patch: { tags: [Rooms], summary: Disable the room QR, security: [{ bearerAuth: [] }], responses: { 200: { description: Disabled } } }
 * /rooms/{id}/qr/reassign:
 *   post: { tags: [Rooms], summary: Swap QR tokens with another room, security: [{ bearerAuth: [] }], responses: { 200: { description: Swapped } } }
 */
router.post('/:id/qr/generate', validate({ params: roomIdParam }), ctrl.generateQr);
router.get(
  '/:id/qr/download',
  validate({ params: roomIdParam, query: qrFormatQuery }),
  ctrl.downloadQr,
);
router.patch('/:id/qr/disable', validate({ params: roomIdParam }), ctrl.disableQr);
router.post(
  '/:id/qr/reassign',
  validate({ params: roomIdParam, body: reassignQrSchema }),
  ctrl.reassignQr,
);

// Admin Room Bookings
router.get('/admin/bookings', bookingCtrl.listBookings);
router.patch('/bookings/:id/status', validate({ body: updateBookingStatusSchema }), bookingCtrl.updateBookingStatus);
router.patch('/:id/status', validate({ body: setRoomStatusSchema }), bookingCtrl.setRoomStatus);

router.post('/bookings/:id/checkin', bookingCtrl.checkIn);
router.post('/bookings/:id/checkout', bookingCtrl.checkOut);

// Explicit settlement entry — the only admin path that can mark a stay as paid.
router.patch(
  '/bookings/:id/payment',
  validate({ body: recordPaymentSchema }),
  bookingCtrl.recordPayment,
);

// ── Room transfer workflow ──
router.get('/bookings/:id/transfer-options', bookingCtrl.getTransferOptions);
router.post('/bookings/:id/upgrade', validate({ body: transferRoomSchema }), bookingCtrl.upgradeRoom);
router.post('/bookings/:id/transfer', validate({ body: transferRoomSchema }), bookingCtrl.transferRoom);
router.post('/bookings/:id/transfer/confirm-payment', bookingCtrl.confirmTransferPayment);
router.post('/bookings/:id/transfer/cancel', bookingCtrl.cancelPendingTransfer);
router.post('/bookings/:id/transfer/refund-processed', bookingCtrl.markTransferRefundProcessed);

router.get('/admin/reports', bookingCtrl.getReports);

export default router;

