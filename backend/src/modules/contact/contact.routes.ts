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
// Contact messages are hotel-global (not kitchen-partitioned), so only Super
// Admins may read/mutate/delete them. Kitchen owners have no business here and
// were previously able to read and delete all guests' messages (IDOR).
router.use(authenticate, authorize(ROLES.SUPER_ADMIN));
router.get('/', ctrl.listContactMessages);
router.get('/:id', ctrl.getMessage);
router.patch('/:id/read', ctrl.markAsRead);
router.patch('/:id/status', ctrl.updateStatus);
router.delete('/:id', ctrl.deleteMessage);

export default router;
