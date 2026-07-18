'use client';

import { useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { KitchenSelect } from '@/components/admin/KitchenSelect';
import { OrderDetailDialog } from '@/components/admin/OrderDetailDialog';
import { Badge, Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { useAdminOrders } from '@/hooks/useAdminOrders';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/orderStatus';
import { formatINR } from '@/lib/utils';

const STATUSES = ['', 'NEW_ORDER', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED'];

function OrdersInner() {
  const [status, setStatus] = useState('');
  const [kitchen, setKitchen] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: orders, isLoading } = useAdminOrders({ status, kitchen });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Orders</h1>
        <div className="flex gap-2">
          <KitchenSelect value={kitchen} onChange={setKitchen} allowAll />
          <select
            className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All statuses' : STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : !orders || orders.length === 0 ? (
        <EmptyState title="No orders" description="No orders match the current filters." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Room</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o._id} className="cursor-pointer hover:bg-zinc-50" onClick={() => setOpenId(o._id)}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{o.orderNumber}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {o.roomSnapshot?.roomNumber
                      ? `Room ${o.roomSnapshot.roomNumber}`
                      : o.tableSnapshot?.number
                        ? `Table ${o.tableSnapshot.number}`
                        : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_BADGE[o.status]}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {o.payment.method} · {o.payment.status}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(o.pricing.total)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {openId ? <OrderDetailDialog orderId={openId} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <AdminShell>
      <OrdersInner />
    </AdminShell>
  );
}
