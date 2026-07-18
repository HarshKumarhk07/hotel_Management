import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { uploadImage as uploadImageMw } from '@/middleware/upload';
import { ROLES } from '@/constants';
import * as categoryCtrl from './category.controller';
import * as itemCtrl from './menuItem.controller';
import {
  categoryIdParam,
  createCategorySchema,
  listCategoriesSchema,
  updateCategorySchema,
} from './category.validation';
import {
  createMenuItemSchema,
  listMenuItemsSchema,
  menuItemIdParam,
  publicMenuParam,
  stockSchema,
  updateMenuItemSchema,
} from './menuItem.validation';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Menu
 *     description: Categories & menu items (Kitchen Owner for own kitchen, Super Admin for any)
 */

// ── Public menu (after QR scan) — no auth ──
/**
 * @openapi
 * /menu/public/{kitchenId}:
 *   get:
 *     tags: [Menu]
 *     summary: Public orderable menu for a kitchen (schedule + stock filtered)
 *     parameters: [{ name: kitchenId, in: path, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Kitchen + grouped available items }
 *       404: { description: Kitchen unavailable }
 */
router.get('/public/:kitchenId', validate({ params: publicMenuParam }), itemCtrl.publicMenu);

// ── Everything below requires Kitchen Owner or Super Admin ──
const manage = [authenticate, authorize(ROLES.KITCHEN_OWNER, ROLES.SUPER_ADMIN)] as const;

/**
 * @openapi
 * /menu/categories:
 *   post: { tags: [Menu], summary: Create a category, security: [{ bearerAuth: [] }], responses: { 201: { description: Created } } }
 *   get: { tags: [Menu], summary: List categories for a kitchen, security: [{ bearerAuth: [] }], responses: { 200: { description: Categories } } }
 */
router
  .route('/categories')
  .post(...manage, validate({ body: createCategorySchema }), categoryCtrl.create)
  .get(...manage, validate({ query: listCategoriesSchema }), categoryCtrl.list);

/**
 * @openapi
 * /menu/categories/{id}:
 *   get: { tags: [Menu], summary: Get a category, security: [{ bearerAuth: [] }], responses: { 200: { description: Category } } }
 *   patch: { tags: [Menu], summary: Update a category, security: [{ bearerAuth: [] }], responses: { 200: { description: Updated } } }
 *   delete: { tags: [Menu], summary: Delete an empty category, security: [{ bearerAuth: [] }], responses: { 204: { description: Deleted }, 409: { description: Not empty } } }
 */
router
  .route('/categories/:id')
  .get(...manage, validate({ params: categoryIdParam }), categoryCtrl.getOne)
  .patch(...manage, validate({ params: categoryIdParam, body: updateCategorySchema }), categoryCtrl.update)
  .delete(...manage, validate({ params: categoryIdParam }), categoryCtrl.remove);

/**
 * @openapi
 * /menu/items:
 *   post: { tags: [Menu], summary: Create a menu item, security: [{ bearerAuth: [] }], responses: { 201: { description: Created } } }
 *   get: { tags: [Menu], summary: List menu items (filterable), security: [{ bearerAuth: [] }], responses: { 200: { description: Items } } }
 */
router
  .route('/items')
  .post(...manage, validate({ body: createMenuItemSchema }), itemCtrl.create)
  .get(...manage, validate({ query: listMenuItemsSchema }), itemCtrl.list);

router.patch(
  '/items/bulk-stock',
  ...manage,
  itemCtrl.bulkStock,
);

/**
 * @openapi
 * /menu/items/{id}:
 *   get: { tags: [Menu], summary: Get a menu item, security: [{ bearerAuth: [] }], responses: { 200: { description: Item } } }
 *   patch: { tags: [Menu], summary: Update a menu item, security: [{ bearerAuth: [] }], responses: { 200: { description: Updated } } }
 *   delete: { tags: [Menu], summary: Delete a menu item (and its image), security: [{ bearerAuth: [] }], responses: { 204: { description: Deleted } } }
 */
router
  .route('/items/:id')
  .get(...manage, validate({ params: menuItemIdParam }), itemCtrl.getOne)
  .patch(...manage, validate({ params: menuItemIdParam, body: updateMenuItemSchema }), itemCtrl.update)
  .delete(...manage, validate({ params: menuItemIdParam }), itemCtrl.remove);

/**
 * @openapi
 * /menu/items/{id}/stock:
 *   patch: { tags: [Menu], summary: Toggle in/out of stock, security: [{ bearerAuth: [] }], responses: { 200: { description: Updated } } }
 * /menu/items/{id}/image:
 *   post: { tags: [Menu], summary: Upload/replace item image (multipart 'image'), security: [{ bearerAuth: [] }], responses: { 200: { description: Updated } } }
 *   delete: { tags: [Menu], summary: Remove item image, security: [{ bearerAuth: [] }], responses: { 200: { description: Updated } } }
 */
router.patch(
  '/items/:id/stock',
  ...manage,
  validate({ params: menuItemIdParam, body: stockSchema }),
  itemCtrl.setStock,
);
router.post(
  '/items/:id/image',
  ...manage,
  validate({ params: menuItemIdParam }),
  uploadImageMw,
  itemCtrl.uploadImage,
);
router.delete(
  '/items/:id/image',
  ...manage,
  validate({ params: menuItemIdParam }),
  itemCtrl.removeImage,
);

export default router;
