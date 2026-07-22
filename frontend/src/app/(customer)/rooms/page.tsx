'use client';

import { useState } from 'react';
import NextImage from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Calendar, User, Phone, Mail, Sparkles, Shield, Clock, Search, ArrowRight, CheckCircle2, ChevronRight, Tag } from 'lucide-react';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState, Badge } from '@/components/ui/primitives';
import { Field, Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDate, formatINR } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface AvailableRoom {
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
}

interface CustomerBooking {
  _id: string;
  room: { roomNumber: string; floor: number; roomType: string };
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  status: string;
  paymentStatus: string;
  confirmationNumber?: string;
}

export default function GuestRoomsPage() {
  const router = useRouter();

  // Search dates and preferences
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [floor, setFloor] = useState('');
  const [roomType, setRoomType] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const hasSearched = !!checkIn && !!checkOut;

  // My bookings lookup
  const [lookupValue, setLookupValue] = useState('');
  const [hasLookedUp, setHasLookedUp] = useState(false);

  // Fetch available rooms
  const { data: rooms, isLoading: isSearching, refetch: executeSearch } = useQuery({
    queryKey: ['available-rooms', checkIn, checkOut, floor, roomType, minPrice, maxPrice, guestCount],
    enabled: !!checkIn && !!checkOut,
    queryFn: async () => {
      const res = await api.get<{ data: { rooms: AvailableRoom[] } }>('/rooms/search', {
        params: {
          checkInDate: checkIn ? new Date(checkIn).toISOString() : undefined,
          checkOutDate: checkOut ? new Date(checkOut).toISOString() : undefined,
          floor: floor ? Number(floor) : undefined,
          roomType: roomType || undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          guestCount: guestCount ? Number(guestCount) : undefined,
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
    executeSearch();
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupValue) return;
    setHasLookedUp(true);
    executeLookup();
  };

  const handleBookRedirect = (room: AvailableRoom) => {
    if (!checkIn || !checkOut) {
      toast.error('Please fill out check-in and check-out dates to confirm availability.');
      return;
    }
    router.push(
      `/rooms/book?room=${room._id}&checkIn=${checkIn}&checkOut=${checkOut}&guestCount=${guestCount}`
    );
  };

  const handleDetailsRedirect = (room: AvailableRoom) => {
    router.push(
      `/rooms/${room._id}?checkInDate=${checkIn}&checkOutDate=${checkOut}&guestCount=${guestCount}`
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] font-sans selection:bg-[#D4AF37]/20">
      <main className="flex-1">
        {/* Banner Section */}
        <section className="relative bg-[#111111] py-24 text-white overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#D4AF37_0%,transparent_50%)] opacity-20 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-8 text-center space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37] ring-1 ring-[#D4AF37]/30">
              Luxury Stays
            </span>
            <h1 className="text-4xl font-serif sm:text-6xl tracking-tight uppercase">Luxury Accommodations</h1>
            <p className="mx-auto max-w-xl text-zinc-300 text-sm leading-relaxed">
              Reserve your premium suite at The Page Hotel. Experience world-class hospitality, check-in timelines, private valet service, and gourmet in-room dining.
            </p>
          </div>
        </section>

        {/* Date search bar */}
        <section className="mx-auto max-w-6xl px-6 -mt-12 relative z-10">
          <Card className="p-6 shadow-xl border-[#ECECEC] bg-white rounded-3xl">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 md:items-end">
                <Field label="Check-In Date">
                  <Input
                    type="date"
                    required
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </Field>
                <Field label="Check-Out Date">
                  <Input
                    type="date"
                    required
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    min={checkIn || new Date().toISOString().split('T')[0]}
                  />
                </Field>
                <Field label="Room Type Class">
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="">Any Room Type</option>
                    <option value="STANDARD">Standard Class</option>
                    <option value="DELUXE">Deluxe Class</option>
                    <option value="EXECUTIVE">Executive Class</option>
                    <option value="SUITE">Junior Suite</option>
                    <option value="PRESIDENTIAL">Presidential Penthouse</option>
                  </select>
                </Field>
                <div className="flex items-end h-full">
                  <Button type="submit" className="bg-[#D4AF37] hover:bg-[#AE963C] text-white h-11 w-full rounded-xl gap-2 font-bold uppercase tracking-wider text-xs shadow-md">
                    <Search className="h-4 w-4" /> Check Availability
                  </Button>
                </div>
              </div>

              {/* Extra Filters */}
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4 pt-2 border-t text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Guest Count</label>
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 font-semibold focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="1">1 Guest</option>
                    <option value="2">2 Guests</option>
                    <option value="3">3 Guests</option>
                    <option value="4">4 Guests</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Floor level</label>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 font-semibold focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="">Any Floor</option>
                    <option value="1">1st Floor</option>
                    <option value="2">2nd Floor</option>
                    <option value="3">3rd Floor</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Min Price (₹)</label>
                  <Input type="number" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Max Price (₹)</label>
                  <Input type="number" placeholder="30000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="h-9" />
                </div>
              </div>
            </form>
          </Card>
        </section>

        {/* Available Rooms Grid */}
        <section className="mx-auto max-w-7xl px-6 py-16">
          {hasSearched && (
            <div className="space-y-6">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#D4AF37] border-b pb-2">Available Accommodations</h2>
              {isSearching ? (
                <CenteredSpinner />
              ) : !rooms || rooms.length === 0 ? (
                <EmptyState title="No rooms available" description="All suites of this class are occupied. Try modifying your dates or price filters." />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((room) => (
                    <Card key={room._id} className="overflow-hidden bg-white border border-[#ECECEC] rounded-3xl flex flex-col justify-between group shadow-sm transition-all duration-300 hover:shadow-xl">
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 cursor-pointer" onClick={() => handleDetailsRedirect(room)}>
                        <NextImage
                          src={room.images?.[0] || '/hotel1.png'}
                          alt={room.roomType}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 30vw"
                        />
                        <div className="absolute top-4 left-4 rounded-xl bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white">
                          Floor {room.floor}
                        </div>
                        <div className="absolute top-4 right-4 rounded-xl bg-[#D4AF37]/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
                          {room.roomType}
                        </div>
                      </div>
                      <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-2 cursor-pointer" onClick={() => handleDetailsRedirect(room)}>
                          <h3 className="text-xl font-serif text-zinc-950 font-semibold group-hover:text-[#D4AF37] transition-colors">{room.roomType} Room {room.roomNumber}</h3>
                          <p className="text-xs text-zinc-500 line-clamp-2">Capacity: {room.capacity} Adults | Bed: {room.bedType} Size | Area: {room.roomSizeSqFt} sqft</p>
                          <div className="flex items-center gap-4 text-xs text-zinc-400 font-semibold pt-1">
                            <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-[#D4AF37]" /> Fully Insured</span>
                            <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" /> Luxury Amenities</span>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-[#ECECEC] flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Per Night</span>
                            <span className="text-xl font-bold text-zinc-900">{formatINR(room.pricePerNight)}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDetailsRedirect(room)}
                              className="text-xs text-zinc-500 hover:text-zinc-900 font-semibold"
                            >
                              Details
                            </Button>
                            <Button
                              onClick={() => handleBookRedirect(room)}
                              className="bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold px-4 py-2 flex items-center gap-1 shadow"
                            >
                              Book <ArrowRight className="h-3.5 w-3.5 text-[#D4AF37]" />
                            </Button>
                          </div>
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
              <h2 className="text-3xl font-serif tracking-tight text-zinc-900 uppercase font-semibold">Manage Your Booking</h2>
              <p className="text-sm text-zinc-500">Enter your email address or phone number to check reservation status or retrieve check-in tickets.</p>
            </div>

            <Card className="p-5 border-[#ECECEC] bg-[#FAF9F6] rounded-3xl">
              <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  placeholder="Enter email or phone (e.g. guest@example.com)"
                  value={lookupValue}
                  onChange={(e) => setLookupValue(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] min-w-0"
                />
                <Button type="submit" className="bg-[#111111] hover:bg-[#222222] text-white rounded-xl px-6 h-11 font-bold text-xs uppercase tracking-wider shadow shrink-0">
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
                    <Card key={b._id} className="p-5 border-[#ECECEC] bg-white rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm text-left">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-zinc-900 text-lg">Room {b.room?.roomNumber || 'Unknown'}</p>
                          <Badge className="bg-zinc-100 text-zinc-600 font-mono text-[9px]">{b.confirmationNumber || 'CONF-XYZ'}</Badge>
                        </div>
                        <p className="text-xs text-zinc-500 font-semibold">
                          Check-in: {formatDate(b.checkInDate)} | Check-out: {formatDate(b.checkOutDate)}
                        </p>
                        <p className="text-xs font-semibold text-zinc-700">Guest: {b.guestName} | Total Price: {formatINR(b.totalPrice)}</p>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-2">
                        <Badge className={`
                          ${b.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : ''}
                          ${b.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' : ''}
                          ${b.status === 'CHECKED_IN' ? 'bg-green-50 text-green-700' : ''}
                          ${b.status === 'CHECKED_OUT' ? 'bg-zinc-100 text-zinc-700' : ''}
                          ${b.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : ''}
                        `}>
                          {b.status}
                        </Badge>
                        <button
                          onClick={() => router.push(`/rooms/confirm/${b._id}`)}
                          className="text-[10px] font-bold text-[#D4AF37] hover:underline flex items-center gap-0.5"
                        >
                          View Ticket <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
