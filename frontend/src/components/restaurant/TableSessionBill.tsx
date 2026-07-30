import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';
import { Receipt, X, AlertCircle } from 'lucide-react';
import { CenteredSpinner } from '@/components/ui/primitives';

export function TableSessionBill({ tableId, open, onClose }: { tableId: string, open: boolean, onClose: () => void }) {
  const queryClient = useQueryClient();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['table-bill', tableId],
    queryFn: async () => {
      const res = await api.get(`/restaurant/tables/${tableId}/bill`);
      return res.data.data;
    },
    enabled: open,
    refetchInterval: 10000,
  });

  const requestBillMut = useMutation({
    mutationFn: async () => {
      await api.post(`/restaurant/tables/${tableId}/customer-request-bill`);
    },
    onSuccess: () => {
      toast.success('Bill requested successfully. A staff member will attend to you shortly.');
      queryClient.invalidateQueries({ queryKey: ['table-bill', tableId] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to request bill'));
    }
  });

  if (!open) return null;

  const bill = data?.consolidated;
  const table = data?.table;
  const isBilling = table?.status === 'BILLING';

  return (
    <Dialog open={open} onClose={onClose} title="Your Table Bill">
      {isLoading ? (
        <CenteredSpinner label="Fetching your bill..." />
      ) : error || !data ? (
        <div className="py-8 text-center text-red-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Failed to load bill</p>
        </div>
      ) : !bill ? (
        <div className="py-8 text-center text-zinc-500">
          <Receipt className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
          <p>No active dining session found or no items ordered yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border bg-zinc-50 p-4 space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-800 text-center border-b pb-2">
              Consolidated Bill
            </h4>
            
            <div className="space-y-1.5 text-sm text-zinc-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatINR(bill.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes</span>
                <span>{formatINR(bill.taxTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Charge</span>
                <span>{formatINR(bill.serviceCharge)}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatINR(bill.discount)}</span>
                </div>
              )}
            </div>
            
            <div className="pt-3 border-t flex justify-between font-bold text-lg text-zinc-900">
              <span>Grand Total</span>
              <span>{formatINR(bill.grandTotal)}</span>
            </div>
            
            {bill.amountPaid > 0 && (
              <div className="pt-2 flex justify-between text-sm font-bold text-green-600">
                <span>Amount Paid</span>
                <span>{formatINR(bill.amountPaid)}</span>
              </div>
            )}
            
            {bill.amountDue > 0 && bill.amountPaid > 0 && (
              <div className="flex justify-between text-sm font-bold text-red-600">
                <span>Amount Due</span>
                <span>{formatINR(bill.amountDue)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => requestBillMut.mutate()} 
              disabled={isBilling || requestBillMut.isPending || bill.grandTotal === 0}
              className="w-full bg-[#D4AF37] hover:bg-[#AE963C] text-zinc-950 font-bold"
            >
              {requestBillMut.isPending ? 'Requesting...' : isBilling ? 'Bill Already Requested' : 'Request Bill'}
            </Button>
            {isBilling && (
              <p className="text-xs text-center text-zinc-500">
                You have already requested the bill. Staff will arrive shortly.
              </p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
