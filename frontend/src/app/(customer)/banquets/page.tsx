'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Landmark,
  Users,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  X,
  Search,
  Maximize,
  Briefcase,
  Layers,
  Info
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

// ── Toast Utility ─────────────────────────────────────────────────────────────
function showToast(title: string, body: string, type: 'success' | 'error' | 'info' = 'info') {
  if (typeof window === 'undefined') return;
  const containerId = 'toast-container';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = [
    'flex items-start gap-3 w-full rounded-xl border bg-white px-4 py-3 shadow-2xl transition-all duration-300 pointer-events-auto',
    type === 'success' ? 'border-[#D4AF37] bg-[#FAF8F0]' : type === 'error' ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white',
    'animate-in slide-in-from-bottom-4 fade-in duration-300',
  ].join(' ');
  
  const icon = type === 'success' ? '🏆' : type === 'error' ? '❌' : 'ℹ️';
  const iconBg = type === 'success' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : type === 'error' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-700';

  toast.innerHTML = `
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg} text-base">${icon}</div>
    <div class="min-w-0 flex-1">
      <p class="text-xs font-semibold text-zinc-900">${title}</p>
      <p class="text-[10px] text-zinc-500 mt-0.5 leading-normal">${body}</p>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      toast.remove();
      if (container && container.childElementCount === 0) {
        container.remove();
      }
    }, 300);
  }, 4000);
}

// ── Validation Schema for Booking ─────────────────────────────────────────────

const bookingSchema = z.object({
  guestName: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().min(10, 'Valid phone number is required'),
  eventDate: z.string().min(1, 'Event date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  guestCount: z.number().min(1, 'Expected guest count must be at least 1'),
  eventType: z.string().trim().min(1, 'Event type is required'),
  menuPreset: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventDateVal = new Date(data.eventDate);
  eventDateVal.setHours(0, 0, 0, 0);

  if (eventDateVal < today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Event date cannot be in the past',
      path: ['eventDate'],
    });
  }

  const startVal = new Date(data.startTime);
  const endVal = new Date(data.endTime);

  if (isNaN(startVal.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Start time is invalid',
      path: ['startTime'],
    });
  }

  if (isNaN(endVal.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time is invalid',
      path: ['endTime'],
    });
  }

  if (!isNaN(startVal.getTime()) && !isNaN(endVal.getTime())) {
    if (startVal.getTime() >= endVal.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['endTime'],
      });
    }

    const startLocalString = data.startTime.split('T')[0];
    if (startLocalString !== data.eventDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start time must be on the selected event date',
        path: ['startTime'],
      });
    }

    const endLocalString = data.endTime.split('T')[0];
    const startDateObj = new Date(startLocalString);
    const endDateObj = new Date(endLocalString);
    const diffTime = endDateObj.getTime() - startDateObj.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time cannot be before start time',
        path: ['endTime'],
      });
    } else if (diffDays > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Overnight bookings can only extend to the next day',
        path: ['endTime'],
      });
    }
  }
});

type BookingForm = z.infer<typeof bookingSchema>;

// ── Types ──────────────────────────────────────────────────────────────────────

interface BanquetHall {
  _id: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  pricePerPlate: number;
  isActive: boolean;
  description?: string;
  area?: string;
  eventTypes?: string[];
  image?: string;
}

interface BookingResponse {
  _id: string;
  guestName: string;
  totalPrice: number;
  status: string;
}

// ── Premium static enrichments ──────────────────────────────────────────────────

const HALL_ENRICHMENTS: Record<string, {
  image: string;
  area: string;
  eventTypes: string[];
  features: string[];
  description: string;
}> = {
  'Royal Ballroom': {
    image: '/bnk2.png',
    area: '12,000 sq. ft.',
    eventTypes: ['Weddings', 'Gala Dinners', 'Receptions'],
    features: ['Crystal Chandeliers', 'Pillar-less Design', 'Custom Lighting', 'Built-in Stage'],
    description: 'A grand pillar-less venue featuring majestic crystal chandeliers and high ceilings, ideal for royal weddings and large-scale celebrations.'
  },
  'Imperial Banquet Hall': {
    image: '/abt1.png',
    area: '8,500 sq. ft.',
    eventTypes: ['Corporate Events', 'Seminars', 'Gala Lunches'],
    features: ['AV Technology', 'Premium Sound System', 'Flexible Layouts', 'Corporate Lounge Access'],
    description: 'A sophisticated, contemporary space equipped with state-of-the-art audiovisual capabilities, perfect for prestigious corporate meetings and assemblies.'
  },
  'Crystal Palace': {
    image: '/hotel1.png',
    area: '20,000 sq. ft.',
    eventTypes: ['Exhibitions', 'Conventions', 'Social Gatherings'],
    features: ['Panoramic Glass Walls', 'Private Lawns', 'Expansive Car Parking', 'Pre-function Lounge'],
    description: 'Our largest and most magnificent venue, featuring towering glass walls overlooking manicured palace lawns, designed for spectacular grand-scale occasions.'
  },
  'Grand Celebration Hall': {
    image: '/dining-banner.png',
    area: '10,000 sq. ft.',
    eventTypes: ['Theme Parties', 'Birthdays', 'Anniversaries'],
    features: ['Modular Acoustic Walls', 'Dedicated Buffet Stations', 'Integrated DJ Console'],
    description: 'A vibrant yet elegant space featuring smart configurations and custom banquet catering counters, perfect for celebratory parties and family reunions.'
  },
  'Heritage Courtyard': {
    image: '/abt2.png',
    area: '7,500 sq. ft.',
    eventTypes: ['Traditional Ceremonies', 'Outdoor Cocktails', 'Sangeet Nights'],
    features: ['Open-air Skyview', 'Carved Stone Arches', 'Traditional Seating Setup'],
    description: 'An exquisite open-air courtyard framed by carved stone arches and heritage architecture, perfect for hosting magical events under the stars.'
  },
  'Emerald Ballroom': {
    image: '/bnk2.png',
    area: '5,000 sq. ft.',
    eventTypes: ['Private Dinners', 'Executive Meetings', 'Press Conferences'],
    features: ['Private Foyer', 'Dedicated Butler Service', 'Silent Acoustics'],
    description: 'A luxurious, intimate ballroom tailored for VIP conferences, private executive dinners, and premium brand launches with unmatched hospitality.'
  }
};

const defaultEnrichment = {
  image: '/bnk2.png',
  area: '6,000 sq. ft.',
  eventTypes: ['Event Celebrations', 'Meetings'],
  features: ['Central AC', 'Premium Sound System', 'Flexible Layouts'],
  description: 'A luxurious multi-functional space designed to accommodate a variety of royal social and corporate gatherings.'
};

export default function CustomerBanquetsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  
  const [selectedHall, setSelectedHall] = useState<BanquetHall | null>(null);
  const [detailsHall, setDetailsHall] = useState<BanquetHall | null>(null);
  const [successBooking, setSuccessBooking] = useState<BookingResponse | null>(null);
  const [error, setError] = useState('');

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [capacityFilter, setCapacityFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');

  // Fetch active halls
  const { data: hallsData, isLoading } = useQuery<{ data: { halls: BanquetHall[] } }>({
    queryKey: ['active-banquet-halls'],
    queryFn: () => api.get('/banquets/halls').then(r => r.data),
  });
  const halls = hallsData?.data?.halls ?? [];

  // Submit booking request
  const submitBookingMutation = useMutation({
    mutationFn: (payload: any) => api.post('/banquets/bookings', payload),
    onSuccess: (res) => {
      setSuccessBooking(res.data.data.booking);
      setSelectedHall(null);
      showToast('Enquiry Submitted', 'Your banquet hall reservation request has been received.', 'success');
    },
    onError: (e: any) => {
      const responseData = e.response?.data;
      if (responseData && responseData.errors) {
        Object.entries(responseData.errors).forEach(([field, msg]) => {
          setFormFieldError(field as any, {
            type: 'manual',
            message: Array.isArray(msg) ? msg[0] : (msg as string),
          });
        });
        showToast('Booking Failed', 'Please correct the highlighted errors.', 'error');
      } else {
        const msg = apiErrorMessage(e);
        setError(msg);
        showToast('Booking Failed', msg, 'error');
      }
    },
  });

  const { register, handleSubmit, watch, formState: { errors, isValid }, reset, setError: setFormFieldError } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { guestCount: 50 },
    mode: 'onChange',
  });

  // Live estimate calculation
  const watchStart = watch('startTime');
  const watchEnd = watch('endTime');
  const watchGuests = watch('guestCount') || 0;

  let estimatedPrice = 0;
  if (selectedHall && watchStart && watchEnd) {
    const s = new Date(watchStart);
    const e = new Date(watchEnd);
    if (s < e) {
      const hours = Math.max(1, (e.getTime() - s.getTime()) / (1000 * 60 * 60));
      estimatedPrice = (hours * selectedHall.pricePerHour) + (watchGuests * (selectedHall.pricePerPlate || 0));
    }
  }

  // Filter logic
  const filteredHalls = halls.filter((hall) => {
    // 1. Search Query
    if (searchQuery && !hall.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // 2. Capacity filter
    if (capacityFilter !== 'all') {
      if (capacityFilter === 'small' && hall.capacity > 250) return false;
      if (capacityFilter === 'medium' && (hall.capacity <= 250 || hall.capacity > 500)) return false;
      if (capacityFilter === 'large' && hall.capacity <= 500) return false;
    }

    // 3. Price filter
    if (priceFilter !== 'all') {
      if (priceFilter === 'budget' && hall.pricePerHour >= 10000) return false;
      if (priceFilter === 'mid' && (hall.pricePerHour < 10000 || hall.pricePerHour > 20000)) return false;
      if (priceFilter === 'premium' && hall.pricePerHour <= 20000) return false;
    }

    // 4. Event type filter
    if (eventTypeFilter !== 'all') {
      const enrich = HALL_ENRICHMENTS[hall.name] || defaultEnrichment;
      const match = enrich.eventTypes.some(t => t.toLowerCase().includes(eventTypeFilter.toLowerCase()));
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-24 font-sans text-zinc-800">
      {/* Hero Banner Section */}
      <section className="relative bg-[#111111] py-28 text-white overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#D4AF37_0%,transparent_50%)] opacity-25 pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-8 text-center space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-5 py-2 text-xs font-bold uppercase tracking-[0.25em] text-[#D4AF37] ring-1 ring-[#D4AF37]/35 border border-[#D4AF37]/20">
            MAJESTIC SPACES
          </span>
          <h1 className="text-4xl font-serif sm:text-6xl tracking-wide uppercase">Palatial Venues &amp; Ballrooms</h1>
          <p className="mx-auto max-w-xl text-zinc-300 text-xs sm:text-sm font-light leading-relaxed">
            Host your weddings, corporate meetings, and celebrations in our signature imperial halls, where heritage architecture meets luxury hospitality.
          </p>
        </div>
      </section>

      {/* Main Listing & Filters container */}
      <div className="mx-auto max-w-7xl px-6 py-12 space-y-10">
        
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-5">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#D4AF37] hover:text-[#AE963C] transition-colors">
            ← Return to Home
          </Link>
          <span className="text-xs text-zinc-400 font-medium font-serif italic">The Page Rohtak NCR</span>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3.5 text-xs text-red-700 flex items-center justify-between font-sans shadow-sm">
            {error}
            <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Success confirmation */}
        {successBooking && (
          <Card className="p-8 text-center max-w-md mx-auto space-y-6 border-[#D4AF37]/30 bg-white shadow-2xl rounded-3xl">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#D4AF37]" />
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-zinc-900">Enquiry Submitted</h2>
              <p className="text-xs text-zinc-500 font-light leading-relaxed">
                Thank you, {successBooking.guestName}. Your reservation request is currently <strong>PENDING</strong> verification. Our private event specialist will reach out shortly.
              </p>
            </div>
            <div className="p-4 bg-[#FAF8F0] rounded-2xl border border-[#D4AF37]/20">
              <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Estimated Event Bill</p>
              <p className="text-2xl font-bold text-[#D4AF37] mt-0.5">{formatINR(successBooking.totalPrice)}</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 font-sans border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#FAF8F0] rounded-xl text-xs py-2.5"
                onClick={() => window.open(`${api.defaults.baseURL}/banquets/bookings/${successBooking._id}/quotation`, '_blank')}
              >
                Quotation PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 font-sans border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#FAF8F0] rounded-xl text-xs py-2.5"
                onClick={() => window.open(`${api.defaults.baseURL}/banquets/bookings/${successBooking._id}/estimation`, '_blank')}
              >
                Proposal PDF
              </Button>
            </div>
            <Button className="w-full bg-[#111111] hover:bg-zinc-800 text-white rounded-xl text-xs py-3" onClick={() => setSuccessBooking(null)}>
              Browse Other Venues
            </Button>
          </Card>
        )}

        {!successBooking && (
          <>
            {/* Filter and Search Bar */}
            <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 shadow-sm grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-end text-left">
              
              {/* Search */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">Search Venue Name</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search ballroom, palace..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 w-full pl-10 pr-4 rounded-xl border border-zinc-200 bg-[#FAF9F6] text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Capacity Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">Capacity</label>
                <select
                  value={capacityFilter}
                  onChange={(e) => setCapacityFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-[#FAF9F6] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="all">All Capacities</option>
                  <option value="small">Under 250 Guests</option>
                  <option value="medium">250 - 500 Guests</option>
                  <option value="large">Over 500 Guests</option>
                </select>
              </div>

              {/* Price Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">Starting Price</label>
                <select
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-[#FAF9F6] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="all">All Prices</option>
                  <option value="budget">Under ₹10,000 / hr</option>
                  <option value="mid">₹10,000 - ₹20,000 / hr</option>
                  <option value="premium">Over ₹20,000 / hr</option>
                </select>
              </div>

              {/* Event Type Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">Event Type</label>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-[#FAF9F6] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="all">All Event Types</option>
                  <option value="weddings">Weddings</option>
                  <option value="corporate">Corporate</option>
                  <option value="exhibitions">Exhibitions</option>
                  <option value="parties">Parties</option>
                  <option value="sangeet">Sangeet Nights</option>
                </select>
              </div>
            </div>

            {/* Banquet Listing Grid */}
            {isLoading ? (
              <div className="py-24">
                <CenteredSpinner />
              </div>
            ) : filteredHalls.length === 0 ? (
              <Card className="py-24 text-center border-dashed border-zinc-200 bg-white rounded-3xl">
                <Landmark className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
                <h3 className="text-zinc-700 font-serif font-bold text-lg">No Venues Match Your Filters</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto font-light">
                  Please clear your search query or adjust filter parameters to explore our catalog of royal spaces.
                </p>
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setCapacityFilter('all');
                    setPriceFilter('all');
                    setEventTypeFilter('all');
                  }}
                  className="mt-6 bg-[#D4AF37] hover:bg-[#AE963C] text-white rounded-xl text-xs py-2 px-6"
                >
                  Clear Filters
                </Button>
              </Card>
            ) : (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {filteredHalls.map((hall) => {
                  const enrichment = HALL_ENRICHMENTS[hall.name] || defaultEnrichment;
                  return (
                    <Card
                      key={hall._id}
                      className="group flex flex-col justify-between hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 border border-zinc-200 bg-white rounded-3xl overflow-hidden text-left"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                        <Image
                          src={hall.image || enrichment.image}
                          alt={hall.name}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                        
                        {/* Status tag */}
                        <div className="absolute top-4 right-4">
                          <span className={`text-[8px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full text-white ${hall.isActive ? 'bg-[#D4AF37]' : 'bg-zinc-500'}`}>
                            {hall.isActive ? 'Available' : 'Closed'}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                        <div className="space-y-3">
                          <h3 className="text-xl font-serif font-semibold text-zinc-900 group-hover:text-[#D4AF37] transition-colors">{hall.name}</h3>
                          <p className="text-xs text-zinc-500 font-light leading-relaxed line-clamp-3">
                            {hall.description || enrichment.description}
                          </p>

                          {/* Quick specs grid */}
                          <div className="grid grid-cols-2 gap-3 py-4 border-y border-zinc-100 text-[11px] text-zinc-600">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-[#D4AF37] shrink-0" />
                              <span>Max: <strong>{hall.capacity} pax</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Maximize className="h-4 w-4 text-[#D4AF37] shrink-0" />
                              <span>Area: <strong>{hall.area || enrichment.area}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-[#D4AF37] shrink-0" />
                              <span>Hourly: <strong>{formatINR(hall.pricePerHour)}/hr</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Landmark className="h-4 w-4 text-[#D4AF37] shrink-0" />
                              <span>Catering: <strong>{formatINR(hall.pricePerPlate)}/plt</strong></span>
                            </div>
                          </div>

                          {/* Event types */}
                          <div className="space-y-1.5">
                            <span className="text-[8px] font-extrabold uppercase tracking-widest text-[#D4AF37]">Suited For</span>
                            <div className="flex flex-wrap gap-1.5">
                              {(hall.eventTypes?.length ? hall.eventTypes : enrichment.eventTypes).map((type) => (
                                <span key={type} className="text-[9px] bg-[#FAF8F0] border border-[#D4AF37]/20 text-[#AE963C] px-2 py-0.5 rounded-full font-medium">
                                  {type}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <Button
                            variant="outline"
                            className="font-sans text-xs border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-xl"
                            onClick={() => setDetailsHall(hall)}
                          >
                            View Details
                          </Button>
                          <Button
                            className="font-sans text-xs bg-[#D4AF37] hover:bg-[#AE963C] text-white rounded-xl"
                            onClick={() => {
                              if (!user) {
                                toast.info('We are directing you to the sign-in page for further booking.');
                                const redirectUrl = encodeURIComponent(window.location.pathname);
                                router.push(`/login?next=${redirectUrl}`);
                                return;
                              }
                              reset();
                              setSelectedHall(hall);
                            }}
                          >
                            Book Now
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Banquet Details Info Modal */}
      {detailsHall && (
        <Dialog open onClose={() => setDetailsHall(null)} title={detailsHall.name} widthClass="max-w-lg">
          {(() => {
            const enrich = HALL_ENRICHMENTS[detailsHall.name] || defaultEnrichment;
            return (
              <div className="space-y-6 text-left font-sans">
                <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-zinc-100">
                  <Image
                    src={detailsHall.image || enrich.image}
                    alt={detailsHall.name}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-serif font-bold text-zinc-900">About the Venue</h3>
                  <p className="text-xs text-zinc-500 font-light leading-relaxed">{detailsHall.description || enrich.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-y border-zinc-100 py-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-zinc-400 block">Total Capacity</span>
                    <span className="font-semibold text-zinc-800">{detailsHall.capacity} guests</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-400 block">Venue Size Area</span>
                    <span className="font-semibold text-zinc-800">{detailsHall.area || enrich.area}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-400 block">Hall Rental Tariff</span>
                    <span className="font-semibold text-[#D4AF37]">{formatINR(detailsHall.pricePerHour)} / Hour</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-400 block">Catering Rate</span>
                    <span className="font-semibold text-[#D4AF37]">{formatINR(detailsHall.pricePerPlate)} / Plate (min billing)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">Hall Specifications &amp; Features</span>
                  <ul className="grid grid-cols-2 gap-2 text-xs text-zinc-600 list-disc pl-4">
                    {(detailsHall.eventTypes?.length ? detailsHall.eventTypes : enrich.features).map(feat => (
                      <li key={feat} className="font-light">{feat}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2">
                  <Button
                    className="w-full bg-[#D4AF37] hover:bg-[#AE963C] text-white rounded-xl text-xs py-3"
                    onClick={() => {
                      setDetailsHall(null);
                      reset();
                      setSelectedHall(detailsHall);
                    }}
                  >
                    Proceed with Reservation
                  </Button>
                </div>
              </div>
            );
          })()}
        </Dialog>
      )}

      {/* Reservation Booking Form Modal */}
      {selectedHall && (
        <Dialog open onClose={() => setSelectedHall(null)} title={`Book: ${selectedHall.name}`} widthClass="max-w-2xl">
          <form
            onSubmit={handleSubmit((d) =>
              submitBookingMutation.mutate({
                ...d,
                hallId: selectedHall._id,
                eventDate: new Date(d.eventDate).toISOString(),
                startTime: new Date(d.startTime).toISOString(),
                endTime: new Date(d.endTime).toISOString(),
              })
            )}
            className="space-y-6 text-left"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Guest Details & Catering */}
              <div className="space-y-4">
                <Field label="Full Name *">
                  <Input {...register('guestName')} placeholder="Elon Musk" />
                  <FieldError message={errors.guestName?.message} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Email *">
                    <Input {...register('email')} placeholder="elon@spacex.com" />
                    <FieldError message={errors.email?.message} />
                  </Field>
                  <Field label="Phone Number *">
                    <Input {...register('phone')} placeholder="+919999988888" />
                    <FieldError message={errors.phone?.message} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Expected Guests *">
                    <Input type="number" {...register('guestCount', { valueAsNumber: true })} />
                    <FieldError message={errors.guestCount?.message} />
                  </Field>
                  <Field label="Event Type *">
                    <Input {...register('eventType')} placeholder="Wedding Reception, Corporate..." />
                    <FieldError message={errors.eventType?.message} />
                  </Field>
                </div>
                <Field label="Catering & Menu Preferences (Optional)">
                  <textarea
                    {...register('menuPreset')}
                    rows={3}
                    placeholder="Vegetarian Buffet Preset, Jain food requested, special setup..."
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/30 disabled:opacity-50 resize-y"
                  />
                  <FieldError message={errors.menuPreset?.message} />
                </Field>
              </div>

              {/* Right Column - Dates, Times, & Est. Billing */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <Field label="Date of Event *">
                    <Input type="date" {...register('eventDate')} />
                    <FieldError message={errors.eventDate?.message} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Start Time *">
                      <Input type="datetime-local" {...register('startTime')} />
                      <FieldError message={errors.startTime?.message} />
                    </Field>
                    <Field label="End Time *">
                      <Input type="datetime-local" {...register('endTime')} />
                      <FieldError message={errors.endTime?.message} />
                    </Field>
                  </div>
                </div>

                {/* Price Estimator panel */}
                {estimatedPrice > 0 ? (
                  <div className="rounded-xl border border-[#D4AF37]/35 bg-[#FAF8F0] p-4 flex items-center justify-between font-sans">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">Estimated Invoice</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Includes rental time + plates count</p>
                    </div>
                    <p className="text-xl font-extrabold text-[#D4AF37]">{formatINR(estimatedPrice)}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center font-sans text-xs text-zinc-400">
                    Fill in Date, Start Time, and End Time to view price estimation.
                  </div>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#111111] hover:bg-zinc-800 text-white rounded-xl py-3 font-semibold text-xs flex items-center justify-center gap-1.5"
              disabled={submitBookingMutation.isPending || !isValid}
            >
              {submitBookingMutation.isPending ? 'Requesting...' : 'Request Reservation'}
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
