import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './feedback.controller';
import { createFeedbackSchema } from './feedback.validation';

const router = Router();

// Guest side: post reviews
router.post('/', validate({ body: createFeedbackSchema }), ctrl.createFeedback);

// Admin side: view feedback list & aggregate scores. Feedback is hotel-global
// (not kitchen-partitioned), so this is Super Admin only — kitchen owners could
// previously read all guest feedback and global rating analytics.
router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN), ctrl.listFeedback);

export default router;
