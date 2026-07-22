'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Landmark, CheckCircle2, Calendar, FileText, Download, Phone, MapPin, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState, Badge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';

interface BookingDetail {
  _id: string;
  room: {
    roomNumber: string;
    floor: number;
    roomType: string;
  };
  guestName: string;
  phone: string;
  email: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  status: string;
  paymentStatus: string;
  confirmationNumber: string;
  priceBreakdown: {
    roomPrice: number;
    nights: number;
    gst: number;
    serviceCharge: number;
    extraBedCharges: number;
    additionalCharges: number;
    couponCode?: string;
    discountAmount: number;
    grandTotal: number;
  };
  specialRequests?: {
    lateCheckIn?: boolean;
    extraBed?: boolean;
    airportPickup?: boolean;
    note?: string;
  };
}

export default function BookingConfirmationPage() {
  const params = useParams();

  const { data: booking, isLoading, isError } = useQuery<BookingDetail>({
    queryKey: ['booking-confirmation', params.id],
    queryFn: async () => {
      const res = await api.get<{ data: { booking: BookingDetail } }>(`/rooms/bookings/${params.id}`);
      return res.data.data.booking;
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

  if (isError || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <EmptyState title="Booking Not Found" description="The requested booking confirmation could not be loaded." />
      </div>
    );
  }

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrDataUrl = `${siteUrl}/rooms/confirm/${booking._id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    qrDataUrl
  )}`;

  const invoiceDownloadUrl = `${api.defaults.baseURL}/rooms/bookings/${booking._id}/invoice/download`;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] font-sans selection:bg-[#D4AF37]/20">
      <header className="bg-zinc-950 text-white py-6 px-8 border-b border-white/10 text-center">
        <span className="text-xl font-bold tracking-widest text-[#D4AF37] font-serif uppercase">THE PAGE</span>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 shadow-md">
            <CheckCircle2 className="h-10 w-10 text-green-600 animate-pulse" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.25em]">Imperial Reservation</span>
            <h1 className="text-3xl md:text-5xl font-serif text-zinc-900 uppercase font-semibold">Stay Confirmed!</h1>
            <p className="text-zinc-500 text-sm max-w-md mx-auto">
              Thank you, {booking.guestName}. Your premium suite booking is finalized. An email confirmation has been sent.
            </p>
          </div>
        </div>

        {/* Ticket Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6 md:col-span-2 bg-white border rounded-3xl space-y-6 shadow-sm">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Confirmation Number</span>
                <span className="text-xl font-bold text-zinc-950 font-mono tracking-wider">{booking.confirmationNumber || 'CONF-XYZ123'}</span>
              </div>
              <Badge className="bg-green-50 text-green-700 border border-green-200">
                {booking.paymentStatus === 'PAID' ? 'PAID IN FULL' : 'PENDING'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-zinc-700 border-b pb-4">
              <div>
                <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider block">Check-In</span>
                <span className="text-sm font-bold text-zinc-900">{new Date(booking.checkInDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
                <span className="text-zinc-400 block font-normal">After 14:00</span>
              </div>
              <div>
                <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider block">Check-Out</span>
                <span className="text-sm font-bold text-zinc-900">{new Date(booking.checkOutDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
                <span className="text-zinc-400 block font-normal">Before 12:00</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-serif font-bold text-zinc-900 flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-[#D4AF37]" /> Accommodated Room Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-semibold text-zinc-700">
                <div className="p-3 bg-[#FAF9F6] border border-[#ECECEC] rounded-2xl">
                  <span className="text-zinc-400 text-[9px] uppercase tracking-wider block">Room type</span>
                  <span className="font-bold text-zinc-900">{booking.room?.roomType || 'Standard'}</span>
                </div>
                <div className="p-3 bg-[#FAF9F6] border border-[#ECECEC] rounded-2xl">
                  <span className="text-zinc-400 text-[9px] uppercase tracking-wider block">Room Number</span>
                  <span className="font-bold text-zinc-900">Room {booking.room?.roomNumber || 'N/A'}</span>
                </div>
                <div className="p-3 bg-[#FAF9F6] border border-[#ECECEC] rounded-2xl col-span-2 md:col-span-1">
                  <span className="text-zinc-400 text-[9px] uppercase tracking-wider block">Floor level</span>
                  <span className="font-bold text-zinc-900">Floor {booking.room?.floor || 0}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-serif font-bold text-zinc-900">Guest Information</h3>
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-zinc-700">
                <div>
                  <span className="text-zinc-400 block">Name</span>
                  <span className="text-zinc-950 font-bold">{booking.guestName}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Phone</span>
                  <span className="text-zinc-950 font-bold">{booking.phone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-400 block">Email</span>
                  <span className="text-zinc-950 font-bold">{booking.email}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 md:col-span-1 bg-white border rounded-3xl space-y-6 shadow-sm flex flex-col justify-between items-center text-center">
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Fast Check-In QR</span>
              <p className="text-[10px] text-zinc-400 max-w-[180px]">Present this QR at check-in counter for immediate keys resolution.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Checkin QR Code" className="w-36 h-36 border p-2 rounded-2xl bg-zinc-50" />
            <div className="w-full space-y-2.5">
              <a
                href={invoiceDownloadUrl}
                download={`invoice-${booking.confirmationNumber || booking._id}.pdf`}
                className="w-full h-11 border border-zinc-200 hover:bg-zinc-50 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-800 transition-all"
              >
                <Download className="h-4 w-4 text-[#D4AF37]" /> Download Invoice PDF
              </a>
              <Link href="/rooms" className="w-full h-11 bg-zinc-950 hover:bg-zinc-900 text-white rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold shadow-md transition-all">
                Browse Rooms <ArrowRight className="h-4 w-4 text-[#D4AF37]" />
              </Link>
            </div>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
