'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Landmark, Users, DollarSign, Calendar, Clock, Sparkles, CheckCircle2, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { formatINR } from '@/lib/utils';

// ── Validation Schema ─────────────────────────────────────────────────────────

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
}

interface BookingResponse {
  _id: string;
  guestName: string;
  totalPrice: number;
  status: string;
}

// ── Page Component ─────────────────────────────────────────────────────────────

export default function CustomerBanquetsPage() {
  const [selectedHall, setSelectedHall] = useState<BanquetHall | null>(null);
  const [successBooking, setSuccessBooking] = useState<BookingResponse | null>(null);
  const [error, setError] = useState('');

  // Fetch active halls
  const { data: hallsData, isLoading } = useQuery<{ data: { halls: BanquetHall[] } }>({
    queryKey: ['active-banquet-halls'],
    queryFn: () => api.get('/banquets/halls').then(r => r.data),
  });
  const halls = hallsData?.data?.halls ?? [];

  // Submit booking request
  const submitBookingMutation = useMutation({
    mutationFn: (d: any) => api.post('/banquets/bookings', { ...d, hallId: selectedHall?._id }),
    onSuccess: (res) => {
      setSuccessBooking(res.data.data.booking);
      setSelectedHall(null);
    },
    onError: e => setError(apiErrorMessage(e)),
  });

  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { guestCount: 50 },
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

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl font-sans">
            Reserve Banquet Halls & Ballrooms
          </h1>
          <p className="text-sm text-zinc-500 max-w-md mx-auto font-sans">
            Choose the perfect venue for your weddings, corporate meetings, and family parties.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3.5 text-sm text-red-700 flex items-center justify-between font-sans shadow-sm">
            {error}
            <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Success confirmation */}
        {successBooking && (
          <Card className="p-8 text-center max-w-md mx-auto space-y-4 border-brand/20 bg-brand/5/10 shadow-lg">
            <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
            <div>
              <h2 className="text-xl font-bold text-zinc-900 font-sans">Reservation Submitted!</h2>
              <p className="text-sm text-zinc-500 mt-1 font-sans">
                Thanks, {successBooking.guestName}. Your reservation request is <strong>PENDING</strong> verification. Our event coordinator will call you shortly.
              </p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-brand/10 font-sans">
              <p className="text-xs text-zinc-400">Estimated Event Bill</p>
              <p className="text-xl font-bold text-brand mt-0.5">{formatINR(successBooking.totalPrice)}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 font-sans border-[#D4AF37] text-[#D4AF37] hover:bg-[#FAF8F0]"
                onClick={() => window.open(`${api.defaults.baseURL}/banquets/bookings/${successBooking._id}/quotation`, '_blank')}
              >
                Quotation PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 font-sans border-[#D4AF37] text-[#D4AF37] hover:bg-[#FAF8F0]"
                onClick={() => window.open(`${api.defaults.baseURL}/banquets/bookings/${successBooking._id}/estimation`, '_blank')}
              >
                Proposal PDF
              </Button>
            </div>
            <Button className="w-full font-sans" onClick={() => setSuccessBooking(null)}>
              Book Another Hall
            </Button>
          </Card>
        )}

        {/* Main List */}
        {isLoading ? (
          <CenteredSpinner />
        ) : halls.length === 0 ? (
          <Card className="py-20 text-center">
            <Landmark className="mx-auto h-12 w-12 text-zinc-300 mb-3" />
            <h3 className="text-zinc-600 font-semibold text-base font-sans">No venues listed at the moment</h3>
            <p className="text-xs text-zinc-400 mt-1">Please call hotel reception directly to inquire about banquet dates.</p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {halls.map(hall => (
              <Card key={hall._id} className="p-6 flex flex-col justify-between hover:shadow-lg transition-all border border-zinc-200/60 bg-white">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-zinc-900 text-lg font-sans">{hall.name}</h3>
                    <Badge className="bg-brand/5 text-brand border-brand/10 font-mono">
                      Max: {hall.capacity} pax
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-3 border-y border-zinc-100 text-xs text-zinc-600 font-sans">
                    <div>
                      <p className="text-zinc-400 font-medium">Rental Charges</p>
                      <p className="text-sm font-bold text-zinc-800 mt-0.5">{formatINR(hall.pricePerHour)}/hour</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 font-medium">Catering Charges</p>
                      <p className="text-sm font-bold text-zinc-800 mt-0.5">{formatINR(hall.pricePerPlate)}/plate</p>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-500 font-sans leading-relaxed">
                    Includes sound setup, seating configurations, staging fixtures, and custom lightning settings.
                  </p>
                </div>

                <Button
                  className="mt-6 w-full font-sans flex items-center justify-center gap-1.5"
                  onClick={() => {
                    reset();
                    setSelectedHall(hall);
                  }}
                >
                  Book Venue <ArrowRight className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reservation Booking Form Modal */}
      {selectedHall && (
        <Dialog open onClose={() => setSelectedHall(null)} title={`Book: ${selectedHall.name}`} widthClass="max-w-md">
          <form onSubmit={handleSubmit(d => submitBookingMutation.mutate(d))} className="space-y-4">
            <Field label="Full Name *">
              <Input {...register('guestName')} placeholder="Elon Musk" />
              <FieldError message={errors.guestName?.message} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email *">
                <Input {...register('email')} placeholder="elon@spacex.com" />
                <FieldError message={errors.email?.message} />
              </Field>
              <Field label="Phone Number *">
                <Input {...register('phone')} placeholder="+919999988888" />
                <FieldError message={errors.phone?.message} />
              </Field>
            </div>

            <Field label="Date of Event *">
              <Input type="date" {...register('eventDate')} />
              <FieldError message={errors.eventDate?.message} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time *">
                <Input type="datetime-local" {...register('startTime')} />
                <FieldError message={errors.startTime?.message} />
              </Field>
              <Field label="End Time *">
                <Input type="datetime-local" {...register('endTime')} />
                <FieldError message={errors.endTime?.message} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <Input {...register('menuPreset')} placeholder="Vegetarian Buffet Preset, Jain food requested..." />
            </Field>

            {/* Price Estimator panel */}
            {estimatedPrice > 0 && (
              <div className="rounded-xl border border-brand/20 bg-brand/5/10 p-3.5 flex items-center justify-between font-sans">
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">Estimated Invoice</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Includes rental time + plates count</p>
                </div>
                <p className="text-lg font-extrabold text-brand">{formatINR(estimatedPrice)}</p>
              </div>
            )}

            <Button type="submit" className="w-full font-sans flex items-center justify-center gap-1.5" disabled={submitBookingMutation.isPending}>
              {submitBookingMutation.isPending ? 'Requesting...' : 'Request Reservation'}
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
