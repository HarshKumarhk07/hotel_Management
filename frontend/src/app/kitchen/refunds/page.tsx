'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, ShieldAlert, Search, AlertCircle } from 'lucide-react';
import { KitchenShell } from '@/components/kitchen/KitchenShell';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { Field, Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

interface RefundOrder {
  _id: string;
  orderNumber: string;
  kitchen: { name: string } | string;
  createdAt: string;
  status: string;
  pricing: { total: number };
  payment: { status: string; method: string };
  refund: { status: string; amount: number; reason?: string };
}

export default function KitchenRefundsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const [searchOrderNum, setSearchOrderNum] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<RefundOrder | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // These lists are force-scoped to the owner's own kitchen by the backend.
  const { data: pendingRequests, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['kitchen-refund-pending'],
    queryFn: async () => {
      const res = await api.get<{ data: { orders: RefundOrder[] } }>('/orders?refundStatus=REQUESTED&limit=100');
      return res.data.data.orders;
    },
  });

  const { data: refundHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['kitchen-refund-history'],
    queryFn: async () => {
      const res = await api.get<{ data: { orders: RefundOrder[] } }>('/orders?refundStatus=REFUNDED&limit=100');
      return res.data.data.orders;
    },
  });

  const handleSearchOrder = async () => {
    setSearchError(null);
    setSearchedOrder(null);
    if (!searchOrderNum.trim()) return;
    try {
      const res = await api.get<{ data: { orders: RefundOrder[] } }>(`/orders?limit=10`);
      const found = res.data.data.orders.find(
        (o) => o.orderNumber.toLowerCase() === searchOrderNum.trim().toLowerCase(),
      );
      if (!found) {
        setSearchError('Order not found.');
        return;
      }
      if (found.payment.status !== 'PAID') {
        setSearchError('This order is not fully paid.');
        return;
      }
      if (found.refund.status === 'REFUNDED' || found.refund.status === 'REQUESTED') {
        setSearchError(`Refund is already ${found.refund.status.toLowerCase()}.`);
        return;
      }
      setSearchedOrder(found);
    } catch {
      setSearchError('Error searching for order.');
    }
  };

  const handleRequestSubmit = async () => {
    if (!searchedOrder || !refundReason.trim()) {
      toast.error('Please fill out all fields.');
      return;
    }
    setSubmittingRequest(true);
    try {
      await api.post(`/orders/${searchedOrder._id}/refund-request`, { reason: refundReason.trim() });
      toast.success('Refund request submitted successfully!');
      setRequestModalOpen(false);
      setSearchOrderNum('');
      setSearchedOrder(null);
      setRefundReason('');
      refetchPending();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Could not submit refund request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <KitchenShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-brand" /> Refunds
          </h1>
          <p className="text-sm text-zinc-500">Submit refund requests for completed guest orders</p>
        </div>
        <Button onClick={() => setRequestModalOpen(true)} className="flex items-center gap-1.5">
          <RotateCcw className="h-4 w-4" /> Request Refund
        </Button>
      </div>

      <div className="mb-4 flex border-b">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-colors ${
            activeTab === 'pending' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Pending Approval ({pendingRequests?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-colors ${
            activeTab === 'history' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Processed Refunds
        </button>
      </div>

      {activeTab === 'pending' ? (
        pendingLoading ? (
          <CenteredSpinner label="Loading pending refund requests…" />
        ) : !pendingRequests || pendingRequests.length === 0 ? (
          <EmptyState title="No pending requests" description="All refund requests have been settled." />
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((o) => (
              <Card key={o._id} className="p-5 flex flex-wrap justify-between items-start gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-zinc-900">Order #{o.orderNumber}</span>
                    <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700 uppercase">
                      Awaiting Admin Approval
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">Date: {new Date(o.createdAt).toLocaleString()}</p>
                  <p className="text-sm font-semibold text-zinc-900">
                    Refund Amount: <span className="text-green-600">{formatINR(o.pricing.total)}</span>
                  </p>
                  {o.refund.reason && (
                    <div className="text-xs text-zinc-600 bg-zinc-50 border rounded-lg p-2 max-w-lg mt-2">
                      <span className="font-bold block text-[10px] uppercase text-zinc-400">Reason</span>
                      {`"${o.refund.reason}"`}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : historyLoading ? (
        <CenteredSpinner label="Loading processed refunds…" />
      ) : !refundHistory || refundHistory.length === 0 ? (
        <EmptyState title="No refunds history" description="No refunds have been processed yet." />
      ) : (
        <div className="space-y-4">
          {refundHistory.map((o) => (
            <Card key={o._id} className="p-5 flex flex-wrap justify-between items-start gap-4">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-zinc-900">Order #{o.orderNumber}</span>
                  <span className="rounded bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-semibold text-green-700 uppercase">
                    Refunded
                  </span>
                </div>
                <p className="text-xs text-zinc-500">Date: {new Date(o.createdAt).toLocaleString()}</p>
                <p className="text-sm font-semibold text-zinc-900">
                  Refunded Amount: <span className="text-green-600">{formatINR(o.refund.amount || o.pricing.total)}</span>
                </p>
                {o.refund.reason && <p className="text-xs text-zinc-500 italic">Reason: {`"${o.refund.reason}"`}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {requestModalOpen && (
        <Dialog open onClose={() => setRequestModalOpen(false)} title="Request Order Refund" widthClass="max-w-md">
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Awaiting Admin Approval</p>
                <p>Refunds requested by Kitchen Owners require Super Admin approval before being processed.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search order number (e.g. #ORD-12345)"
                  value={searchOrderNum}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchOrderNum(e.target.value)}
                />
              </div>
              <Button onClick={handleSearchOrder} variant="outline" className="flex items-center gap-1">
                <Search className="h-4 w-4" /> Search
              </Button>
            </div>
            {searchError && (
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {searchError}
              </p>
            )}
            {searchedOrder && (
              <div className="rounded-xl border bg-zinc-50 p-4 space-y-2 text-sm shadow-inner">
                <p className="font-bold text-zinc-800">Order #{searchedOrder.orderNumber}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                  <p>Amount: <span className="font-bold text-zinc-800">{formatINR(searchedOrder.pricing.total)}</span></p>
                  <p>Payment: <span className="font-bold text-zinc-800">{searchedOrder.payment.method} ({searchedOrder.payment.status})</span></p>
                  <p>Status: <span className="font-bold text-zinc-800">{searchedOrder.status}</span></p>
                  <p>Date: <span className="font-bold text-zinc-800">{new Date(searchedOrder.createdAt).toLocaleDateString()}</span></p>
                </div>
              </div>
            )}
            <Field label="Refund Reason">
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Explain why the refund is being requested..."
                rows={3}
                className="w-full resize-none rounded-lg border border-zinc-300 p-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRequestModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRequestSubmit} disabled={submittingRequest || !searchedOrder || !refundReason.trim()}>
                {submittingRequest ? 'Submitting…' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </KitchenShell>
  );
}
