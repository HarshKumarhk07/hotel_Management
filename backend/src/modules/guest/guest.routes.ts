import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { ROLES } from '@/constants';
import { listGuests, getGuestDetails } from './guest.controller';

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.SUPER_ADMIN));

router.get('/', listGuests);
router.get('/details', getGuestDetails);

export default router;
