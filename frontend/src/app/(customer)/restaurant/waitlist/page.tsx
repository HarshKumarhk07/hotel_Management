'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Users, Phone, Mail, Sparkles, Shield, Clock, Search, ArrowRight, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState, Badge } from '@/components/ui/primitives';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useGuestWaitlistStatus, useWaitlistMutations } from '@/hooks/useWaitlist';
import { apiErrorMessage } from '@/lib/api';

import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';

export default function GuestWaitlistPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  
  const { join } = useWaitlistMutations();
  
  // Join Waitlist Form States
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [guestsCount, setGuestsCount] = useState(2);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [successEntry, setSuccessEntry] = useState<any | null>(null);

  // Status Lookup States
  const [lookupValue, setLookupValue] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const { data: statusData, isLoading: isLookingUp, refetch } = useGuestWaitlistStatus(
    lookupValue,
    searchEnabled
  );

  // Enforce login and prefill details
  useEffect(() => {
    if (authStatus !== 'loading') {
      if (!user) {
        alert('We are directing you to the sign-in page for further booking.');
        const redirectUrl = encodeURIComponent(window.location.pathname);
        router.replace(`/login?next=${redirectUrl}`);
      } else {
        if (!guestName) setGuestName(user.name);
        if (!email) setEmail(user.email);
        if (!phone && (user as any).phone) setPhone((user as any).phone);
        if (!lookupValue) {
            setLookupValue(user.email);
            setSearchEnabled(true);
        }
      }
    }
  }, [authStatus, user, router, guestName, email, phone, lookupValue]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    try {
      const res = await join.mutateAsync({
        guestName,
        phone,
        email,
        guestsCount: Number(guestsCount),
      });
      setSuccessEntry(res.data.data.waitlist);
      setLookupValue(email);
      setSearchEnabled(true);
      setGuestName('');
      setPhone('');
      setEmail('');
    } catch (err) {
      setJoinError(apiErrorMessage(err, 'Failed to join waitlist. Please try again.'));
    }
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupValue) return;
    setLookupError(null);
    setSearchEnabled(true);
    refetch().then((result) => {
      if (result.isError) {
        setLookupError('No active waitlist entry found matching details.');
      }
    });
  };

  // Reset search when lookupValue changes to require a fresh search query
  useEffect(() => {
    setSearchEnabled(false);
  }, [lookupValue]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6]">

      <main className="flex-1">
        {/* Banner Section */}
        <section className="relative bg-[#111111] py-20 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#D4AF37_0%,transparent_50%)] opacity-20 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-8 text-center space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37] ring-1 ring-[#D4AF37]/30">
              Fine Dining
            </span>
            <h1 className="text-4xl font-bold sm:text-6xl tracking-tight">Restaurant Waitlist</h1>
            <p className="mx-auto max-w-xl text-zinc-300 text-sm sm:text-base leading-relaxed">
              Reserve your spot in the queue at the Page Restaurant. Track estimated waiting times and get seated dynamically.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-8 py-16 grid gap-10 md:grid-cols-2">
          {/* Form to join the queue */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#D4AF37]">Join Restaurant Queue</h2>
              <p className="text-2xl font-bold text-zinc-900">Enter Dining Waitlist</p>
              <p className="text-sm text-zinc-500">Provide guest information below to register your group into our real-time seating manager.</p>
            </div>

            <Card className="p-6 border-[#ECECEC] bg-white rounded-3xl">
              <form onSubmit={handleJoin} className="space-y-4">
                <Field label="Guest Name">
                  <Input required placeholder="John Doe" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Phone Number">
                    <Input required placeholder="+91 99999 88888" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </Field>
                  <Field label="Email Address">
                    <Input required type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                </div>
                <Field label="Number of Guests (Party Size)">
                  <select
                    value={guestsCount}
                    onChange={(e) => setGuestsCount(Number(e.target.value))}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16].map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'Guest' : 'Guests'}
                      </option>
                    ))}
                  </select>
                </Field>

                {joinError && <FieldError message={joinError} />}

                <Button type="submit" disabled={join.isPending} className="w-full bg-[#111111] hover:bg-[#222222] text-white rounded-xl h-11 font-semibold gap-1.5">
                  {join.isPending ? 'Joining Queue…' : 'Join Waitlist'} <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </Card>
          </div>

          {/* Real-time queue tracker lookup */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#D4AF37]">Live Queue Position</h2>
              <p className="text-2xl font-bold text-zinc-900">Track Seating Status</p>
              <p className="text-sm text-zinc-500">Search using email/phone to check your dynamic waitlist ranking and estimated dining time.</p>
            </div>

            <Card className="p-6 border-[#ECECEC] bg-white rounded-3xl space-y-6">
              <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  placeholder="Enter email or phone"
                  value={lookupValue}
                  onChange={(e) => setLookupValue(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] min-w-0"
                />
                <Button type="submit" className="bg-[#D4AF37] hover:bg-[#AE963C] text-white rounded-xl px-5 h-11 font-semibold shrink-0">
                  Track
                </Button>
              </form>

              {lookupError && (
                <div className="flex items-center gap-2 text-xs text-red-600 font-semibold bg-red-50 border border-red-100 rounded-xl p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              {isLookingUp && <CenteredSpinner />}

              {statusData && (
                <div className="space-y-5 animate-fade-in">
                  <div className="rounded-2xl border border-[#ECECEC] bg-[#FAF9F6] p-6 space-y-5 text-center">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">Waitlist Status</span>
                      <div className="mt-1">
                        <Badge className={`
                          ${statusData.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : ''}
                          ${statusData.status === 'SEATED' ? 'bg-green-50 text-green-700' : ''}
                          ${statusData.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : ''}
                        `}>
                          {statusData.status === 'PENDING' ? 'Waiting' : statusData.status}
                        </Badge>
                      </div>
                    </div>

                    {statusData.status === 'PENDING' && (
                      <div className="grid grid-cols-2 gap-4 border-t border-[#ECECEC] pt-4">
                        <div className="border-r border-[#ECECEC] pr-2">
                          <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Queue Position</span>
                          <span className="block text-2xl font-bold text-zinc-950 mt-1">#{statusData.position}</span>
                          <span className="text-[10px] text-zinc-500 font-medium">group(s) ahead</span>
                        </div>
                        <div className="pl-2">
                          <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Est. Wait Time</span>
                          <span className="block text-2xl font-bold text-zinc-950 mt-1 flex items-center justify-center gap-1.5">
                            <Clock className="h-5 w-5 text-[#D4AF37]" /> {statusData.estimatedWaitMinutes} <span className="text-xs font-semibold text-zinc-500">mins</span>
                          </span>
                          <span className="text-[10px] text-zinc-500 font-medium">approximate</span>
                        </div>
                      </div>
                    )}

                    {statusData.status === 'SEATED' && (
                      <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-center text-xs space-y-1">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                        <p className="font-bold text-green-800">Your table is ready!</p>
                        <p className="text-green-700">Please present your name to the hostess at the restaurant lobby entrance.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </section>

        {/* Success Dialog */}
        {successEntry && (
          <Dialog open onClose={() => setSuccessEntry(null)} title="Waitlist Submission Confirmed">
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-lg text-zinc-900">Group Registered in Queue</h4>
                <p className="text-xs text-zinc-500">You are successfully added to the fine dining queue. Live progress metrics are generated.</p>
              </div>
              <div className="rounded-xl border bg-zinc-50 p-4 text-left text-xs space-y-1.5">
                <p><span className="font-bold text-zinc-500">Guest Name:</span> {successEntry.guestName}</p>
                <p><span className="font-bold text-zinc-500">Group Size:</span> {successEntry.guestsCount} Guests</p>
                <p><span className="font-bold text-zinc-500">Queue Position:</span> #{successEntry.position}</p>
                <p><span className="font-bold text-zinc-500">Est. Waiting:</span> {successEntry.position * 10} minutes</p>
              </div>
              <Button onClick={() => setSuccessEntry(null)} className="w-full bg-[#111111] hover:bg-[#222222] text-white rounded-xl">
                Track Status
              </Button>
            </div>
          </Dialog>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
