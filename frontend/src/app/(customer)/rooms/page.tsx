'use client';

import { useState } from 'react';
import NextImage from 'next/image';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Calendar, User, Phone, Mail, Sparkles, Shield, Clock, Search, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SiteNav } from '@/components/site/SiteNav';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState, Badge } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { api, apiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface AvailableRoom {
  _id: string;
  roomNumber: string;
  floor: number;
  status: string;
  kitchen?: { name: string };
}

interface CustomerBooking {
  _id: string;
  room: { roomNumber: string; floor: number };
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  status: string;
  paymentStatus: string;
}

export default function GuestRoomsPage() {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [floor, setFloor] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [bookingRoom, setBookingRoom] = useState<AvailableRoom | null>(null);

  // Booking form details
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<any | null>(null);

  // My bookings lookup
  const [lookupValue, setLookupValue] = useState('');
  const [hasLookedUp, setHasLookedUp] = useState(false);

  // Fetch available rooms
  const { data: rooms, isLoading: isSearching, refetch: executeSearch } = useQuery({
    queryKey: ['available-rooms', checkIn, checkOut, floor],
    enabled: false,
    queryFn: async () => {
      const res = await api.get<{ data: { rooms: AvailableRoom[] } }>('/rooms/search', {
        params: {
          checkInDate: new Date(checkIn).toISOString(),
          checkOutDate: new Date(checkOut).toISOString(),
          floor: floor ? Number(floor) : undefined,
        },
      });
      return res.data.data.rooms;
    },
  });

  // Fetch my bookings
  const { data: myBookings, isLoading: isLookingUp, refetch: executeLookup } = useQuery({
    queryKey: ['my-room-bookings', lookupValue],
    enabled: false,
    queryFn: async () => {
      const isEmail = lookupValue.includes('@');
      const res = await api.get<{ data: { bookings: CustomerBooking[] } }>('/rooms/bookings/my-bookings', {
        params: isEmail ? { email: lookupValue } : { phone: lookupValue },
      });
      return res.data.data.bookings;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIn || !checkOut) return;
    setHasSearched(true);
    executeSearch();
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupValue) return;
    setHasLookedUp(true);
    executeLookup();
  };

  // Submit booking mutation
  const bookMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/rooms/bookings', payload);
      return res.data.data.booking;
    },
    onSuccess: (data) => {
      setSuccessBooking(data);
      setBookingRoom(null);
      setGuestName('');
      setPhone('');
      setEmail('');
      // Invalidate lookup to refresh lists
      if (lookupValue) executeLookup();
    },
    onError: (err) => {
      setSubmitError(apiErrorMessage(err, 'Could not complete booking reservation.'));
    },
  });

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRoom || !checkIn || !checkOut) return;
    setSubmitError(null);
    bookMutation.mutate({
      room: bookingRoom._id,
      guestName,
      phone,
      email,
      checkInDate: new Date(checkIn).toISOString(),
      checkOutDate: new Date(checkOut).toISOString(),
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6]">
      <SiteNav fullMenuHref="/" />

      <main className="flex-1">
        {/* Banner Section */}
        <section className="relative bg-[#111111] py-20 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#D4AF37_0%,transparent_50%)] opacity-20 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-8 text-center space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37] ring-1 ring-[#D4AF37]/30">
              Luxury Stays
            </span>
            <h1 className="text-4xl font-bold sm:text-6xl tracking-tight">Luxury Room Booking</h1>
            <p className="mx-auto max-w-xl text-zinc-300 text-sm sm:text-base leading-relaxed">
              Reserve your premium suite at The Page Hotel. Experience world-class hospitality, in-room dining, and personal valet services.
            </p>
          </div>
        </section>

        {/* Date search bar */}
        <section className="mx-auto max-w-5xl px-8 -mt-8 relative z-10">
          <Card className="p-6 shadow-xl border-[#ECECEC] bg-white rounded-3xl">
            <form onSubmit={handleSearch} className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 md:items-end">
              <Field label="Check-In Date">
                <div className="relative">
                  <Input
                    type="date"
                    required
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </Field>
              <Field label="Check-Out Date">
                <div className="relative">
                  <Input
                    type="date"
                    required
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    min={checkIn || new Date().toISOString().split('T')[0]}
                  />
                </div>
              </Field>
              <Field label="Floor Preference">
                <select
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="">Any Floor</option>
                  <option value="1">1st Floor</option>
                  <option value="2">2nd Floor</option>
                  <option value="3">3rd Floor</option>
                </select>
              </Field>
              <Button type="submit" className="bg-[#D4AF37] hover:bg-[#AE963C] text-white h-11 w-full rounded-xl gap-2 font-semibold">
                <Search className="h-4 w-4" /> Check Availability
              </Button>
            </form>
          </Card>
        </section>

        {/* Available Rooms Grid */}
        <section className="mx-auto max-w-7xl px-8 py-16">
          {hasSearched && (
            <div className="space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#D4AF37]">Available Accommodations</h2>
              {isSearching ? (
                <CenteredSpinner />
              ) : !rooms || rooms.length === 0 ? (
                <EmptyState title="No rooms available" description="All rooms are booked for the selected dates. Try adjusting your dates." />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((room) => (
                    <Card key={room._id} className="overflow-hidden bg-white border border-[#ECECEC] rounded-3xl flex flex-col justify-between group shadow-sm transition-all duration-300 hover:shadow-xl">
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                        <NextImage
                          src="/hotel1.png"
                          alt="Luxury suite"
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 30vw"
                        />
                        <div className="absolute top-4 left-4 rounded-xl bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white">
                          Floor {room.floor}
                        </div>
                      </div>
                      <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold text-[#111111]">Premium Luxury Room {room.roomNumber}</h3>
                          <p className="text-xs text-zinc-500">Includes secure QR ordering, direct in-room KDS delivery service, and smart valet support.</p>
                          <div className="flex items-center gap-4 text-xs text-zinc-400 font-semibold pt-1">
                            <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-[#D4AF37]" /> Fully Insured</span>
                            <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" /> Luxury Linens</span>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-[#ECECEC] flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Per Night</span>
                            <span className="text-xl font-bold text-[#111111]">₹5,000</span>
                          </div>
                          <Button
                            onClick={() => setBookingRoom(room)}
                            className="bg-[#111111] hover:bg-[#222222] text-white rounded-xl font-semibold gap-1.5"
                          >
                            Book Room <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* My Bookings Lookup Section */}
        <section className="border-t border-[#ECECEC] bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-8 space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">Lookup Reservation</span>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Manage Your Booking</h2>
              <p className="text-sm text-zinc-500">Enter your email address or phone number to check reservation status or retrieve checkout codes.</p>
            </div>

            <Card className="p-5 border-[#ECECEC] bg-[#FAF9F6] rounded-3xl">
              <form onSubmit={handleLookup} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Enter email or phone (e.g. guest@example.com)"
                  value={lookupValue}
                  onChange={(e) => setLookupValue(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
                <Button type="submit" className="bg-[#111111] hover:bg-[#222222] text-white rounded-xl px-6 h-11 font-semibold">
                  Search Bookings
                </Button>
              </form>
            </Card>

            {hasLookedUp && (
              <div className="space-y-4 pt-4">
                {isLookingUp ? (
                  <CenteredSpinner />
                ) : !myBookings || myBookings.length === 0 ? (
                  <p className="text-center text-sm text-zinc-500">No active bookings found matching your request details.</p>
                ) : (
                  myBookings.map((b) => (
                    <Card key={b._id} className="p-5 border-[#ECECEC] bg-white rounded-2xl flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="font-bold text-zinc-900 text-lg">Room {b.room?.roomNumber || 'Unknown'}</p>
                        <p className="text-xs text-zinc-500">
                          Check-in: {formatDate(b.checkInDate)} | Check-out: {formatDate(b.checkOutDate)}
                        </p>
                        <p className="text-xs font-semibold text-zinc-700">Guest: {b.guestName} | Total Price: ₹{b.totalPrice}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge className={`
                          ${b.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : ''}
                          ${b.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' : ''}
                          ${b.status === 'CHECKED_IN' ? 'bg-green-50 text-green-700' : ''}
                          ${b.status === 'CHECKED_OUT' ? 'bg-zinc-100 text-zinc-700' : ''}
                          ${b.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : ''}
                        `}>
                          {b.status}
                        </Badge>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        {/* Success Modal */}
        {successBooking && (
          <Dialog open onClose={() => setSuccessBooking(null)} title="Booking Submitted Successfully">
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-lg text-zinc-900">Your reservation has been received!</h4>
                <p className="text-xs text-zinc-500">Room booking is currently in pending state. Hotel administration will review and confirm shortly.</p>
              </div>
              <div className="rounded-xl border bg-zinc-50 p-4 text-left text-xs space-y-1.5">
                <p><span className="font-bold text-zinc-500">Booking ID:</span> {successBooking._id}</p>
                <p><span className="font-bold text-zinc-500">Guest Name:</span> {successBooking.guestName}</p>
                <p><span className="font-bold text-zinc-500">Check-in:</span> {formatDate(successBooking.checkInDate)}</p>
                <p><span className="font-bold text-zinc-500">Check-out:</span> {formatDate(successBooking.checkOutDate)}</p>
                <p><span className="font-bold text-zinc-500">Total Nights Price:</span> ₹{successBooking.totalPrice}</p>
              </div>
              <Button onClick={() => setSuccessBooking(null)} className="w-full bg-[#111111] hover:bg-[#222222] text-white rounded-xl">
                Close
              </Button>
            </div>
          </Dialog>
        )}

        {/* Booking Creation Dialog */}
        {bookingRoom && (
          <Dialog open onClose={() => setBookingRoom(null)} title={`Book Room ${bookingRoom.roomNumber}`}>
            <form onSubmit={handleBookSubmit} className="space-y-4">
              <div className="rounded-xl border bg-[#FAF9F6] p-3 text-xs flex justify-between">
                <span>Check-in: <b>{formatDate(checkIn)}</b></span>
                <span>Check-out: <b>{formatDate(checkOut)}</b></span>
              </div>
              <Field label="Guest Full Name">
                <Input required placeholder="John Doe" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone Number">
                  <Input required placeholder="+91 99999 88888" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Email Address">
                  <Input required type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
              </div>
              {submitError && <FieldError message={submitError} />}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setBookingRoom(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={bookMutation.isPending} className="bg-[#D4AF37] hover:bg-[#AE963C] text-white">
                  {bookMutation.isPending ? 'Submitting Reservation…' : 'Submit Reservation'}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
