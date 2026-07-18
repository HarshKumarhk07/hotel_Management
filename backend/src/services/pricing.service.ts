import type { IMenuItem, IOrderItem } from '@/models';

/** Round to 2 decimals using integer-cent math to avoid float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface PriceableLine {
  item: Pick<IMenuItem, 'name' | 'foodLabel' | 'price' | 'taxPercent'> & { _id: unknown };
  quantity: number;
  note?: string;
}

export interface PricingResult {
  items: IOrderItem[];
  subtotal: number;
  taxTotal: number;
  serviceCharge: number;
  discount: number;
  total: number;
}

/**
 * Compute order pricing from live menu items. Tax is applied per line (items can
 * have different tax rates), the kitchen service charge is a percentage of the
 * subtotal, and an optional discount is subtracted last (never below zero).
 * All prices come from the DB — client-supplied prices are ignored entirely.
 */
export function computePricing(
  lines: PriceableLine[],
  opts: { serviceChargePercent: number; discount?: number },
): PricingResult {
  let subtotal = 0;
  let taxTotal = 0;

  const items: IOrderItem[] = lines.map(({ item, quantity, note }) => {
    const lineSubtotal = round2(item.price * quantity);
    const lineTax = round2((lineSubtotal * item.taxPercent) / 100);
    const lineTotal = round2(lineSubtotal + lineTax);
    subtotal += lineSubtotal;
    taxTotal += lineTax;
    return {
      menuItem: item._id as never,
      name: item.name,
      foodLabel: item.foodLabel,
      unitPrice: item.price,
      taxPercent: item.taxPercent,
      quantity,
      cancelledQuantity: 0,
      note,
      lineSubtotal,
      lineTax,
      lineTotal,
    };
  });

  subtotal = round2(subtotal);
  taxTotal = round2(taxTotal);
  const serviceCharge = round2((subtotal * opts.serviceChargePercent) / 100);
  const discount = round2(Math.min(opts.discount ?? 0, subtotal));
  const total = round2(Math.max(0, subtotal + taxTotal + serviceCharge - discount));

  return { items, subtotal, taxTotal, serviceCharge, discount, total };
}

/**
 * Recompute a single line's frozen totals after a quantity change (used by
 * partial cancellation). Operates on the active quantity (quantity - cancelled).
 */
export function recomputeLine(line: IOrderItem): void {
  const activeQty = Math.max(0, line.quantity - line.cancelledQuantity);
  line.lineSubtotal = round2(line.unitPrice * activeQty);
  line.lineTax = round2((line.lineSubtotal * line.taxPercent) / 100);
  line.lineTotal = round2(line.lineSubtotal + line.lineTax);
}

/** Recompute the order-level pricing totals from its (possibly edited) lines. */
export function recomputeOrderTotals(
  items: IOrderItem[],
  serviceChargePercent: number,
  discount = 0,
): PricingResult {
  let subtotal = 0;
  let taxTotal = 0;
  for (const line of items) {
    subtotal += line.lineSubtotal;
    taxTotal += line.lineTax;
  }
  subtotal = round2(subtotal);
  taxTotal = round2(taxTotal);
  const serviceCharge = round2((subtotal * serviceChargePercent) / 100);
  const cappedDiscount = round2(Math.min(discount, subtotal));
  const total = round2(Math.max(0, subtotal + taxTotal + serviceCharge - cappedDiscount));
  return { items, subtotal, taxTotal, serviceCharge, discount: cappedDiscount, total };
}
