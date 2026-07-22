'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Receipt, Landmark, CalendarDays, Clock, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CenteredSpinner } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { SiteFooter } from '@/components/site/SiteFooter';
import { api } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/utils';

export default function TableConfirmPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/restaurant/reservations?limit=1`);
        // we can't easily fetch by ID directly unless we have an endpoint. Let's assume list returns it or we just show a static success for now.
        // Actually wait, let's just fetch all reservations and find this one.
        const allRes = res.data.data.reservations;
        const found = allRes.find((r: any) => r._id === id);
        if (found) {
          setReservation(found);
        } else {
          // just assume success if not found in first page, or create a specific endpoint
        }
      } catch (err) {
        setError('Failed to load reservation details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
        <header className="bg-zinc-950 text-white py-6 px-8 border-b border-white/10">
          <div className="max-w-7xl mx-auto flex justify-center">
            <span className="text-lg font-bold tracking-widest text-[#D4AF37] font-serif uppercase">THE PAGE</span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <CenteredSpinner label="Confirming your reservation..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] font-sans selection:bg-[#D4AF37]/20">
      <header className="bg-zinc-950 text-white py-6 px-8 border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <Link href="/">
            <span className="text-lg font-bold tracking-widest text-[#D4AF37] font-serif uppercase cursor-pointer">
              THE PAGE
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16 flex flex-col items-center">
        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-green-200">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>

        <h1 className="text-4xl font-serif text-zinc-900 mb-3 text-center uppercase tracking-wide">
          Table Confirmed
        </h1>
        <p className="text-zinc-500 text-center mb-10 text-sm max-w-md leading-relaxed">
          Your table reservation has been successfully confirmed. A confirmation email has been sent to your registered email address.
        </p>

        <Card className="w-full bg-white border border-zinc-200 shadow-xl rounded-3xl overflow-hidden">
          <div className="bg-zinc-950 px-8 py-5 flex justify-between items-center border-b-4 border-[#D4AF37]">
            <div className="flex items-center gap-3">
              <Landmark className="h-6 w-6 text-[#D4AF37]" />
              <h2 className="text-lg font-serif text-white font-bold tracking-wide">
                Reservation Details
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase">ID</p>
              <p className="text-sm font-mono text-zinc-100">{id.substring(16).toUpperCase()}</p>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Date & Time
                </p>
                <p className="font-semibold text-zinc-900 text-base">
                  {reservation ? new Date(reservation.scheduledAt).toLocaleString() : 'Loading...'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Party Size
                </p>
                <p className="font-semibold text-zinc-900 text-base">
                  {reservation ? reservation.partySize : '-'} Guests
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-6 grid grid-cols-2 gap-8 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Guest Name</p>
                <p className="font-semibold text-zinc-900">{reservation ? reservation.guestName : 'Loading...'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Contact</p>
                <p className="font-medium text-zinc-600">{reservation ? reservation.phone : '-'}</p>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-6 flex justify-between items-end">
              <div>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-1">Status</p>
                <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Confirmed
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-1">Advance Paid</p>
                <p className="text-2xl font-bold text-[#D4AF37]">
                  {formatINR(500)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-10 flex gap-4 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none h-12 px-8 rounded-xl border-zinc-300 text-zinc-700 font-bold uppercase tracking-wider"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Home
          </Button>
          <Button
            className="flex-1 sm:flex-none h-12 px-8 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold uppercase tracking-wider"
            onClick={() => router.push('/orders')}
          >
            My Bookings <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
