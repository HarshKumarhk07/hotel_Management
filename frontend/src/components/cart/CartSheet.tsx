'use client';

import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FoodLabel } from '@/components/ui/primitives';
import { useCart } from '@/stores/cart';
import { formatINR } from '@/lib/utils';

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const totals = useCart((s) => s.totals)();

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[80vh] max-w-md overflow-hidden rounded-t-2xl bg-white"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-bold text-zinc-900">Your order</h2>
              <button onClick={onClose} aria-label="Close">
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>

            <div className="max-h-[45vh] overflow-y-auto px-4">
              {lines.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500">Your cart is empty.</p>
              ) : (
                lines.map((l) => (
                  <div key={l.menuItem} className="flex items-center gap-3 border-b py-3">
                    <FoodLabel label={l.foodLabel} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{l.name}</p>
                      <p className="text-xs text-zinc-500">{formatINR(l.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
                      <button onClick={() => setQty(l.menuItem, l.quantity - 1)} aria-label="Decrease">
                        <Minus className="h-4 w-4 text-brand" />
                      </button>
                      <span className="w-4 text-center text-sm font-bold">{l.quantity}</span>
                      <button onClick={() => setQty(l.menuItem, l.quantity + 1)} aria-label="Increase">
                        <Plus className="h-4 w-4 text-brand" />
                      </button>
                    </div>
                    <button onClick={() => remove(l.menuItem)} aria-label="Remove">
                      <Trash2 className="h-4 w-4 text-zinc-400" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {lines.length > 0 ? (
              <div className="space-y-2 border-t bg-zinc-50 px-4 py-4">
                <Row label="Subtotal" value={totals.subtotal} />
                <Row label="Taxes" value={totals.tax} />
                <Row label="Service charge" value={totals.serviceCharge} />
                <div className="flex justify-between pt-1 text-base font-bold text-zinc-900">
                  <span>Total</span>
                  <span>{formatINR(totals.total)}</span>
                </div>
                <Button
                  className="mt-2 w-full"
                  size="lg"
                  onClick={() => {
                    onClose();
                    router.push('/checkout');
                  }}
                >
                  Proceed to checkout · {formatINR(totals.total)}
                </Button>
              </div>
            ) : null}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
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
