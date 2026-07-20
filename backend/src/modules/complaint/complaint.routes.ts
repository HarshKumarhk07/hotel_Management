import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './complaint.controller';
import { createComplaintSchema, updateComplaintSchema } from './complaint.validation';

const router = Router();

// Guest routes
router.post('/', validate({ body: createComplaintSchema }), ctrl.createComplaint);
router.get('/my', ctrl.getGuestComplaints);

// Admin/Staff routes
router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER), ctrl.listComplaints);
router.patch('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER), validate({ body: updateComplaintSchema }), ctrl.updateComplaint);

export default router;
