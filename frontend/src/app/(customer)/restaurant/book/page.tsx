'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Landmark, ArrowLeft, ArrowRight, Info, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Card, CenteredSpinner } from '@/components/ui/primitives';
import { SiteFooter } from '@/components/site/SiteFooter';
import { api, apiErrorMessage } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { loadRazorpay, openRazorpay, type RazorpayResponse } from '@/lib/razorpay';
import { useAuthStore } from '@/stores/auth';

function TableBookInner() {
  const router = useRouter();
  
  // Guest Details
  const user = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);

  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');

  const [availabilityMsg, setAvailabilityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Enforce login and prefill details
  useEffect(() => {
    if (authStatus !== 'loading') {
      if (!user) {
        alert('We are directing you to the sign-in page for further booking.');
        const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
        router.replace(`/login?next=${redirectUrl}`);
      } else {
        if (!guestName) setGuestName(user.name);
        if (!email) setEmail(user.email);
        if (!phone && (user as any).phone) setPhone((user as any).phone);
      }
    }
  }, [authStatus, user, router, guestName, email, phone]);

  const ADVANCE_AMOUNT = 500; // Hardcoded fixed advance for table booking

  const checkAvailability = async () => {
    if (!scheduledAt || !partySize) {
      setAvailabilityMsg({ type: 'error', text: 'Please select a date, time, and party size.' });
      return;
    }
    setCheckingAvailability(true);
    setAvailabilityMsg(null);
    try {
      const res = await api.get<{ data: any[] }>(`/restaurant/availability`, {
        params: { scheduledAt: new Date(scheduledAt).toISOString(), partySize, durationMins: 90 }
      });
      if (res.data.data.length > 0) {
        setAvailabilityMsg({ type: 'success', text: `Tables available for ${partySize} guests at selected time.` });
      } else {
        setAvailabilityMsg({ type: 'error', text: `Sorry, we are fully booked for this time.` });
      }
    } catch (err) {
      setAvailabilityMsg({ type: 'error', text: apiErrorMessage(err, 'Failed to check availability.') });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (availabilityMsg?.type !== 'success') {
      setPaymentError('Please check availability first.');
      return;
    }

    setPaymentError(null);
    setSubmitting(true);

    try {
      // 1. Create Table Reservation
      const bookingRes = await api.post<{ data: { _id: string } }>('/restaurant/reservations', {
        guestName,
        phone,
        email,
        partySize: Number(partySize),
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMins: 90,
        notes,
      });

      const reservationId = bookingRes.data.data._id;

      // 2. Load Razorpay
      const razorpayLoaded = await loadRazorpay();
      if (!razorpayLoaded) {
        throw new Error('Razorpay Checkout failed to load. Please verify your internet connection.');
      }

      // 3. Create Razorpay order
      const rzpRes = await api.post<{
        data: { keyId: string; razorpayOrderId: string; amount: number; currency: string };
      }>(`/restaurant/reservations/${reservationId}/razorpay`, { advanceAmount: ADVANCE_AMOUNT });

      const { keyId, razorpayOrderId, amount, currency } = rzpRes.data.data;

      // 4. Open widget
      openRazorpay({
        key: keyId,
        amount,
        currency,
        name: 'The Page Hotel',
        description: `Table Reservation Advance`,
        order_id: razorpayOrderId,
        prefill: {
          name: guestName,
          email,
          contact: phone,
        } as any,
        handler: async (response: RazorpayResponse) => {
          try {
            // 5. Verify signature
            await api.post(`/restaurant/reservations/${reservationId}/verify`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            // Redirect on success
            router.push(`/restaurant/book/confirm/${reservationId}`);
          } catch (err) {
            setPaymentError(apiErrorMessage(err, 'Payment verification failed. Please contact support.'));
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentError('Payment window was closed by the user. Note: Your selected table was locked temporarily and will be released shortly.');
            setSubmitting(false);
          },
        },
      });
    } catch (err) {
      setPaymentError(apiErrorMessage(err, 'Failed to complete reservation process.'));
      setSubmitting(false);
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <CenteredSpinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] font-sans selection:bg-[#D4AF37]/20">
      <header className="bg-zinc-950 text-white py-6 px-8 border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href={`/`} className="text-zinc-400 hover:text-[#D4AF37] flex items-center gap-1 text-sm font-semibold transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <span className="text-lg font-bold tracking-widest text-[#D4AF37] font-serif uppercase">THE PAGE</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 grid gap-8 lg:grid-cols-3">
        {/* Left Guest Form */}
        <div className="lg:col-span-2 space-y-6">
          <h1 className="text-3xl font-serif text-zinc-900 uppercase font-semibold">Table Reservation</h1>

          {paymentError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              {paymentError}
            </div>
          )}

          <form onSubmit={handleCheckoutSubmit} className="space-y-6">
            <Card className="p-6 bg-white border rounded-3xl space-y-4 shadow-sm">
              <h2 className="text-lg font-serif text-zinc-900 border-b pb-2 font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#D4AF37]" /> Date & Time
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Reservation Date & Time">
                  <Input required type="datetime-local" value={scheduledAt} onChange={(e) => {
                    setScheduledAt(e.target.value);
                    setAvailabilityMsg(null);
                  }} />
                </Field>
                <Field label="Party Size (Number of Guests)">
                  <Input required type="number" min="1" max="20" placeholder="2" value={partySize} onChange={(e) => {
                    setPartySize(e.target.value);
                    setAvailabilityMsg(null);
                  }} />
                </Field>
              </div>
              <Button type="button" onClick={checkAvailability} disabled={checkingAvailability || !scheduledAt || !partySize} variant="outline" className="w-full">
                {checkingAvailability ? 'Checking Availability...' : 'Check Availability'}
              </Button>
              {availabilityMsg && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${availabilityMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {availabilityMsg.type === 'success' ? <CheckCircle className="h-4 w-4 inline mr-1" /> : null}
                  {availabilityMsg.text}
                </div>
              )}
            </Card>

            <Card className={`p-6 bg-white border rounded-3xl space-y-4 shadow-sm ${availabilityMsg?.type !== 'success' ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-lg font-serif text-zinc-900 border-b pb-2 font-bold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-[#D4AF37]" /> Contact Information
              </h2>
              <Field label="Guest Full Name">
                <Input required placeholder="John Doe" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email Address">
                  <Input required type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Phone Number">
                  <Input required placeholder="+91 99999 88888" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
              </div>
              <div className="pt-2 border-t">
                <Field label="Special instructions or notes">
                  <textarea
                    rows={3}
                    placeholder="Dietary requests, window seat requests, celebrations, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs rounded-xl border border-zinc-200 p-2.5 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </Field>
              </div>
            </Card>

            <Button
              type="submit"
              disabled={submitting || availabilityMsg?.type !== 'success'}
              className="w-full bg-[#D4AF37] hover:bg-[#AE963C] text-white rounded-xl py-3.5 font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
            >
              {submitting ? 'Initiating Razorpay Checkout…' : `Pay Advance ${formatINR(ADVANCE_AMOUNT)} & Confirm`} <ArrowRight className="h-5 w-5" />
            </Button>
          </form>
        </div>

        {/* Right Summary Widget */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 shadow-md border bg-white rounded-3xl space-y-6">
            <h3 className="text-lg font-serif text-zinc-900 border-b pb-2 font-bold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-[#D4AF37]" /> Reservation Summary
            </h3>
            <div className="space-y-4 text-xs font-semibold text-zinc-700">
              <div className="flex justify-between border-b pb-3">
                <span>Date & Time</span>
                <span className="text-zinc-950 font-bold">{scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Not selected'}</span>
              </div>
              <div className="flex justify-between border-b pb-3">
                <span>Party Size</span>
                <span className="text-zinc-950 font-bold">{partySize} Guests</span>
              </div>
              <div className="flex justify-between border-b pb-3">
                <span>Duration</span>
                <span className="text-zinc-950 font-bold">90 Minutes</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3 text-xs">
              <div className="flex justify-between text-zinc-500 font-semibold">
                <span>Reservation Advance</span>
                <span className="text-zinc-900 font-bold">{formatINR(ADVANCE_AMOUNT)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold text-base text-zinc-950">
                <span>Total Due Now</span>
                <span className="text-[#D4AF37]">{formatINR(ADVANCE_AMOUNT)}</span>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 rounded-2xl flex gap-2 border border-zinc-200/50 text-[10px] text-zinc-400 font-semibold">
              <Info className="h-4 w-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
              <span>This advance payment locks your table and will be adjusted against your final bill at the restaurant.</span>
            </div>
            
            <div className="p-3 bg-zinc-50 rounded-2xl flex gap-2 border border-zinc-200/50 text-[10px] text-zinc-400 font-semibold">
              <Info className="h-4 w-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
              <span>Payments are processed securely via Razorpay. Your table is temporarily locked for 10 minutes when you proceed to payment.</span>
            </div>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export default function BookTablePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center text-zinc-400 text-sm">Loading...</div>}>
      <TableBookInner />
    </Suspense>
  );
}
