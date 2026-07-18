'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgePercent, CreditCard, UserRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Card, CenteredSpinner, EmptyState, FoodLabel } from '@/components/ui/primitives';
import { useCart } from '@/stores/cart';
import { useCheckout, type PaymentMethod } from '@/hooks/useCheckout';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth';
import { api, apiErrorMessage } from '@/lib/api';
import { cn, formatINR } from '@/lib/utils';

interface GuestErrors {
  name?: string;
  email?: string;
  phone?: string;
}

function CheckoutInner() {
  const router = useRouter();
  const cart = useCart();
  const totals = useCart((s) => s.totals)();
  const { placeOrder, placeGuestOrder } = useCheckout();
  const { logout } = useAuth();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  // Only a genuinely signed-in CUSTOMER orders with their account. Everyone else
  // — true guests, or an admin/kitchen-owner session in this browser — must
  // enter name/email/phone before paying (it becomes a guest order).
  const isGuest = status !== 'authenticated' || user?.role !== 'CUSTOMER';

  const [method, setMethod] = useState<PaymentMethod>('COD');
  const [note, setNote] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Guest contact details (only collected when not signed in).
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' });
  const [guestErrors, setGuestErrors] = useState<GuestErrors>({});

  if (cart.lines.length === 0) {
    return (
      <div className="px-4">
        <EmptyState
          title="Your cart is empty"
          description="Scan your room's QR code to start a new order."
        />
        <Link href="/" className="mx-auto block w-fit text-sm font-semibold text-brand">
          Go to home
        </Link>
      </div>
    );
  }

  if (!cart.roomId) {
    return (
      <div className="mx-auto max-w-xl w-full px-4 py-12 text-center">
        <EmptyState
          title="Room not scanned"
          description="In-room dining orders require a room number for delivery. Please scan the QR code in your room to continue."
        />
        <Link href="/" className="mt-4 mx-auto block w-fit text-sm font-semibold text-brand hover:underline">
          Scan QR Code
        </Link>
      </div>
    );
  }

  const grandTotal = Math.max(0, totals.total - (coupon?.discount ?? 0));

  const validateGuest = (): boolean => {
    const e: GuestErrors = {};
    if (guest.name.trim().length < 2) e.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(guest.email.trim())) e.email = 'Enter a valid email';
    if (guest.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number';
    setGuestErrors(e);
    return Object.keys(e).length === 0;
  };

  const applyCoupon = async () => {
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (isGuest) {
      // Guests have no coupon-preview endpoint — apply it server-side at checkout.
      setCoupon({ code, discount: 0 });
      return;
    }
    try {
      const res = await api.post<{ data: { discount: number; code: string } }>('/coupons/validate', {
        code,
        kitchen: cart.kitchenId,
        subtotal: totals.subtotal,
      });
      setCoupon({ code: res.data.data.code, discount: res.data.data.discount });
    } catch (err) {
      setCoupon(null);
      setCouponError(apiErrorMessage(err, 'Invalid coupon'));
    }
  };

  const submit = async () => {
    setError(null);
    if (isGuest && !validateGuest()) return;
    setBusy(true);
    try {
      if (!isGuest) {
        const { orderId, paid } = await placeOrder({
          paymentMethod: method,
          couponCode: coupon?.code,
          customerNote: note,
        });
        router.replace(method === 'RAZORPAY' && !paid ? `/orders/${orderId}` : `/orders/${orderId}?placed=1`);
        return;
      }
      const { token, paid } = await placeGuestOrder({
        guest: { name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim() },
        paymentMethod: method,
        couponCode: coupon?.code ?? (couponInput.trim() || undefined),
        customerNote: note,
      });
      router.replace(method === 'RAZORPAY' && !paid ? `/g/${token}` : `/g/${token}?placed=1`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not place your order'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl w-full pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-4 py-3">
        <button onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-zinc-700" />
        </button>
        <h1 className="font-bold text-zinc-900">Checkout</h1>
      </header>

      <div className="space-y-4 p-4">
        {cart.roomNumber ? (
          <p className="text-sm text-zinc-500">Delivering to Room {cart.roomNumber}</p>
        ) : null}

        {/* Items */}
        <Card className="divide-y p-4">
          {cart.lines.map((l) => (
            <div key={l.menuItem} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
              <FoodLabel label={l.foodLabel} />
              <span className="flex-1 text-sm text-zinc-800">
                {l.name} × {l.quantity}
              </span>
              <span className="text-sm font-medium">{formatINR(l.price * l.quantity)}</span>
            </div>
          ))}
        </Card>

        {/* Signed-in: order with the account; offer to switch to a guest order. */}
        {!isGuest ? (
          <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
            <p className="text-sm text-zinc-600">
              Ordering as <span className="font-medium text-zinc-900">{user?.email}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Order as guest
            </Button>
          </Card>
        ) : null}

        {/* Guest contact details (only when not signed in) */}
        {isGuest ? (
          <Card className="space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <UserRound className="h-4 w-4 text-brand" /> Your details
            </p>
            <p className="text-xs text-zinc-500">
              We&apos;ll send your order confirmation here. No account needed —{' '}
              <Link href={`/login?next=/checkout`} className="font-semibold text-brand hover:underline">
                sign in
              </Link>{' '}
              if you already have one.
            </p>
            <Field label="Full name" error={guestErrors.name}>
              <Input
                value={guest.name}
                onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
                placeholder="Your name"
                autoComplete="name"
              />
            </Field>
            <Field label="Email" error={guestErrors.email}>
              <Input
                type="email"
                value={guest.email}
                onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Phone" error={guestErrors.phone}>
              <Input
                type="tel"
                value={guest.phone}
                onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                autoComplete="tel"
              />
            </Field>
          </Card>
        ) : null}

        {/* Coupon */}
        <Card className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <BadgePercent className="h-4 w-4 text-brand" /> Apply a coupon
          </p>
          <div className="flex gap-2">
            <Input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="Coupon code"
            />
            <Button variant="outline" onClick={applyCoupon} disabled={!couponInput.trim()}>
              Apply
            </Button>
          </div>
          {coupon && coupon.discount > 0 ? (
            <p className="text-xs font-medium text-green-600">
              {coupon.code} applied — you save {formatINR(coupon.discount)}
            </p>
          ) : coupon ? (
            <p className="text-xs font-medium text-zinc-500">
              {coupon.code} will be applied at checkout.
            </p>
          ) : null}
          {couponError ? <p className="text-xs text-red-600">{couponError}</p> : null}
        </Card>

        {/* Note */}
        <Card className="p-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Add a note for the kitchen (allergies, instructions…)"
            className="w-full resize-none rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-brand"
          />
        </Card>

        {/* Payment method */}
        <Card className="space-y-2 p-4">
          <p className="text-sm font-semibold text-zinc-800">Payment</p>
          <PayOption
            active={method === 'RAZORPAY'}
            onClick={() => setMethod('RAZORPAY')}
            icon={<CreditCard className="h-5 w-5" />}
            title="Pay online"
            subtitle="UPI, cards, net banking, wallets"
          />
          <PayOption
            active={method === 'COD'}
            onClick={() => setMethod('COD')}
            icon={<Wallet className="h-5 w-5" />}
            title="Pay on delivery"
            subtitle="Cash when your order arrives"
          />
        </Card>

        {/* Bill */}
        <Card className="space-y-1 p-4">
          <Row label="Subtotal" value={totals.subtotal} />
          <Row label="Taxes" value={totals.tax} />
          <Row label="Service charge" value={totals.serviceCharge} />
          {coupon && coupon.discount > 0 ? (
            <Row label={`Discount (${coupon.code})`} value={-coupon.discount} />
          ) : null}
          <div className="flex justify-between border-t pt-2 text-base font-bold text-zinc-900">
            <span>To pay</span>
            <span>{formatINR(grandTotal)}</span>
          </div>
        </Card>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl border-t bg-white p-4">
        <Button size="lg" className="w-full" onClick={submit} disabled={busy}>
          {busy
            ? 'Placing order…'
            : method === 'RAZORPAY'
              ? `Pay ${formatINR(grandTotal)}`
              : `Place order · ${formatINR(grandTotal)}`}
        </Button>
      </div>
    </div>
  );
}

function PayOption({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
        active ? 'border-brand bg-brand-50' : 'border-zinc-200',
      )}
    >
      <span className={cn(active ? 'text-brand' : 'text-zinc-500')}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-zinc-900">{title}</span>
        <span className="block text-xs text-zinc-500">{subtitle}</span>
      </span>
      <span
        className={cn(
          'h-4 w-4 rounded-full border-2',
          active ? 'border-brand bg-brand' : 'border-zinc-300',
        )}
      />
    </button>
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

export default function CheckoutPage() {
  // Wait for the session to resolve so we know whether to collect guest details.
  const status = useAuthStore((s) => s.status);
  if (status === 'loading') return <CenteredSpinner label="Loading checkout…" />;
  return <CheckoutInner />;
}
