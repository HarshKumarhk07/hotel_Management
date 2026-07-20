'use client';

import { useState } from 'react';
import NextImage from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, User, Shield, Sparkles, Clock, ArrowLeft, ArrowRight, ShieldAlert, Check } from 'lucide-react';
import Link from 'next/link';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState, Badge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';

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
  cancellationPolicy: string;
  rules: string[];
  checkInTime: string;
  checkOutTime: string;
}

export default function RoomDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [checkIn, setCheckIn] = useState(searchParams.get('checkInDate') || '');
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOutDate') || '');
  const [guestCount, setGuestCount] = useState(searchParams.get('guestCount') || '1');

  const { data: room, isLoading, isError } = useQuery<RoomDetail>({
    queryKey: ['room-detail', params.id],
    queryFn: async () => {
      const res = await api.get<{ data: { room: RoomDetail } }>(`/rooms/${params.id}`);
      return res.data.data.room;
    },
    enabled: !!params.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <CenteredSpinner />
      </div>
    );
  }

  if (isError || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <EmptyState title="Room Not Found" description="The requested room could not be resolved. Please browse available categories." />
      </div>
    );
  }

  // Calculate price summary
  let nights = 0;
  let roomCharges = 0;
  let gst = 0;
  let serviceCharge = 0;
  let grandTotal = 0;

  if (checkIn && checkOut) {
    const s = new Date(checkIn);
    const e = new Date(checkOut);
    if (s < e) {
      nights = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
      roomCharges = nights * room.pricePerNight;
      gst = Math.round(roomCharges * 0.18);
      serviceCharge = Math.round(roomCharges * 0.05);
      grandTotal = roomCharges + gst + serviceCharge;
    }
  }

  const handleBookRedirect = () => {
    if (!checkIn || !checkOut) {
      alert('Please select check-in and check-out dates to lock availability.');
      return;
    }
    router.push(
      `/rooms/book?room=${room._id}&checkIn=${checkIn}&checkOut=${checkOut}&guestCount=${guestCount}`
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] font-sans selection:bg-[#D4AF37]/20">
      <header className="bg-zinc-950 text-white py-6 px-8 border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/rooms" className="text-zinc-400 hover:text-[#D4AF37] flex items-center gap-1 text-sm font-semibold transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Accommodations
          </Link>
          <span className="text-lg font-bold tracking-widest text-[#D4AF37] font-serif uppercase">THE PAGE</span>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero image slider area */}
        <section className="relative h-[450px] w-full overflow-hidden bg-zinc-900 text-white">
          <NextImage
            src={room.images?.[0] || '/hotel1.png'}
            alt={room.roomType}
            fill
            className="object-cover brightness-[0.4]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
          <div className="absolute bottom-12 left-10 right-10 max-w-7xl mx-auto space-y-3">
            <Badge className="bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              {room.roomType} SUITE
            </Badge>
            <h1 className="text-4xl md:text-6xl font-serif tracking-tight text-white uppercase">{room.roomType} Room #{room.roomNumber}</h1>
            <p className="text-zinc-300 text-sm max-w-2xl">
              Experience the pinnacle of royal heritage hospitality on Floor {room.floor} with fully insulated walls, direct concierge connectivity, and private services.
            </p>
          </div>
        </section>

        {/* Details Grid */}
        <section className="max-w-7xl mx-auto px-6 py-16 grid gap-10 lg:grid-cols-3 relative">
          <div className="lg:col-span-2 space-y-12">
            {/* Description & Bed Specs */}
            <div className="space-y-4">
              <h2 className="text-2xl font-serif text-zinc-900 border-b pb-3 font-semibold">About The Room</h2>
              <p className="text-zinc-600 leading-relaxed text-sm">
                Each of our {room.roomType.toLowerCase()} chambers represents a tailored design blending timeless imperial details with state of the art luxury. Designed with premium high-thread count linens, bespoke wooden frames, large windows that allow beautiful morning views, and an attached bath equipped with therapeutic spa amenities.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs font-semibold text-zinc-700">
                <div className="p-3.5 bg-white border border-[#ECECEC] rounded-2xl space-y-1">
                  <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider block">Max Guests</span>
                  <span className="text-sm font-bold flex items-center gap-1"><User className="h-4 w-4 text-[#D4AF37]" /> {room.capacity} Adults</span>
                </div>
                <div className="p-3.5 bg-white border border-[#ECECEC] rounded-2xl space-y-1">
                  <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider block">Bed Type</span>
                  <span className="text-sm font-bold flex items-center gap-1"><Sparkles className="h-4 w-4 text-[#D4AF37]" /> {room.bedType} Size</span>
                </div>
                <div className="p-3.5 bg-white border border-[#ECECEC] rounded-2xl space-y-1">
                  <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider block">Room Size</span>
                  <span className="text-sm font-bold flex items-center gap-1"><Clock className="h-4 w-4 text-[#D4AF37]" /> {room.roomSizeSqFt} Sq Ft</span>
                </div>
                <div className="p-3.5 bg-white border border-[#ECECEC] rounded-2xl space-y-1">
                  <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider block">Check-In</span>
                  <span className="text-sm font-bold flex items-center gap-1"><Clock className="h-4 w-4 text-[#D4AF37]" /> {room.checkInTime}</span>
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div className="space-y-4">
              <h2 className="text-2xl font-serif text-zinc-900 border-b pb-3 font-semibold">Included Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {room.amenities.map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-zinc-700 text-xs py-1.5 px-3 bg-white border rounded-xl shadow-sm">
                    <Check className="h-4 w-4 text-[#D4AF37] flex-shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules & Policy */}
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-serif text-zinc-900 border-b pb-3 font-semibold">Rules &amp; Regulations</h2>
                <ul className="space-y-2 text-zinc-600 text-xs list-disc pl-5">
                  {room.rules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                  <li>Please present valid government-approved identity proof at reception checkout.</li>
                </ul>
              </div>
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex gap-3 text-xs text-orange-800">
                <ShieldAlert className="h-5 w-5 text-orange-600 flex-shrink-0" />
                <div>
                  <span className="font-bold">Cancellation Policy:</span> {room.cancellationPolicy}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Booking Summary Card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-28 p-6 shadow-xl border-[#ECECEC] bg-white rounded-3xl space-y-6">
              <div>
                <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Base Rate</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-zinc-900">{formatINR(room.pricePerNight)}</span>
                  <span className="text-xs text-zinc-500 font-semibold">/ Night</span>
                </div>
              </div>

              <div className="space-y-4 border-t border-b py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Check-In</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full text-xs font-semibold rounded-xl border border-zinc-200 p-2.5 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Check-Out</label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      min={checkIn || new Date().toISOString().split('T')[0]}
                      className="w-full text-xs font-semibold rounded-xl border border-zinc-200 p-2.5 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Guests</label>
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-zinc-200 p-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="1">1 Guest</option>
                    <option value="2">2 Guests</option>
                    <option value="3">3 Guests</option>
                    <option value="4">4 Guests</option>
                  </select>
                </div>
              </div>

              {nights > 0 ? (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between text-zinc-500 font-semibold">
                    <span>{formatINR(room.pricePerNight)} x {nights} Nights</span>
                    <span className="text-zinc-900 font-bold">{formatINR(roomCharges)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500 font-semibold">
                    <span>GST (18%)</span>
                    <span className="text-zinc-900 font-bold">{formatINR(gst)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500 font-semibold">
                    <span>Luxury Service Charge (5%)</span>
                    <span className="text-zinc-900 font-bold">{formatINR(serviceCharge)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-bold text-base text-zinc-950">
                    <span>Estimated Total</span>
                    <span className="text-[#D4AF37]">{formatINR(grandTotal)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 text-center font-medium">Select dates above to see pricing breakdown details.</p>
              )}

              <Button
                onClick={handleBookRedirect}
                className="w-full bg-[#111111] hover:bg-[#222222] text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-1 text-sm shadow-md"
              >
                Proceed to Reservation <ArrowRight className="h-4 w-4" />
              </Button>
            </Card>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
