'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Landmark, ArrowLeft, ArrowRight, ShieldCheck, Tag, Info } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { SiteFooter } from '@/components/site/SiteFooter';
import { api, apiErrorMessage } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { loadRazorpay, openRazorpay, type RazorpayResponse } from '@/lib/razorpay';

interface RoomDetail {
  _id: string;
  roomNumber: string;
  floor: number;
  status: string;
  roomType: string;
  capacity: number;
  bedType: string;
  roomSizeSqFt: number;
  amenities: string[];
  pricePerNight: number;
  images: string[];
  kitchen?: string | { _id: string; name: string };
}

function BookRoomInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = searchParams.get('room');
  const checkIn = searchParams.get('checkIn') || '';
  const checkOut = searchParams.get('checkOut') || '';
  const guestCount = Number(searchParams.get('guestCount') || '1');

  // Guest Details
  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('India');
  const [governmentId, setGovernmentId] = useState('');

  // Special Requests
  const [lateCheckIn, setLateCheckIn] = useState(false);
  const [extraBed, setExtraBed] = useState(false);
  const [airportPickup, setAirportPickup] = useState(false);
  const [specialNote, setSpecialNote] = useState('');

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'RAZORPAY' | 'CASH'>('RAZORPAY');

  // Fetch room details
  const { data: room, isLoading } = useQuery<RoomDetail>({
    queryKey: ['room-book-detail', roomId],
    queryFn: async () => {
      const res = await api.get<{ data: { room: RoomDetail } }>(`/rooms/${roomId}`);
      return res.data.data.room;
    },
    enabled: !!roomId,
  });

  // Calculate pricing
  let nights = 0;
  let roomCharges = 0;
  let extraBedCharges = 0;
  let additionalCharges = 0;
  let subtotal = 0;
  let gst = 0;
  let serviceCharge = 0;
  let grandTotal = 0;

  if (room && checkIn && checkOut) {
    const s = new Date(checkIn);
    const e = new Date(checkOut);
    if (s < e) {
      nights = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
      roomCharges = nights * room.pricePerNight;
      extraBedCharges = extraBed ? 1000 * nights : 0;
      additionalCharges = airportPickup ? 1500 : 0;

      subtotal = roomCharges + extraBedCharges + additionalCharges;
      gst = Math.round(subtotal * 0.18);
      serviceCharge = Math.round(subtotal * 0.05);
      grandTotal = Math.max(0, subtotal + gst + serviceCharge - discountAmount);
    }
  }

  // Auto-validate coupon whenever subtotal changes if coupon applied
  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await api.post<{ data: { discount: number } }>('/coupons/validate', {
        code,
        kitchenId: room?.kitchen || 'room-billing',
        subtotal: subtotal,
      });
      return res.data.data;
    },
    onSuccess: (data, code) => {
      setDiscountAmount(data.discount);
      setAppliedCoupon(code.toUpperCase());
      setCouponError(null);
    },
    onError: (err) => {
      setCouponError(apiErrorMessage(err, 'Failed to validate coupon code.'));
      setDiscountAmount(0);
      setAppliedCoupon(null);
    },
  });

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode) return;
    setCouponError(null);
    applyCouponMutation.mutate(couponCode);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !checkIn || !checkOut) return;

    setPaymentError(null);
    setSubmitting(true);

    try {
      // 1. Create Room Booking
      const bookingRes = await api.post<{ data: { booking: { _id: string } } }>('/rooms/bookings', {
        room: room._id,
        guestName,
        phone,
        email,
        checkInDate: new Date(checkIn).toISOString(),
        checkOutDate: new Date(checkOut).toISOString(),
        address,
        city,
        country,
        governmentId,
        specialRequests: {
          lateCheckIn,
          extraBed,
          airportPickup,
          note: specialNote,
        },
        couponCode: appliedCoupon || undefined,
        paymentMethod,
      });

      const booking = bookingRes.data.data.booking;

      if (paymentMethod === 'CASH') {
        router.push(`/rooms/confirm/${booking._id}`);
        return;
      }

      // 2. Load Razorpay
      const razorpayLoaded = await loadRazorpay();
      if (!razorpayLoaded) {
        throw new Error('Razorpay Checkout failed to load. Please verify your internet connection.');
      }

      // 3. Create Razorpay order
      const rzpRes = await api.post<{
        data: { keyId: string; razorpayOrderId: string; amount: number; currency: string };
      }>(`/rooms/bookings/${booking._id}/razorpay`);

      const { keyId, razorpayOrderId, amount, currency } = rzpRes.data.data;

      // 4. Open widget
      openRazorpay({
        key: keyId,
        amount,
        currency,
        name: 'The Page Hotel',
        description: `${room.roomType} Booking`,
        order_id: razorpayOrderId,
        prefill: {
          name: guestName,
          email,
          contact: phone,
        } as any,
        handler: async (response: RazorpayResponse) => {
          try {
            // 5. Verify signature
            await api.post(`/rooms/bookings/${booking._id}/verify`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            // Redirect on success
            router.push(`/rooms/confirm/${booking._id}`);
          } catch (err) {
            setPaymentError(apiErrorMessage(err, 'Payment verification failed. Please contact support.'));
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentError('Payment window was closed by the user.');
            setSubmitting(false);
          },
        },
      });
    } catch (err) {
      setPaymentError(apiErrorMessage(err, 'Failed to complete reservation process.'));
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <CenteredSpinner />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <EmptyState title="No Room Selected" description="Please choose an available room suite from accommodations list." />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] font-sans selection:bg-[#D4AF37]/20">
      <header className="bg-zinc-950 text-white py-6 px-8 border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href={`/rooms/${room._id}?checkInDate=${checkIn}&checkOutDate=${checkOut}`} className="text-zinc-400 hover:text-[#D4AF37] flex items-center gap-1 text-sm font-semibold transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Room Details
          </Link>
          <span className="text-lg font-bold tracking-widest text-[#D4AF37] font-serif uppercase">THE PAGE</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 grid gap-8 lg:grid-cols-3">
        {/* Left Guest Form */}
        <div className="lg:col-span-2 space-y-6">
          <h1 className="text-3xl font-serif text-zinc-900 uppercase font-semibold">Guest Registration</h1>

          {paymentError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              {paymentError}
            </div>
          )}

          <form onSubmit={handleCheckoutSubmit} className="space-y-6">
            <Card className="p-6 bg-white border rounded-3xl space-y-4 shadow-sm">
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
            </Card>

            <Card className="p-6 bg-white border rounded-3xl space-y-4 shadow-sm">
              <h2 className="text-lg font-serif text-zinc-900 border-b pb-2 font-bold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-[#D4AF37]" /> Billing Address
              </h2>
              <Field label="Street Address">
                <Input placeholder="123 Palace Lane" value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City">
                  <Input placeholder="Mumbai" value={city} onChange={(e) => setCity(e.target.value)} />
                </Field>
                <Field label="Country">
                  <Input placeholder="India" value={country} onChange={(e) => setCountry(e.target.value)} />
                </Field>
              </div>
              <Field label="Government ID Card (Optional)">
                <Input placeholder="Aadhaar Card / Passport No" value={governmentId} onChange={(e) => setGovernmentId(e.target.value)} />
              </Field>
            </Card>

            <Card className="p-6 bg-white border rounded-3xl space-y-4 shadow-sm">
              <h2 className="text-lg font-serif text-zinc-900 border-b pb-2 font-bold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-[#D4AF37]" /> Special Requests &amp; Add-ons
              </h2>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 text-xs text-zinc-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lateCheckIn}
                    onChange={(e) => setLateCheckIn(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                  />
                  <div>
                    <span className="block font-bold">Late Check-In Request</span>
                    <span className="text-zinc-400 font-normal">Arriving after standard 14:00 check-in time.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 text-xs text-zinc-700 font-semibold cursor-pointer border-t pt-3">
                  <input
                    type="checkbox"
                    checked={extraBed}
                    onChange={(e) => setExtraBed(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                  />
                  <div>
                    <span className="block font-bold">Request Extra Bed (+ ₹1,000 / Night)</span>
                    <span className="text-zinc-400 font-normal">Add rollaway single bed inside the suite.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 text-xs text-zinc-700 font-semibold cursor-pointer border-t pt-3">
                  <input
                    type="checkbox"
                    checked={airportPickup}
                    onChange={(e) => setAirportPickup(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                  />
                  <div>
                    <span className="block font-bold">Airport Luxury Pickup (+ ₹1,500 Flat)</span>
                    <span className="text-zinc-400 font-normal">Bespoke chauffeur sedan pickup service on arrival.</span>
                  </div>
                </label>
              </div>

              <div className="pt-2 border-t">
                <Field label="Special instructions or notes">
                  <textarea
                    rows={3}
                    placeholder="Dietary requests, floor suggestions, etc."
                    value={specialNote}
                    onChange={(e) => setSpecialNote(e.target.value)}
                    className="w-full text-xs rounded-xl border border-zinc-200 p-2.5 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </Field>
              </div>
            </Card>

            <Card className="p-6 bg-white border rounded-3xl space-y-4 shadow-sm">
              <h2 className="text-lg font-serif text-zinc-900 border-b pb-2 font-bold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-[#D4AF37]" /> Payment Method
              </h2>
              <p className="text-[11px] text-zinc-400">Choose your preferred way to settle the reservation billing:</p>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div
                  onClick={() => setPaymentMethod('RAZORPAY')}
                  className={`border-2 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                    paymentMethod === 'RAZORPAY'
                      ? 'border-[#D4AF37] bg-amber-50/20'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <span className="text-xs font-bold text-zinc-800">Pay Online Now</span>
                  <span className="text-[10px] text-zinc-400 text-center">Instant confirmation via Razorpay checkout</span>
                </div>
                <div
                  onClick={() => setPaymentMethod('CASH')}
                  className={`border-2 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-[#D4AF37] bg-amber-50/20'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  }`}
                >
                  <span className="text-xs font-bold text-zinc-800">Pay at Hotel</span>
                  <span className="text-[10px] text-zinc-400 text-center">Settle bill at hotel counter during check-in</span>
                </div>
              </div>
            </Card>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#D4AF37] hover:bg-[#AE963C] text-white rounded-xl py-3.5 font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
            >
              {submitting
                ? paymentMethod === 'CASH'
                  ? 'Confirming Stay…'
                  : 'Initiating Razorpay Settle…'
                : paymentMethod === 'CASH'
                ? 'Confirm Reservation (Pay at Hotel)'
                : 'Secure Booking Payment & Confirm'}{' '}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>
        </div>

        {/* Right Summary Widget */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 shadow-md border bg-white rounded-3xl space-y-6">
            <h3 className="text-lg font-serif text-zinc-900 border-b pb-2 font-bold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-[#D4AF37]" /> Stay Details
            </h3>
            <div className="space-y-4 text-xs font-semibold text-zinc-700">
              <div className="flex justify-between border-b pb-3">
                <span>Room type</span>
                <span className="text-zinc-950 font-bold">{room.roomType} Room #{room.roomNumber}</span>
              </div>
              <div className="flex justify-between border-b pb-3">
                <span>Check-in</span>
                <span className="text-zinc-950 font-bold">{checkIn}</span>
              </div>
              <div className="flex justify-between border-b pb-3">
                <span>Check-out</span>
                <span className="text-zinc-950 font-bold">{checkOut}</span>
              </div>
              <div className="flex justify-between border-b pb-3">
                <span>Duration</span>
                <span className="text-zinc-950 font-bold">{nights} Nights Stay</span>
              </div>
            </div>

            <form onSubmit={handleApplyCoupon} className="space-y-2 border-t pt-4">
              <label className="text-[10px] font-bold text-zinc-400 uppercase block">Apply Coupon</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="SAVE10"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="h-10 text-xs rounded-xl border border-zinc-200 px-3 bg-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37] flex-1 uppercase"
                />
                <Button type="submit" size="sm" className="h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-4">
                  Apply
                </Button>
              </div>
              {appliedCoupon && (
                <div className="flex items-center gap-1.5 text-green-700 font-semibold text-xs pt-1">
                  <Tag className="h-3.5 w-3.5" /> Coupon code applied: <b>{appliedCoupon}</b>
                </div>
              )}
              {couponError && <div className="text-red-600 text-[11px] font-semibold pt-1">{couponError}</div>}
            </form>

            <div className="border-t pt-4 space-y-3 text-xs">
              <div className="flex justify-between text-zinc-500 font-semibold">
                <span>Room stay rate</span>
                <span className="text-zinc-900 font-bold">{formatINR(roomCharges)}</span>
              </div>
              {extraBedCharges > 0 && (
                <div className="flex justify-between text-zinc-500 font-semibold">
                  <span>Extra rollaway bed</span>
                  <span className="text-zinc-900 font-bold">{formatINR(extraBedCharges)}</span>
                </div>
              )}
              {additionalCharges > 0 && (
                <div className="flex justify-between text-zinc-500 font-semibold">
                  <span>Airport sedan transfer</span>
                  <span className="text-zinc-900 font-bold">{formatINR(additionalCharges)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-700 font-semibold">
                  <span>Promo discount</span>
                  <span className="font-bold">-{formatINR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-500 font-semibold">
                <span>Taxes &amp; GST (18%)</span>
                <span className="text-zinc-900 font-bold">{formatINR(gst)}</span>
              </div>
              <div className="flex justify-between text-zinc-500 font-semibold">
                <span>Imperial Service Charge (5%)</span>
                <span className="text-zinc-900 font-bold">{formatINR(serviceCharge)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold text-base text-zinc-950">
                <span>Grand Total</span>
                <span className="text-[#D4AF37]">{formatINR(grandTotal)}</span>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 rounded-2xl flex gap-2 border border-zinc-200/50 text-[10px] text-zinc-400 font-semibold">
              <Info className="h-4 w-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
              <span>Payments verified by Razorpay signature checks. Cash settlement options available upon arrival verification.</span>
            </div>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export default function BookRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center text-zinc-400 text-sm">Loading...</div>}>
      <BookRoomInner />
    </Suspense>
  );
}
