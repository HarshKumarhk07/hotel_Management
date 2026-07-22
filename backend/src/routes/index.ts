import { Router } from 'express';
import authRoutes from '@/modules/auth/auth.routes';
import kitchenRoutes from '@/modules/kitchen/kitchen.routes';
import roomRoutes from '@/modules/room/room.routes';
import menuRoutes from '@/modules/menu/menu.routes';
import cartRoutes from '@/modules/cart/cart.routes';
import orderRoutes from '@/modules/order/order.routes';
import paymentRoutes from '@/modules/payment/payment.routes';
import notificationRoutes from '@/modules/notification/notification.routes';
import couponRoutes from '@/modules/coupon/coupon.routes';
import analyticsRoutes from '@/modules/analytics/analytics.routes';
import auditRoutes from '@/modules/audit/audit.routes';
import valetRoutes from '@/modules/valet/valet.routes';
import restaurantRoutes from '@/modules/restaurant/restaurant.routes';
import guestRoutes from '@/modules/guest/guest.routes';
import staffRoutes from '@/modules/staff/staff.routes';
import bannerRoutes from '@/modules/banner/banner.routes';
import banquetRoutes from '@/modules/banquet/banquet.routes';
import complaintRoutes from '@/modules/complaint/complaint.routes';
import feedbackRoutes from '@/modules/feedback/feedback.routes';
import galleryRoutes from '@/modules/gallery/gallery.routes';
import { getIO } from '@/realtime/socket';

import { ok } from '@/utils/apiResponse';
import { uploadImage as uploadImageMw } from '@/middleware/upload';
import { uploadImage } from '@/services/cloudinary.service';
import { authenticate } from '@/middleware/authenticate';
import { asyncHandler } from '@/utils/asyncHandler';
import { AppError } from '@/utils/AppError';


/**
 * Aggregates all versioned API routes. New feature modules (rooms, menu, orders,
 * payments, …) are mounted here as they are built.
 */
const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Liveness/readiness probe
 *     responses:
 *       200: { description: Service is up }
 */
router.get('/health', (_req, res) =>
  ok(res, { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }),
);

router.get('/test-notify', (_req, res) => {
  const io = getIO();
  io.emit('valet:new', { carNumber: 'TEST-1234' });
  io.emit('complaint:new', { guestName: 'Harsh', category: 'ROOM_SERVICE' });
  io.emit('order:new', { orderNumber: 'ORD-9999' });
  res.send('Notifications sent!');
});

router.use('/auth', authRoutes);
router.use('/kitchens', kitchenRoutes);
router.use('/rooms', roomRoutes);
router.use('/menu', menuRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/coupons', couponRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/audit', auditRoutes);
router.use('/valet', valetRoutes);
router.use('/restaurant', restaurantRoutes);
router.use('/guests', guestRoutes);
router.use('/staff', staffRoutes);
router.use('/banners', bannerRoutes);
router.use('/banquets', banquetRoutes);
router.use('/complaints', complaintRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/gallery', galleryRoutes);

router.post(
  '/upload',
  authenticate,
  uploadImageMw,
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('No image file provided', 'NO_FILE');
    const uploaded = await uploadImage(req.file.buffer, 'kds/general');
    return ok(res, uploaded);
  }),
);






export default router;