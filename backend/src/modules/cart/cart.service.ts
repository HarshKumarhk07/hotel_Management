import { Cart, Kitchen, MenuItem, Room, type ICart } from '@/models';
import { computePricing } from '@/services/pricing.service';
import { isAvailableNow } from '@/utils/availability';
import { AppError } from '@/utils/AppError';

/**
 * Validate that a menu item is orderable right now: it exists, is active, in
 * stock, within its availability window, and belongs to the expected kitchen.
 */
async function loadOrderableItem(menuItemId: string, kitchenId?: string) {
  const item = await MenuItem.findById(menuItemId);
  if (!item || !item.isActive) throw AppError.notFound('Menu item not available', 'ITEM_UNAVAILABLE');
  if (kitchenId && item.kitchen.toString() !== kitchenId) {
    throw AppError.badRequest('Item belongs to a different kitchen', 'ITEM_KITCHEN_MISMATCH');
  }
  if (!item.inStock) throw AppError.conflict('Item is out of stock', 'OUT_OF_STOCK');
  if (!isAvailableNow(item.availability)) {
    throw AppError.conflict('Item is not available at this time', 'OUT_OF_WINDOW');
  }
  return item;
}

export async function addItem(
  customerId: string,
  input: { room: string; menuItem: string; quantity: number; note?: string },
) {
  const item = await loadOrderableItem(input.menuItem);
  const kitchenId = item.kitchen.toString();

  const room = await Room.findById(input.room);
  if (!room || !room.isActive) throw AppError.badRequest('Invalid or inactive room', 'ROOM_INVALID');
  if (room.kitchen && room.kitchen.toString() !== kitchenId) {
    throw AppError.badRequest('This item is not served to your room', 'ROOM_KITCHEN_MISMATCH');
  }

  let cart = await Cart.findOne({ customer: customerId, kitchen: kitchenId });
  if (!cart) {
    cart = new Cart({ customer: customerId, kitchen: kitchenId, room: input.room, items: [] });
  } else {
    cart.room = input.room as never; // keep cart pinned to the latest scanned room
  }

  const existing = cart.items.find((i) => i.menuItem.toString() === input.menuItem);
  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + input.quantity);
    if (input.note !== undefined) existing.note = input.note;
  } else {
    cart.items.push({ menuItem: item._id, quantity: input.quantity, note: input.note });
  }
  await cart.save();
  return buildCartView(cart);
}

export async function getCart(customerId: string, kitchenId: string) {
  const cart = await Cart.findOne({ customer: customerId, kitchen: kitchenId });
  if (!cart) return null;
  return buildCartView(cart);
}

export async function updateItem(
  customerId: string,
  kitchenId: string,
  menuItemId: string,
  quantity: number,
  note?: string,
) {
  const cart = await Cart.findOne({ customer: customerId, kitchen: kitchenId });
  if (!cart) throw AppError.notFound('Cart not found');
  const line = cart.items.find((i) => i.menuItem.toString() === menuItemId);
  if (!line) throw AppError.notFound('Item not in cart');

  if (quantity === 0) {
    cart.items = cart.items.filter((i) => i.menuItem.toString() !== menuItemId);
  } else {
    line.quantity = quantity;
    if (note !== undefined) line.note = note;
  }
  await cart.save();
  return buildCartView(cart);
}

export async function removeItem(customerId: string, kitchenId: string, menuItemId: string) {
  const cart = await Cart.findOne({ customer: customerId, kitchen: kitchenId });
  if (!cart) throw AppError.notFound('Cart not found');
  cart.items = cart.items.filter((i) => i.menuItem.toString() !== menuItemId);
  await cart.save();
  return buildCartView(cart);
}

export async function setNote(customerId: string, kitchenId: string, note: string) {
  const cart = await Cart.findOne({ customer: customerId, kitchen: kitchenId });
  if (!cart) throw AppError.notFound('Cart not found');
  cart.customerNote = note;
  await cart.save();
  return buildCartView(cart);
}

export async function clearCart(customerId: string, kitchenId: string) {
  await Cart.deleteOne({ customer: customerId, kitchen: kitchenId });
}

/**
 * Build a rich, validated view of the cart: resolves live menu items, flags any
 * that have become unavailable/out-of-stock, and returns a pricing preview using
 * the kitchen's current service charge. Unavailable lines are excluded from the
 * priced total but surfaced so the UI can prompt the guest to remove them.
 */
export async function buildCartView(cart: ICart) {
  const [kitchen, menuItems] = await Promise.all([
    Kitchen.findById(cart.kitchen).select('name slug settings isActive'),
    MenuItem.find({ _id: { $in: cart.items.map((i) => i.menuItem) } }),
  ]);
  const byId = new Map(menuItems.map((m) => [m._id.toString(), m]));

  const lines = cart.items.map((ci) => {
    const item = byId.get(ci.menuItem.toString());
    const available =
      !!item && item.isActive && item.inStock && isAvailableNow(item.availability);
    return {
      menuItem: ci.menuItem.toString(),
      name: item?.name ?? 'Unavailable item',
      foodLabel: item?.foodLabel,
      unitPrice: item?.price ?? 0,
      taxPercent: item?.taxPercent ?? 0,
      quantity: ci.quantity,
      note: ci.note,
      available,
      image: item?.image?.url,
    };
  });

  const priceable = lines
    .filter((l) => l.available)
    .map((l) => ({
      item: {
        _id: l.menuItem,
        name: l.name,
        foodLabel: l.foodLabel!,
        price: l.unitPrice,
        taxPercent: l.taxPercent,
      },
      quantity: l.quantity,
      note: l.note,
    }));

  const pricing = computePricing(priceable, {
    serviceChargePercent: kitchen?.settings.serviceChargePercent ?? 0,
  });

  return {
    id: cart._id.toString(),
    kitchen: cart.kitchen.toString(),
    kitchenName: kitchen?.name,
    room: cart.room.toString(),
    customerNote: cart.customerNote,
    lines,
    hasUnavailable: lines.some((l) => !l.available),
    pricing: {
      subtotal: pricing.subtotal,
      taxTotal: pricing.taxTotal,
      serviceCharge: pricing.serviceCharge,
      total: pricing.total,
      currency: 'INR',
    },
  };
}
