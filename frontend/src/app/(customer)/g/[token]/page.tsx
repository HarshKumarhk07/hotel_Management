'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CenteredSpinner, EmptyState, FoodLabel } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { loadRazorpay, openRazorpay, type RazorpayResponse } from '@/lib/razorpay';
import { ORDER_STEPS, STATUS_BADGE, STATUS_LABEL, isTerminal } from '@/lib/orderStatus';
import { formatINR } from '@/lib/utils';

interface GuestOrder {
  _id: string;
  orderNumber: string;
  status: string;
  roomSnapshot: { roomNumber: string };
  guestInfo?: { name?: string; email?: string };
  items: { menuItem: string; name: string; foodLabel: string; quantity: number; lineTotal: number }[];
  pricing: { subtotal: number; taxTotal: number; serviceCharge: number; discount: number; total: number };
  payment: { method: string; status: string; amount: number };
  createdAt: string;
}

export default function GuestOrderPage() {
  const { token } = useParams<{ token: string }>();
  const search = useSearchParams();
  const justPlaced = search.get('placed') === '1';
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [dismissedCta, setDismissedCta] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['guest-order', token],
    queryFn: async () => {
      const res = await api.get<{ data: { order: GuestOrder } }>(`/orders/track/${token}`);
      return res.data.data.order;
    },
    // Keep tracking live until the order reaches a terminal state.
    refetchInterval: (q) => (q.state.data && isTerminal(q.state.data.status) ? false : 15000),
  });

  const retryPayment = async () => {
    if (!data) return;
    setRetryError(null);
    setRetrying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment gateway');
      const rzp = await api.post<{
        data: { keyId: string; razorpayOrderId: string; amount: number; currency: string };
      }>('/payments/guest/razorpay', { token });
      const { keyId, razorpayOrderId, amount, currency } = rzp.data.data;
      await new Promise<void>((resolve) => {
        openRazorpay({
          key: keyId,
          amount,
          currency,
          order_id: razorpayOrderId,
          name: 'Room Service',
          description: `Order ${data.orderNumber}`,
          prefill: { name: data.guestInfo?.name, email: data.guestInfo?.email },
          theme: { color: '#ea580c' },
          handler: async (response: RazorpayResponse) => {
            try {
              await api.post('/payments/guest/verify', {
                token,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
            } finally {
              await refetch();
              resolve();
            }
          },
          modal: { ondismiss: () => resolve() },
        });
      });
    } catch (err) {
      setRetryError(apiErrorMessage(err, 'Payment could not be started'));
    } finally {
      setRetrying(false);
    }
  };

  if (isLoading) return <CenteredSpinner label="Loading your order…" />;
  if (isError || !data) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          title="Order not found"
          description="This tracking link is invalid or has expired."
        />
        <Link href="/" className="mx-auto block w-fit text-sm font-semibold text-brand">
          Go to home
        </Link>
      </div>
    );
  }

  const currentStep = ORDER_STEPS.indexOf(data.status as (typeof ORDER_STEPS)[number]);
  const cancelled = data.status === 'CANCELLED' || data.status === 'REJECTED';
  const needsPayment = data.payment.method === 'RAZORPAY' && data.payment.status !== 'PAID';

  return (
    <div className="mx-auto max-w-xl w-full space-y-4 px-4 py-5 pb-10">
      {justPlaced ? (
        <Card className="space-y-2 border-green-200 bg-green-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <h1 className="text-lg font-bold text-zinc-900">Order placed successfully</h1>
          <p className="text-sm text-zinc-600">
            Your order has been received. We&apos;ve sent a confirmation to{' '}
            <span className="font-medium">{data.guestInfo?.email}</span>.
          </p>
        </Card>
      ) : (
        <h1 className="text-xl font-bold text-zinc-900">Track your order</h1>
      )}

      {/* Account CTA — convert the guest after a successful order. */}
      {!dismissedCta && data.guestInfo?.email ? (
        <Card className="space-y-3 border-brand/30 bg-brand-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Sparkles className="h-4 w-4 text-brand" /> Create an account
          </p>
          <p className="text-xs text-zinc-600">
            Sign up with <span className="font-medium">{data.guestInfo.email}</span> to see this order
            in your history, track future orders, save favorites, and reorder in one tap.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/register?email=${encodeURIComponent(data.guestInfo.email)}`}>
              <Button size="sm">Create Account</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setDismissedCta(true)}>
              Continue as Guest
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Order summary */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-zinc-900">{data.orderNumber}</p>
            <p className="text-xs text-zinc-500">Room {data.roomSnapshot.roomNumber}</p>
          </div>
          <Badge className={STATUS_BADGE[data.status] ?? 'bg-zinc-100 text-zinc-600'}>
            {STATUS_LABEL[data.status] ?? data.status}
          </Badge>
        </div>

        {/* Status progress (hidden for cancelled/rejected) */}
        {!cancelled ? (
          <div className="flex items-center gap-1 pt-1">
            {ORDER_STEPS.map((step, i) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full ${i <= currentStep ? 'bg-brand' : 'bg-zinc-200'}`}
                title={STATUS_LABEL[step]}
              />
            ))}
          </div>
        ) : null}
      </Card>

      {/* Payment / retry */}
      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-600">Payment</span>
          <span className="font-medium text-zinc-900">
            {data.payment.method} · {data.payment.status}
          </span>
        </div>
        {needsPayment ? (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
              <Clock className="h-4 w-4 shrink-0" /> Payment pending — complete it to confirm your order.
            </div>
            <Button className="w-full" onClick={retryPayment} disabled={retrying}>
              {retrying ? 'Opening payment…' : `Pay ${formatINR(data.payment.amount)}`}
            </Button>
            {retryError ? <p className="text-xs text-red-600">{retryError}</p> : null}
          </>
        ) : null}
      </Card>

      {/* Items + bill */}
      <Card className="divide-y p-4">
        {data.items.map((it) => (
          <div key={it.menuItem} className="flex items-center gap-3 py-2 first:pt-0">
            <FoodLabel label={it.foodLabel as never} />
            <span className="flex-1 text-sm text-zinc-800">
              {it.name} × {it.quantity}
            </span>
            <span className="text-sm font-medium">{formatINR(it.lineTotal)}</span>
          </div>
        ))}
        <div className="space-y-1 pt-2">
          <Row label="Subtotal" value={data.pricing.subtotal} />
          <Row label="Taxes" value={data.pricing.taxTotal} />
          <Row label="Service charge" value={data.pricing.serviceCharge} />
          {data.pricing.discount > 0 ? <Row label="Discount" value={-data.pricing.discount} /> : null}
          <div className="flex justify-between border-t pt-2 text-base font-bold text-zinc-900">
            <span>Total</span>
            <span>{formatINR(data.pricing.total)}</span>
          </div>
        </div>
      </Card>

      <p className="text-center text-xs text-zinc-400">
        Bookmark this page to track your order. <Link href="/" className="font-semibold text-brand">Order more</Link>
      </p>
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
