import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import * as ctrl from './notification.controller';

const router = Router();

// Notifications belong to whichever authenticated user is the recipient
// (customer, kitchen owner, or admin) — so just require a valid session.
router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Notifications
 *     description: In-app notification feed (mirrors emails sent via Brevo)
 */

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List my notifications (newest first; ?unread=true for unread only)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Notifications + unread count } }
 */
router.get('/', validate({ query: ctrl.listSchema }), ctrl.list);

/**
 * @openapi
 * /notifications/unread-count:
 *   get: { tags: [Notifications], summary: Unread count (for the badge), security: [{ bearerAuth: [] }], responses: { 200: { description: Count } } }
 */
router.get('/unread-count', ctrl.unreadCount);

/**
 * @openapi
 * /notifications/read-all:
 *   patch: { tags: [Notifications], summary: Mark all as read, security: [{ bearerAuth: [] }], responses: { 200: { description: Count updated } } }
 */
router.patch('/read-all', ctrl.markAllRead);

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch: { tags: [Notifications], summary: Mark one as read, security: [{ bearerAuth: [] }], responses: { 200: { description: Notification }, 404: { description: Not found } } }
 */
router.patch('/:id/read', validate({ params: ctrl.idParam }), ctrl.markRead);

export default router;
