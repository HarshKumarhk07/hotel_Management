import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './contact.controller';
import { createContactSchema } from './contact.validation';

const router = Router();

// ── Public Routes ──
router.post('/', validate({ body: createContactSchema }), ctrl.createMessage);

// ── Protected Admin Routes ──
router.use(authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER));
router.get('/', ctrl.listContactMessages);
router.get('/:id', ctrl.getMessage);
router.patch('/:id/read', ctrl.markAsRead);
router.delete('/:id', ctrl.deleteMessage);

export default router;
