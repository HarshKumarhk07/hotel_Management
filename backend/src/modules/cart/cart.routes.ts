import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { ROLES } from '@/constants';
import * as ctrl from './cart.controller';
import {
  addItemSchema,
  cartNoteSchema,
  itemParams,
  kitchenParam,
  updateItemSchema,
} from './cart.validation';

const router = Router();

// Carts are a customer concept.
router.use(authenticate, authorize(ROLES.CUSTOMER));

/**
 * @openapi
 * tags:
 *   - name: Cart
 *     description: Customer cart (server-side; prices recomputed at checkout)
 */

/**
 * @openapi
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add an item to the cart (kitchen inferred from the item)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Cart view }, 409: { description: Out of stock/window } }
 */
router.post('/items', validate({ body: addItemSchema }), ctrl.addItem);

/**
 * @openapi
 * /cart/{kitchenId}:
 *   get: { tags: [Cart], summary: Get the cart for a kitchen, security: [{ bearerAuth: [] }], responses: { 200: { description: Cart view or null } } }
 *   delete: { tags: [Cart], summary: Clear the cart, security: [{ bearerAuth: [] }], responses: { 204: { description: Cleared } } }
 */
router
  .route('/:kitchenId')
  .get(validate({ params: kitchenParam }), ctrl.getCart)
  .delete(validate({ params: kitchenParam }), ctrl.clearCart);

/**
 * @openapi
 * /cart/{kitchenId}/note:
 *   patch: { tags: [Cart], summary: Set the order-level customer note, security: [{ bearerAuth: [] }], responses: { 200: { description: Cart view } } }
 */
router.patch('/:kitchenId/note', validate({ params: kitchenParam, body: cartNoteSchema }), ctrl.setNote);

/**
 * @openapi
 * /cart/{kitchenId}/items/{menuItemId}:
 *   patch: { tags: [Cart], summary: Update quantity/note (0 removes), security: [{ bearerAuth: [] }], responses: { 200: { description: Cart view } } }
 *   delete: { tags: [Cart], summary: Remove an item, security: [{ bearerAuth: [] }], responses: { 200: { description: Cart view } } }
 */
router
  .route('/:kitchenId/items/:menuItemId')
  .patch(validate({ params: itemParams, body: updateItemSchema }), ctrl.updateItem)
  .delete(validate({ params: itemParams }), ctrl.removeItem);

export default router;
