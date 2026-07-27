import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './complaint.controller';
import { createComplaintSchema, updateComplaintSchema } from './complaint.validation';

const router = Router();

// Guest routes. `optionalAuthenticate` lets a signed-in guest be identified by
// their account without turning an expired token into a 401 for QR-only guests.
router.post('/', optionalAuthenticate, validate({ body: createComplaintSchema }), ctrl.createComplaint);
router.get('/my', optionalAuthenticate, ctrl.getGuestComplaints);
router.get('/eligibility', optionalAuthenticate, ctrl.getServiceEligibility);

// Admin routes. Complaints are hotel-global (not kitchen-partitioned); only
// Super Admins may read/triage them. Kitchen owners were previously able to
// read and re-status every guest's complaint hotel-wide.
router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN), ctrl.listComplaints);
router.patch('/:id', authenticate, authorize(ROLES.SUPER_ADMIN), validate({ body: updateComplaintSchema }), ctrl.updateComplaint);

export default router;
