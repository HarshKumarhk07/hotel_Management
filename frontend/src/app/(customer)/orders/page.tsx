'use client';

import Link from 'next/link';
import { ChevronRight, Receipt } from 'lucide-react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Badge, Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { useMyOrders } from '@/hooks/useOrders';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/orderStatus';
import { formatINR } from '@/lib/utils';

function OrdersInner() {
  const { data: orders, isLoading } = useMyOrders();

  if (isLoading) return <CenteredSpinner label="Loading your orders…" />;
  if (!orders || orders.length === 0) {
    return (
      <div className="px-4">
        <EmptyState title="No orders yet" description="Your past and active orders will appear here." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl w-full p-4">
      <h1 className="mb-4 text-xl font-bold text-zinc-900">My orders</h1>
      <div className="space-y-3">
        {orders.map((o) => (
          <Link key={o._id} href={`/orders/${o._id}`}>
            <Card className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-zinc-900">{o.orderNumber}</p>
                  <Badge className={STATUS_BADGE[o.status]}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                </div>
                <p className="text-xs text-zinc-500">
                  {o.items.length} item{o.items.length > 1 ? 's' : ''} ·{' '}
                  {new Date(o.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="text-sm font-semibold text-zinc-900">{formatINR(o.pricing.total)}</span>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <AuthGate>
      <OrdersInner />
    </AuthGate>
  );
}
