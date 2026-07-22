'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge, CenteredSpinner, FoodLabel } from '@/components/ui/primitives';
import { useAdminOrder, useOrderAdminMutations } from '@/hooks/useAdminOrders';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/orderStatus';
import { apiErrorMessage, api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';


const NEXT: Record<string, { label: string; status: string }[]> = {
  NEW_ORDER: [{ label: 'Accept', status: 'ACCEPTED' }, { label: 'Reject', status: 'REJECTED' }],
  ACCEPTED: [{ label: 'Start preparing', status: 'PREPARING' }],
  PREPARING: [{ label: 'Mark ready', status: 'READY' }],
  READY: [{ label: 'Out for delivery', status: 'OUT_FOR_DELIVERY' }, { label: 'Delivered', status: 'DELIVERED' }],
  OUT_FOR_DELIVERY: [{ label: 'Mark delivered', status: 'DELIVERED' }],
};

const CANCELLABLE = ['NEW_ORDER', 'ACCEPTED', 'PREPARING', 'READY'];

export function OrderDetailDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: order, isLoading } = useAdminOrder(orderId);
  const { setStatus, cancel, addNote, refund } = useOrderAdminMutations(orderId);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(apiErrorMessage(err, 'Action failed'));
    }
  };

  const [downloading, setDownloading] = useState(false);
  const downloadInvoice = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/orders/${order?._id}/invoice`, { responseType: 'text' });
      const blob = new Blob([res.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      toast.error('Failed to generate invoice');
    } finally {
      setDownloading(false);
    }
  };

  const refundDue =
    order && order.refund.status !== 'NOT_REQUIRED' && order.refund.status !== 'REFUNDED';

  return (
    <Dialog open onClose={onClose} title={order ? order.orderNumber : 'Order'} widthClass="max-w-lg">
      {isLoading || !order ? (
        <CenteredSpinner />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              {order.roomSnapshot?.roomNumber
                ? `Room ${order.roomSnapshot.roomNumber}`
                : order.tableSnapshot?.number
                  ? `Table ${order.tableSnapshot.number}`
                  : 'Dine-in'}{' '}
              · {new Date(order.createdAt).toLocaleString()}
            </p>
            <Badge className={STATUS_BADGE[order.status]}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
          </div>

          <div className="divide-y rounded-lg border">
            {order.items.map((it) => (
              <div key={it.menuItem} className="flex items-center gap-2 px-3 py-2 text-sm">
                <FoodLabel label={it.foodLabel} />
                <span className="flex-1">
                  {it.name} × {it.quantity - it.cancelledQuantity}
                </span>
                <span>{formatINR(it.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-zinc-50 p-3 text-sm">
            <Row label="Subtotal" value={order.pricing.subtotal} />
            <Row label="Tax" value={order.pricing.taxTotal} />
            <Row label="Service" value={order.pricing.serviceCharge} />
            {order.pricing.discount > 0 ? <Row label="Discount" value={-order.pricing.discount} /> : null}
            <div className="mt-1 flex justify-between border-t pt-1 font-bold">
              <span>Total</span>
              <span>{formatINR(order.pricing.total)}</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {order.payment.method} · {order.payment.status}
              {order.refund.status !== 'NOT_REQUIRED' ? ` · Refund: ${order.refund.status}` : ''}
            </p>
          </div>

          {/* Lifecycle actions */}
          <div className="flex flex-wrap gap-2">
            {(NEXT[order.status] ?? []).map((a) => (
              <Button key={a.status} size="sm" onClick={() => run(() => setStatus.mutateAsync({ id: order._id, status: a.status }))}>
                {a.label}
              </Button>
            ))}
            {CANCELLABLE.includes(order.status) ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const reason = window.prompt('Cancellation reason?');
                  if (reason && reason.trim().length >= 3) run(() => cancel.mutateAsync({ id: order._id, reason: reason.trim() }));
                }}
              >
                Cancel order
              </Button>
            ) : null}
            {refundDue ? (
              <Button size="sm" variant="outline" onClick={() => run(() => refund.mutateAsync({ id: order._id }))}>
                Process refund ({formatINR(order.refund.amount)})
              </Button>
            ) : null}
            {order.payment.status === 'PAID' && (
              <Button size="sm" variant="outline" onClick={downloadInvoice} disabled={downloading}>
                {downloading ? 'Generating Invoice…' : 'Invoice'}
              </Button>
            )}
          </div>

          {/* Admin: force-set any status */}
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <span className="text-xs font-semibold text-zinc-500 shrink-0">Force status:</span>
            <select
              className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-brand"
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                if (window.confirm(`Force set status to "${val}"?`)) {
                  run(() => setStatus.mutateAsync({ id: order._id, status: val }));
                }
                e.target.value = '';
              }}
            >
              <option value="">Select status…</option>
              {['NEW_ORDER','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','REJECTED'].map(s => (
                <option key={s} value={s} disabled={s === order.status}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Internal notes */}
          <div>
            <p className="mb-1 text-sm font-semibold text-zinc-800">Internal notes</p>
            <div className="space-y-1">
              {(order.internalNotes ?? []).length === 0 ? (
                <p className="text-xs text-zinc-400">No notes yet.</p>
              ) : (
                order.internalNotes!.map((n, i) => (
                  <p key={i} className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    {n.note}
                  </p>
                ))
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a private note…"
                className="h-9 flex-1 rounded-lg border border-zinc-300 px-2 text-sm"
              />
              <Button
                size="sm"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => run(() => addNote.mutateAsync({ id: order._id, note: note.trim() })).then(() => setNote(''))}
              >
                Add
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      )}
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-zinc-600">
      <span>{label}</span>
      <span>{formatINR(value)}</span>
    </div>
  );
}
