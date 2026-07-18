'use client';

import { useCallback } from 'react';
import { api } from '@/lib/api';
import { loadRazorpay, openRazorpay, type RazorpayResponse } from '@/lib/razorpay';
import { useCart } from '@/stores/cart';
import { useAuthStore } from '@/stores/auth';

export type PaymentMethod = 'COD' | 'RAZORPAY';

interface PlacedOrder {
  _id: string;
  orderNumber: string;
  payment: { method: string; status: string; amount: number };
}

/**
 * Drives checkout end-to-end:
 *  1. push the client cart to the server cart (server is the price authority),
 *  2. create the order,
 *  3. for Razorpay, create a gateway order, open the widget, and verify the
 *     callback signature before treating the order as paid.
 */
export function useCheckout() {
  const cart = useCart();
  const user = useAuthStore((s) => s.user);

  const syncServerCart = useCallback(async () => {
    if (!cart.kitchenId || !cart.roomId) throw new Error('Missing room/kitchen context');
    // Start clean so quantities are exact (idempotent re-checkout).
    await api.delete(`/cart/${cart.kitchenId}`).catch(() => undefined);
    for (const line of cart.lines) {
      // eslint-disable-next-line no-await-in-loop
      await api.post('/cart/items', {
        room: cart.roomId,
        menuItem: line.menuItem,
        quantity: line.quantity,
        note: line.note,
      });
    }
  }, [cart]);

  const placeOrder = useCallback(
    async (opts: { paymentMethod: PaymentMethod; couponCode?: string; customerNote?: string }) => {
      await syncServerCart();

      const res = await api.post<{ data: { order: PlacedOrder } }>('/orders/checkout', {
        kitchen: cart.kitchenId,
        paymentMethod: opts.paymentMethod,
        couponCode: opts.couponCode || undefined,
        customerNote: opts.customerNote || undefined,
      });
      const order = res.data.data.order;

      if (opts.paymentMethod !== 'RAZORPAY') {
        cart.clear();
        return { orderId: order._id, paid: false };
      }

      // ── Razorpay flow ──
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment gateway');

      const rzp = await api.post<{
        data: { keyId: string; razorpayOrderId: string; amount: number; currency: string };
      }>(`/payments/orders/${order._id}/razorpay`);
      const { keyId, razorpayOrderId, amount, currency } = rzp.data.data;

      const paid = await new Promise<boolean>((resolve, reject) => {
        openRazorpay({
          key: keyId,
          amount,
          currency,
          order_id: razorpayOrderId,
          name: cart.kitchenName ?? 'Room Service',
          description: `Order ${order.orderNumber}`,
          prefill: { name: user?.name, email: user?.email },
          theme: { color: '#ea580c' },
          handler: async (response: RazorpayResponse) => {
            try {
              await api.post(`/payments/orders/${order._id}/verify`, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              resolve(true);
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              // Mark the attempt failed so the order can be retried later.
              void api.post(`/payments/orders/${order._id}/failed`, { reason: 'Cancelled by user' });
              resolve(false);
            },
          },
        });
      });

      if (paid) cart.clear();
      return { orderId: order._id, paid };
    },
    [cart, syncServerCart, user],
  );

  /**
   * Guest checkout (no account). Items go straight to the server (which
   * recomputes prices); returns an opaque access token the guest uses to pay
   * and track the order. Mirrors the Razorpay flow via the guest endpoints.
   */
  const placeGuestOrder = useCallback(
    async (opts: {
      guest: { name: string; email: string; phone: string };
      paymentMethod: PaymentMethod;
      couponCode?: string;
      customerNote?: string;
    }) => {
      if (!cart.kitchenId || !cart.roomId) throw new Error('Missing room/kitchen context');

      const res = await api.post<{ data: { order: PlacedOrder; guestAccessToken: string } }>(
        '/orders/guest-checkout',
        {
          kitchen: cart.kitchenId,
          room: cart.roomId,
          items: cart.lines.map((l) => ({ menuItem: l.menuItem, quantity: l.quantity, note: l.note })),
          guest: opts.guest,
          paymentMethod: opts.paymentMethod,
          couponCode: opts.couponCode || undefined,
          customerNote: opts.customerNote || undefined,
        },
      );
      const { order, guestAccessToken: token } = res.data.data;

      if (opts.paymentMethod !== 'RAZORPAY') {
        cart.clear();
        return { token, paid: false };
      }

      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment gateway');

      const rzp = await api.post<{
        data: { keyId: string; razorpayOrderId: string; amount: number; currency: string };
      }>('/payments/guest/razorpay', { token });
      const { keyId, razorpayOrderId, amount, currency } = rzp.data.data;

      const paid = await new Promise<boolean>((resolve, reject) => {
        openRazorpay({
          key: keyId,
          amount,
          currency,
          order_id: razorpayOrderId,
          name: cart.kitchenName ?? 'Room Service',
          description: `Order ${order.orderNumber}`,
          prefill: { name: opts.guest.name, email: opts.guest.email },
          theme: { color: '#ea580c' },
          handler: async (response: RazorpayResponse) => {
            try {
              await api.post('/payments/guest/verify', {
                token,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              resolve(true);
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => resolve(false) },
        });
      });

      if (paid) cart.clear();
      return { token, paid };
    },
    [cart],
  );

  return { placeOrder, placeGuestOrder };
}
