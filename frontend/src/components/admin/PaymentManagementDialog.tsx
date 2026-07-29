'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Badge, CenteredSpinner, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useAdminBookings, useBookingMutations, RoomBookingInfo } from '@/hooks/useAdminRooms';
import { formatINR, formatDate } from '@/lib/utils';
import { loadRazorpay, openRazorpay } from '@/lib/razorpay';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

export function PaymentManagementDialog({
  bookingId,
  onClose,
}: {
  bookingId: string;
  onClose: () => void;
}) {
  const { data: bookings } = useAdminBookings();
  const { recordPayment } = useBookingMutations();
  const booking = bookings?.find((b) => b._id === bookingId);

  const [isProcessing, setIsProcessing] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<string>('');
  const [noteText, setNoteText] = useState(booking?.paymentNote || '');

  if (!booking) return null;

  const handlePayOnline = async () => {
    try {
      setIsProcessing(true);
      const razorpayLoaded = await loadRazorpay();
      if (!razorpayLoaded) {
        throw new Error('Razorpay failed to load.');
      }

      const rzpRes = await api.post<{
        data: { keyId: string; razorpayOrderId: string; amount: number; currency: string };
      }>(`/rooms/bookings/${booking._id}/razorpay`);

      const { keyId, razorpayOrderId, amount, currency } = rzpRes.data.data;

      openRazorpay({
        key: keyId,
        amount,
        currency,
        name: 'The Page Hotel (Admin Collection)',
        description: `Booking #${booking._id.substring(18).toUpperCase()}`,
        order_id: razorpayOrderId,
        prefill: {
          name: booking.guestName,
          email: booking.email,
          contact: booking.phone,
        } as any,
        handler: async (response) => {
          try {
            await api.post(`/rooms/bookings/${booking._id}/verify`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('Online Payment collected successfully.');
            // Note: verification already sets status to PAID via backend, but we can call recordPayment for audit if needed,
            // or just rely on verifyPayment. Wait, verifyPayment doesn't write to paymentHistory.
            // Let's call recordPayment just to be sure it's in paymentHistory.
            recordPayment.mutate({ id: booking._id, status: 'PAID', method: 'RAZORPAY', note: 'Collected online via Admin Dashboard.' });
            onClose();
          } catch (err) {
            toast.error(apiErrorMessage(err, 'Payment verification failed.'));
          }
        },
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to initiate Razorpay'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCash = () => {
    if (confirm('Confirm collecting cash from guest?')) {
      recordPayment.mutate(
        { id: booking._id, status: 'PAID', method: 'CASH', note: noteText },
        {
          onSuccess: () => {
            toast.success('Cash payment recorded.');
            onClose();
          },
          onError: (err) => toast.error(apiErrorMessage(err, 'Failed to record cash payment.')),
        }
      );
    }
  };

  const handleUpdateNote = () => {
    if (!overrideStatus && noteText === (booking.paymentNote || '')) {
      toast.error('Select a status or edit note to update');
      return;
    }
    const statusToSave = overrideStatus || booking.paymentStatus;
    recordPayment.mutate(
      { id: booking._id, status: statusToSave as 'PAID' | 'PENDING', note: noteText },
      {
        onSuccess: () => {
          toast.success('Payment updated.');
          onClose();
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'Failed to update payment.')),
      }
    );
  };

  return (
    <Dialog open onClose={onClose} title="Manage Booking Payment" widthClass="max-w-2xl">
      <div className="space-y-6">
        <div className="flex justify-between border-b pb-4">
          <div>
            <h3 className="font-bold text-zinc-900 text-lg">Room {booking.room.roomNumber}</h3>
            <p className="text-sm text-zinc-500">{booking.guestName}</p>
          </div>
          <div className="text-right space-y-1 text-sm font-semibold text-zinc-700">
            <p>Total Due: <span className="text-[#D4AF37] text-xl font-bold">₹{booking.totalPrice}</span></p>
            <p className="flex justify-end gap-2 items-center">Status: {booking.paymentStatus === 'PAID' ? <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge> : <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>}</p>
            <p>Method: {booking.payment?.method || 'N/A'}</p>
          </div>
        </div>

        {booking.paymentStatus !== 'PAID' && (
          <div className="grid grid-cols-2 gap-4 border-b pb-6">
            <Button disabled={isProcessing || recordPayment.isPending} onClick={handlePayOnline} className="bg-indigo-600 hover:bg-indigo-700 h-12">
              Collect via Razorpay
            </Button>
            <Button disabled={isProcessing || recordPayment.isPending} onClick={handleCash} className="bg-emerald-600 hover:bg-emerald-700 h-12">
              Collect Cash
            </Button>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="font-bold text-sm text-zinc-900">Update Details & Notes</h4>
          <div className="flex gap-4">
            <select
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value)}
              className="text-sm rounded-lg border border-zinc-200 px-3 py-2 w-40"
            >
              <option value="">(No Status Change)</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
            </select>
            <input 
              type="text" 
              placeholder="Admin Note (e.g., Guest paying later)" 
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="text-sm rounded-lg border border-zinc-200 px-3 py-2 flex-1"
            />
            <Button disabled={recordPayment.isPending} onClick={handleUpdateNote}>Update</Button>
          </div>
        </div>

        {booking.paymentHistory && booking.paymentHistory.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-bold text-sm text-zinc-900">Payment Audit Log</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {booking.paymentHistory.map((h, i) => (
                <div key={i} className="text-xs bg-zinc-50 border border-zinc-100 p-3 rounded-xl space-y-1">
                  <div className="flex justify-between font-bold text-zinc-800">
                    <span>{h.previousStatus} → {h.newStatus} ({h.method})</span>
                    <span className="text-zinc-500 font-normal">{formatDate(h.timestamp)}</span>
                  </div>
                  {h.note && <p className="text-zinc-600 font-medium">Note: {h.note}</p>}
                  <p className="text-zinc-400">By: {h.updatedBy || 'System'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
