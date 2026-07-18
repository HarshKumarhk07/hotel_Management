/** Customer-facing order-status presentation + the happy-path step sequence. */

export const ORDER_STEPS = [
  'NEW_ORDER',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

export const STATUS_LABEL: Record<string, string> = {
  NEW_ORDER: 'Order placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

export const STATUS_BADGE: Record<string, string> = {
  NEW_ORDER: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-indigo-100 text-indigo-700',
  PREPARING: 'bg-amber-100 text-amber-700',
  READY: 'bg-teal-100 text-teal-700',
  OUT_FOR_DELIVERY: 'bg-violet-100 text-violet-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export function isTerminal(status: string): boolean {
  return status === 'CANCELLED' || status === 'REJECTED' || status === 'DELIVERED';
}
