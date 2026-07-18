import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './banner.controller';
import { createBannerSchema, updateBannerSchema } from './banner.validation';

const router = Router();

// Public customer fetch
router.get('/active', ctrl.getActiveBanners);

// Protected Admin/Owner management
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER));

router.get('/', ctrl.listAllBanners);
router.post('/', validate({ body: createBannerSchema }), ctrl.createBanner);
router.patch('/:id', validate({ body: updateBannerSchema }), ctrl.updateBanner);
router.delete('/:id', ctrl.deleteBanner);

export default router;
