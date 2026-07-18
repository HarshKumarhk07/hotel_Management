'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Calendar, Landmark, DollarSign, Users, Award, ShieldAlert } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useAdminKitchens } from '@/hooks/useAdminKitchens';
import { formatINR } from '@/lib/utils';

// ── Validation schemas ─────────────────────────────────────────────────────────

const hallSchema = z.object({
  name: z.string().trim().min(1, 'Hall name required').max(100),
  capacity: z.number().min(1, 'Capacity must be 1+'),
  pricePerHour: z.number().min(0, 'Hourly price must be positive'),
  pricePerPlate: z.number().min(0, 'Per plate rate must be positive').optional(),
  isActive: z.boolean().default(true),
  kitchenId: z.string().optional().or(z.literal('')),
});

const bookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
  paymentStatus: z.enum(['PENDING', 'PAID']),
});

type HallForm = z.infer<typeof hallSchema>;
type BookingForm = z.infer<typeof bookingSchema>;

// ── Types ──────────────────────────────────────────────────────────────────────

interface BanquetHall {
  _id: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  pricePerPlate: number;
  isActive: boolean;
  kitchen: string;
}

interface BanquetBooking {
  _id: string;
  hall: {
    _id: string;
    name: string;
    capacity: number;
  };
  guestName: string;
  phone: string;
  email: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  eventType: string;
  menuPreset?: string;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID';
}

// ── Main Page Component ────────────────────────────────────────────────────────

export default function BanquetManagementPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const status = useAuthStore(s => s.status);

  const [activeTab, setActiveTab] = useState<'bookings' | 'halls'>('bookings');
  const [showCreateHall, setShowCreateHall] = useState(false);
  const [editBookingTarget, setEditBookingTarget] = useState<BanquetBooking | null>(null);
  const [editHallTarget, setEditHallTarget] = useState<BanquetHall | null>(null);
  const [kitchenIdFilter, setKitchenIdFilter] = useState('');
  const [error, setError] = useState('');

  // Fetch kitchens (for selection when creating halls)
  const { data: kitchens } = useAdminKitchens();

  // Fetch Halls
  const { data: hallsData, isLoading: loadingHalls } = useQuery<{ data: { halls: BanquetHall[] } }>({
    queryKey: ['banquet-halls', kitchenIdFilter],
    queryFn: () => {
      const q = kitchenIdFilter ? `?kitchenId=${kitchenIdFilter}` : '';
      return api.get(`/banquets/halls${q}`).then(r => r.data);
    },
    enabled: status === 'authenticated',
  });
  const halls = hallsData?.data?.halls ?? [];

  // Fetch Bookings
  const { data: bookingsData, isLoading: loadingBookings } = useQuery<{ data: { bookings: BanquetBooking[] } }>({
    queryKey: ['banquet-bookings', kitchenIdFilter],
    queryFn: () => {
      const q = kitchenIdFilter ? `?kitchenId=${kitchenIdFilter}` : '';
      return api.get(`/banquets/bookings${q}`).then(r => r.data);
    },
    enabled: status === 'authenticated',
  });
  const bookings = bookingsData?.data?.bookings ?? [];

  // Mutations
  const createHallMutation = useMutation({
    mutationFn: (d: HallForm) => api.post('/banquets/halls', { ...d, kitchenId: kitchenIdFilter || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banquet-halls'] }); setShowCreateHall(false); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const updateHallMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<HallForm> }) => api.patch(`/banquets/halls/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banquet-halls'] }); setEditHallTarget(null); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const deleteHallMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/banquets/halls/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banquet-halls'] }),
    onError: e => setError(apiErrorMessage(e)),
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: BookingForm }) => api.patch(`/banquets/bookings/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banquet-bookings'] }); setEditBookingTarget(null); },
    onError: e => setError(apiErrorMessage(e)),
  });

  // Forms
  const { register: regHall, handleSubmit: handleHall, formState: { errors: hallErrors }, reset: resetHall } = useForm<HallForm>({
    resolver: zodResolver(hallSchema),
  });

  const { register: regEditHall, handleSubmit: handleEditHall, formState: { errors: editHallErrors }, reset: resetEditHall } = useForm<HallForm>({
    resolver: zodResolver(hallSchema),
  });

  const { register: regBooking, handleSubmit: handleBooking, reset: resetBooking } = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
  });

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 font-sans">Banquet Hall Management</h1>
            <p className="text-sm text-zinc-500 mt-0.5 font-sans">Manage banquet scheduling, event slots, and rental configs</p>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === 'SUPER_ADMIN' && (
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
                value={kitchenIdFilter}
                onChange={e => setKitchenIdFilter(e.target.value)}
              >
                <option value="">All Kitchens</option>
                {kitchens?.map(k => (
                  <option key={k._id} value={k._id}>{k.name}</option>
                ))}
              </select>
            )}
            {activeTab === 'halls' && (
              <Button size="sm" onClick={() => { resetHall(); setShowCreateHall(true); }}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Hall
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between font-sans">
            {error}
            <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b flex gap-4">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'bookings' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Reservations Timeline
          </button>
          <button
            onClick={() => setActiveTab('halls')}
            className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'halls' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Banquet Halls
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'bookings' ? (
          loadingBookings ? (
            <CenteredSpinner />
          ) : bookings.length === 0 ? (
            <Card className="py-16 text-center">
              <Calendar className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
              <p className="text-zinc-500 font-medium font-sans">No event reservations found</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {bookings.map(booking => (
                <Card key={booking._id} className="p-4 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-zinc-900 text-base font-sans">{booking.guestName}</h3>
                      <Badge className={
                        booking.status === 'CONFIRMED' ? 'bg-green-50 text-green-700 border-green-200' :
                        booking.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                        booking.status === 'COMPLETED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }>
                        {booking.status}
                      </Badge>
                      <Badge className={
                        booking.paymentStatus === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                      }>
                        {booking.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>

                    <p className="text-xs text-zinc-500 font-sans">
                      Event: <strong className="text-zinc-700">{booking.eventType}</strong> · Hall: <strong className="text-zinc-700">{booking.hall?.name || 'Deleted Hall'}</strong>
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs text-zinc-500 font-sans">
                      <p>Guest count: <strong>{booking.guestCount}</strong></p>
                      <p>Email: <strong>{booking.email}</strong></p>
                      <p>Phone: <strong>{booking.phone}</strong></p>
                      <p>Total Revenue: <strong className="text-zinc-900 font-semibold">{formatINR(booking.totalPrice)}</strong></p>
                    </div>

                    <div className="text-[11px] text-zinc-400 bg-zinc-50 p-2 rounded-lg font-mono">
                      Time: {new Date(booking.startTime).toLocaleString()} - {new Date(booking.endTime).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex gap-2 self-start md:self-center shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-sans border-[#D4AF37] text-[#D4AF37] hover:bg-[#FAF8F0]"
                      onClick={() => window.open(`${api.defaults.baseURL}/banquets/bookings/${booking._id}/quotation`, '_blank')}
                    >
                      Quotation
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-sans border-[#D4AF37] text-[#D4AF37] hover:bg-[#FAF8F0]"
                      onClick={() => window.open(`${api.defaults.baseURL}/banquets/bookings/${booking._id}/estimation`, '_blank')}
                    >
                      Proposal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-sans"
                      onClick={() => {
                        resetBooking({
                          status: booking.status,
                          paymentStatus: booking.paymentStatus,
                        });
                        setEditBookingTarget(booking);
                      }}
                    >
                      Update Status
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          loadingHalls ? (
            <CenteredSpinner />
          ) : halls.length === 0 ? (
            <Card className="py-16 text-center">
              <Landmark className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
              <p className="text-zinc-500 font-medium font-sans">No banquet halls configured</p>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {halls.map(hall => (
                <Card key={hall._id} className="p-4 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-zinc-900 text-lg font-sans">{hall.name}</h3>
                      <Badge className={
                        hall.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                      }>
                        {hall.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-sm text-zinc-600 font-sans">
                      <p className="flex items-center gap-1.5"><Users className="h-4 w-4 text-zinc-400" /> Max Capacity: <strong>{hall.capacity} guests</strong></p>
                      <p className="flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-zinc-400" /> Hourly rate: <strong>{formatINR(hall.pricePerHour)}/hr</strong></p>
                      <p className="flex items-center gap-1.5"><Award className="h-4 w-4 text-zinc-400" /> Catering rate: <strong>{formatINR(hall.pricePerPlate)}/plate</strong></p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 font-sans"
                      onClick={() => {
                        resetEditHall({
                          name: hall.name,
                          capacity: hall.capacity,
                          pricePerHour: hall.pricePerHour,
                          pricePerPlate: hall.pricePerPlate,
                          isActive: hall.isActive,
                        });
                        setEditHallTarget(hall);
                      }}
                    >
                      Edit Hall
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 border-red-200 font-sans"
                      onClick={() => {
                        if (confirm(`Delete hall "${hall.name}"?`)) {
                          deleteHallMutation.mutate(hall._id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </div>

      {/* Create Hall Modal */}
      {showCreateHall && (
        <Dialog open onClose={() => setShowCreateHall(false)} title="Add Banquet Hall" widthClass="max-w-md">
          <form onSubmit={handleHall(d => createHallMutation.mutate(d))} className="space-y-4">
            <Field label="Hall Name *">
              <Input {...regHall('name')} placeholder="Imperial Grand Hall" />
              <FieldError message={hallErrors.name?.message} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Capacity *">
                <Input type="number" {...regHall('capacity', { valueAsNumber: true })} />
                <FieldError message={hallErrors.capacity?.message} />
              </Field>
              <Field label="Price Per Hour *">
                <Input type="number" {...regHall('pricePerHour', { valueAsNumber: true })} />
                <FieldError message={hallErrors.pricePerHour?.message} />
              </Field>
              <Field label="Price Per Plate">
                <Input type="number" {...regHall('pricePerPlate', { valueAsNumber: true })} />
              </Field>
            </div>

            <Button type="submit" className="w-full font-sans" disabled={createHallMutation.isPending}>
              {createHallMutation.isPending ? 'Saving…' : 'Create Banquet Hall'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Edit Hall Modal */}
      {editHallTarget && (
        <Dialog open onClose={() => setEditHallTarget(null)} title="Edit Banquet Hall" widthClass="max-w-md">
          <form onSubmit={handleEditHall(d => updateHallMutation.mutate({ id: editHallTarget._id, d }))} className="space-y-4">
            <Field label="Hall Name *">
              <Input {...regEditHall('name')} />
              <FieldError message={editHallErrors.name?.message} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Capacity *">
                <Input type="number" {...regEditHall('capacity', { valueAsNumber: true })} />
                <FieldError message={editHallErrors.capacity?.message} />
              </Field>
              <Field label="Price Per Hour *">
                <Input type="number" {...regEditHall('pricePerHour', { valueAsNumber: true })} />
                <FieldError message={editHallErrors.pricePerHour?.message} />
              </Field>
              <Field label="Price Per Plate">
                <Input type="number" {...regEditHall('pricePerPlate', { valueAsNumber: true })} />
              </Field>
            </div>

            <Field label="Status">
              <select
                {...regEditHall('isActive')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
                value={editHallTarget.isActive ? 'true' : 'false'}
                onChange={e => setEditHallTarget({ ...editHallTarget, isActive: e.target.value === 'true' })}
              >
                <option value="true">Active (Visible)</option>
                <option value="false">Inactive (Hidden)</option>
              </select>
            </Field>

            <Button type="submit" className="w-full font-sans" disabled={updateHallMutation.isPending}>
              {updateHallMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Update Booking Status Modal */}
      {editBookingTarget && (
        <Dialog open onClose={() => setEditBookingTarget(null)} title="Update Booking Status" widthClass="max-w-md">
          <form onSubmit={handleBooking(d => updateBookingMutation.mutate({ id: editBookingTarget._id, d }))} className="space-y-4">
            <Field label="Booking Status">
              <select
                {...regBooking('status')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </Field>

            <Field label="Payment Status">
              <select
                {...regBooking('paymentStatus')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
              >
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
              </select>
            </Field>

            <Button type="submit" className="w-full font-sans" disabled={updateBookingMutation.isPending}>
              {updateBookingMutation.isPending ? 'Updating…' : 'Update Status'}
            </Button>
          </form>
        </Dialog>
      )}
    </AdminShell>
  );
}
