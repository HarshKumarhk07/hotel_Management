import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';
import { CenteredSpinner, Badge } from '@/components/ui/primitives';
import { UtensilsCrossed } from 'lucide-react';

interface BillData {
  table: any;
  orders: {
    _id: string;
    orderNumber: string;
    status: string;
    pricing: { total: number };
  }[];
  consolidated: {
    subtotal: number;
    taxTotal: number;
    serviceCharge: number;
    discount: number;
    grandTotal: number;
    amountPaid: number;
    amountDue: number;
  } | null;
}

export function StaffBillModal({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ data: BillData }>({
    queryKey: ['table-bill', tableId],
    queryFn: () => api.get(`/restaurant/tables/${tableId}/bill`).then(r => r.data),
  });

  const bill = data?.data;

  return (
    <Dialog open onClose={onClose} title="Table Bill">
      {isLoading ? <CenteredSpinner /> : bill ? (
        <div className="space-y-4">
          {bill.orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <UtensilsCrossed className="h-10 w-10 text-zinc-300" />
              <p className="font-semibold text-zinc-600">No orders this session</p>
              <p className="text-xs text-zinc-400">Guests haven&apos;t placed any orders from the table QR code yet.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-500">{bill.orders.length} order(s) this session</p>
              <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
                {bill.orders.map(o => (
                  <div key={o._id} className="flex items-center justify-between px-4 py-3 text-sm bg-white hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">{o.orderNumber}</span>
                      <Badge className={o.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>{o.status}</Badge>
                    </div>
                    <span className="font-bold text-zinc-900">₹{o.pricing.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex flex-col gap-2 rounded-xl bg-zinc-900 text-white px-5 py-4">
            <div className="flex items-center justify-between font-semibold text-zinc-300">
              <span>Subtotal</span>
              <span>₹{bill.consolidated?.subtotal.toFixed(2) ?? '0.00'}</span>
            </div>
            {bill.consolidated?.discount && bill.consolidated.discount > 0 ? (
              <div className="flex items-center justify-between font-semibold text-emerald-400">
                <span>Discount</span>
                <span>-₹{bill.consolidated.discount.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between font-semibold text-zinc-300">
              <span>Taxes</span>
              <span>₹{bill.consolidated?.taxTotal.toFixed(2) ?? '0.00'}</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-zinc-300">
              <span>Service Charge</span>
              <span>₹{bill.consolidated?.serviceCharge.toFixed(2) ?? '0.00'}</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-700">
              <span className="font-semibold text-zinc-100">Grand Total</span>
              <span className="text-2xl font-bold">₹{bill.consolidated?.grandTotal.toFixed(2) ?? '0.00'}</span>
            </div>
            {(bill.consolidated?.amountPaid ?? 0) > 0 && (
              <>
                <div className="flex items-center justify-between font-semibold text-emerald-400">
                  <span>Amount Paid</span>
                  <span>₹{bill.consolidated?.amountPaid.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-red-400">
                  <span>Amount Due</span>
                  <span>₹{bill.consolidated?.amountDue.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
