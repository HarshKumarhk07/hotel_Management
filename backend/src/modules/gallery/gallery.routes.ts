import { Router } from 'express';
import * as ctrl from './gallery.controller';
import { validate } from '@/middleware/validate';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { ROLES } from '@/constants';
import { createGalleryImageSchema, updateGalleryImageSchema } from './gallery.validation';

const router = Router();

// Public route
router.get('/', ctrl.getActiveGalleryImages);

// Admin routes
router.use(authenticate, authorize(ROLES.SUPER_ADMIN));
router.get('/admin', ctrl.getAllGalleryImages);
router.post('/admin', validate({ body: createGalleryImageSchema }), ctrl.createGalleryImage);
router.patch('/admin/:id', validate({ body: updateGalleryImageSchema }), ctrl.updateGalleryImage);
router.delete('/admin/:id', ctrl.deleteGalleryImage);

export default router;
