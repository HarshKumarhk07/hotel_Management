'use client';

import { Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FoodLabel } from '@/components/ui/primitives';
import { useOrderActions } from '@/hooks/useKitchenOrders';
import type { Order } from '@/hooks/useOrders';
import { cn, formatINR } from '@/lib/utils';

/** Minutes elapsed since the order was placed. */
function minutesAgo(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

const NEXT_ACTION: Record<string, { label: string; status: string } | undefined> = {
  ACCEPTED: { label: 'Start preparing', status: 'PREPARING' },
  PREPARING: { label: 'Mark ready', status: 'READY' },
  READY: { label: 'Out for delivery', status: 'OUT_FOR_DELIVERY' },
  OUT_FOR_DELIVERY: { label: 'Mark delivered', status: 'DELIVERED' },
};

export function OrderCard({ order, now }: { order: Order; now: number }) {
  const { setStatus, cancel } = useOrderActions();
  const elapsed = minutesAgo(order.createdAt, now);
  const overdue = elapsed > order.estimatedPrepMinutes && order.estimatedPrepMinutes > 0;
  const pending = setStatus.isPending || cancel.isPending;

  const advance = (status: string) => setStatus.mutate({ id: order._id, status });
  const reject = () => setStatus.mutate({ id: order._id, status: 'REJECTED' });
  const doCancel = () => {
    const reason = window.prompt('Reason for cancelling this order?');
    if (reason && reason.trim().length >= 3) cancel.mutate({ id: order._id, reason: reason.trim() });
  };

  const next = NEXT_ACTION[order.status];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-zinc-900">{order.orderNumber}</p>
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3 w-3" />
            {order.roomSnapshot?.roomNumber
              ? `Room ${order.roomSnapshot.roomNumber}`
              : order.tableSnapshot?.number
                ? `Table ${order.tableSnapshot.number}`
                : 'Dine-in'}
          </p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            overdue ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600',
          )}
        >
          <Clock className="h-3 w-3" /> {elapsed}m
        </span>
      </div>

      <ul className="my-3 space-y-1 border-y py-2">
        {order.items.map((it) => {
          const qty = it.quantity - it.cancelledQuantity;
          if (qty <= 0) return null;
          return (
            <li key={it.menuItem} className="flex items-center gap-2 text-sm">
              <FoodLabel label={it.foodLabel} />
              <span className="font-semibold text-zinc-900">{qty}×</span>
              <span className="flex-1 truncate text-zinc-700">{it.name}</span>
            </li>
          );
        })}
      </ul>

      <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
        <span>{order.payment.method === 'COD' ? 'Cash on delivery' : 'Paid online'}</span>
        <span className="font-semibold text-zinc-800">{formatINR(order.pricing.total)}</span>
      </div>

      {order.status === 'NEW_ORDER' ? (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={pending} onClick={() => advance('ACCEPTED')}>
            Accept
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={reject}>
            Reject
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          {next ? (
            <Button size="sm" className="flex-1" disabled={pending} onClick={() => advance(next.status)}>
              {next.label}
            </Button>
          ) : null}
          {order.status !== 'OUT_FOR_DELIVERY' ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={doCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
