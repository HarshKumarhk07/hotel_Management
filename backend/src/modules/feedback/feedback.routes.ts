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

// Admin side: view feedback list & aggregate scores
router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER), ctrl.listFeedback);

export default router;
