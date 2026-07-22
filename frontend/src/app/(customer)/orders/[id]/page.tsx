'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Badge, Card, CenteredSpinner, EmptyState, FoodLabel } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useOrder } from '@/hooks/useOrders';
import { api, apiErrorMessage } from '@/lib/api';
import { loadRazorpay, openRazorpay, type RazorpayResponse } from '@/lib/razorpay';
import { ORDER_STEPS, STATUS_BADGE, STATUS_LABEL, isTerminal } from '@/lib/orderStatus';
import { cn, formatINR } from '@/lib/utils';
import { toast } from 'sonner';

function Timeline({ status, history }: { status: string; history: { status: string; at: string }[] }) {
  if (status === 'CANCELLED' || status === 'REJECTED') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700">
        <XCircle className="h-6 w-6" />
        <p className="text-sm font-medium">This order was {STATUS_LABEL[status]?.toLowerCase()}.</p>
      </div>
    );
  }
  const currentIndex = ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number]);
  const atMap = new Map(history.map((h) => [h.status, h.at]));

  return (
    <ol className="relative ml-3 space-y-5 border-l-2 border-zinc-200 pl-6">
      {ORDER_STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const at = atMap.get(step);
        return (
          <li key={step} className="relative">
            <span
              className={cn(
                'absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white',
                done || active ? 'border-brand' : 'border-zinc-300',
              )}
            >
              {done ? (
                <Check className="h-3 w-3 text-brand" />
              ) : active ? (
                <Clock className="h-3 w-3 text-brand" />
              ) : null}
            </span>
            <p className={cn('text-sm font-medium', done || active ? 'text-zinc-900' : 'text-zinc-400')}>
              {STATUS_LABEL[step]}
            </p>
            {at ? <p className="text-xs text-zinc-400">{new Date(at).toLocaleTimeString()}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

function OrderInner() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading } = useOrder(id);
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  if (isLoading) return <CenteredSpinner label="Loading order…" />;
  if (!order) return <EmptyState title="Order not found" />;

  const needsPayment =
    order.payment.method === 'RAZORPAY' &&
    order.payment.status !== 'PAID' &&
    !isTerminal(order.status);

  const retryPayment = async () => {
    setRetrying(true);
    setError(null);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment gateway');
      const rzp = await api.post<{
        data: { keyId: string; razorpayOrderId: string; amount: number; currency: string };
      }>(`/payments/orders/${order._id}/razorpay`);
      const { keyId, razorpayOrderId, amount, currency } = rzp.data.data;
      openRazorpay({
        key: keyId,
        amount,
        currency,
        order_id: razorpayOrderId,
        name: 'Room Service',
        description: `Order ${order.orderNumber}`,
        theme: { color: '#ea580c' },
        handler: async (r: RazorpayResponse) => {
          await api.post(`/payments/orders/${order._id}/verify`, {
            razorpayOrderId: r.razorpay_order_id,
            razorpayPaymentId: r.razorpay_payment_id,
            razorpaySignature: r.razorpay_signature,
          });
          void queryClient.invalidateQueries({ queryKey: ['order', order._id] });
        },
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Payment could not be started'));
    } finally {
      setRetrying(false);
    }
  };

  const downloadInvoice = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/orders/${order._id}/invoice`, { responseType: 'text' });
      const blob = new Blob([res.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      toast.error('Failed to generate invoice');
    } finally {
      setDownloading(false);
    }
  };


  return (
    <div className="mx-auto max-w-xl w-full pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-4 py-3">
        <Link href="/orders" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-zinc-700" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-zinc-900">{order.orderNumber}</h1>
          <p className="text-xs text-zinc-500">
            {order.roomSnapshot?.roomNumber
              ? `Room ${order.roomSnapshot.roomNumber}`
              : order.tableSnapshot?.number
                ? `Table ${order.tableSnapshot.number}`
                : 'Dine-in'}
          </p>
        </div>
        <Badge className={STATUS_BADGE[order.status]}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
      </header>

      <div className="space-y-4 p-4">
        {order.status === 'DELIVERED' ? (
          <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-700">
            <CheckCircle2 className="h-6 w-6" />
            <p className="text-sm font-medium">Delivered. Enjoy your meal!</p>
          </div>
        ) : null}

        {needsPayment ? (
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold text-zinc-900">Payment pending</p>
            <p className="text-xs text-zinc-500">Complete your payment to send this order to the kitchen.</p>
            <Button className="w-full" onClick={retryPayment} disabled={retrying}>
              {retrying ? 'Starting…' : `Pay ${formatINR(order.payment.amount)}`}
            </Button>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </Card>
        ) : null}

        <Card className="p-4">
          <p className="mb-4 text-sm font-semibold text-zinc-900">Order status</p>
          <Timeline status={order.status} history={order.statusHistory} />
        </Card>

        <Card className="divide-y p-4">
          {order.items.map((it) => (
            <div key={it.menuItem} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
              <FoodLabel label={it.foodLabel} />
              <span className="flex-1 text-sm text-zinc-800">
                {it.name} × {it.quantity}
                {it.cancelledQuantity > 0 ? (
                  <span className="ml-1 text-xs text-red-500">({it.cancelledQuantity} cancelled)</span>
                ) : null}
              </span>
              <span className="text-sm font-medium">{formatINR(it.lineTotal)}</span>
            </div>
          ))}
        </Card>

        <Card className="space-y-1 p-4">
          <Row label="Subtotal" value={order.pricing.subtotal} />
          <Row label="Taxes" value={order.pricing.taxTotal} />
          <Row label="Service charge" value={order.pricing.serviceCharge} />
          {order.pricing.discount > 0 ? <Row label="Discount" value={-order.pricing.discount} /> : null}
          <div className="flex justify-between border-t pt-2 text-base font-bold text-zinc-900">
            <span>Total</span>
            <span>{formatINR(order.pricing.total)}</span>
          </div>
          <p className="pt-1 text-xs text-zinc-500">
            {order.payment.method === 'COD' ? 'Cash on delivery' : 'Paid online'} ·{' '}
            <span className="font-medium">{order.payment.status}</span>
          </p>
          {order.refund.status !== 'NOT_REQUIRED' ? (
            <p className="text-xs text-zinc-500">
              Refund: <span className="font-medium">{order.refund.status}</span>
              {order.refund.amount > 0 ? ` · ${formatINR(order.refund.amount)}` : ''}
            </p>
          ) : null}
          {order.payment.status === 'PAID' && (
            <div className="pt-2 border-t mt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={downloadInvoice}
                disabled={downloading}
              >
                {downloading ? 'Generating Invoice…' : 'Download Tax Invoice'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm text-zinc-600">
      <span>{label}</span>
      <span>{formatINR(value)}</span>
    </div>
  );
}

export default function OrderPage() {
  return (
    <AuthGate>
      <OrderInner />
    </AuthGate>
  );
}
