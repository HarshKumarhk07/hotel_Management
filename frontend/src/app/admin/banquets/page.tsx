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
  description: z.string().optional(),
  area: z.string().optional(),
  eventTypes: z.string().optional(),
  image: z.string().optional(),
});

const bookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
  enquiryStatus: z.enum(['NEW', 'CONTACTED', 'CLOSED']),
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
  description?: string;
  area?: string;
  eventTypes?: string[];
  image?: string;
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
  enquiryStatus: 'NEW' | 'CONTACTED' | 'CLOSED';
  paymentStatus: 'PENDING' | 'PAID';
}

// ── Main Page Component ────────────────────────────────────────────────────────

export default function BanquetManagementPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const status = useAuthStore(s => s.status);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedHallFilter, setSelectedHallFilter] = useState('');

  const [activeTab, setActiveTab] = useState<'enquiries' | 'bookings' | 'halls' | 'calendar'>('enquiries');
  const [showCreateHall, setShowCreateHall] = useState(false);
  const [editBookingTarget, setEditBookingTarget] = useState<BanquetBooking | null>(null);
  const [editHallTarget, setEditHallTarget] = useState<BanquetHall | null>(null);
  const [deleteHallTarget, setDeleteHallTarget] = useState<BanquetHall | null>(null);
  const [kitchenIdFilter, setKitchenIdFilter] = useState('');
  const [error, setError] = useState('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (file: File, isEdit: boolean) => {
    if (!file) return;
    setUploading(true);
    setError('');
    setUploadSuccessMsg('');
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.postForm<{ data: { url: string } }>('/upload', formData);
      const url = res.data.data.url;
      if (isEdit) {
        setValueEditHall('image', url);
      } else {
        setValueHall('image', url);
      }
      setUploadSuccessMsg('Image uploaded successfully! Click Save Changes to apply it to the main page.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to upload image'));
    } finally {
      setUploading(false);
    }
  };

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
    mutationFn: (d: HallForm) => {
      const payload = {
        ...d,
        eventTypes: d.eventTypes ? d.eventTypes.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        kitchenId: kitchenIdFilter || undefined
      };
      return api.post('/banquets/halls', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banquet-halls'] }); setShowCreateHall(false); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const updateHallMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<HallForm> }) => {
      const payload = {
        ...d,
        eventTypes: d.eventTypes ? d.eventTypes.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      };
      return api.patch(`/banquets/halls/${id}`, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banquet-halls'] }); setEditHallTarget(null); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const deleteHallMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/banquets/halls/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banquet-halls'] }); setDeleteHallTarget(null); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: BookingForm }) => api.patch(`/banquets/bookings/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banquet-bookings'] }); setEditBookingTarget(null); },
    onError: e => setError(apiErrorMessage(e)),
  });

  // Forms
  const { register: regHall, handleSubmit: handleHall, formState: { errors: hallErrors }, reset: resetHall, setValue: setValueHall, watch: watchHall } = useForm<HallForm>({
    resolver: zodResolver(hallSchema),
  });

  const { register: regEditHall, handleSubmit: handleEditHall, formState: { errors: editHallErrors }, reset: resetEditHall, setValue: setValueEditHall, watch: watchEditHall } = useForm<HallForm>({
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
            onClick={() => setActiveTab('enquiries')}
            className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'enquiries' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Enquiries
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'bookings' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Reservations Timeline
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'calendar' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Availability Calendar
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
        {activeTab === 'enquiries' ? (
          loadingBookings ? (
            <CenteredSpinner />
          ) : bookings.length === 0 ? (
            <Card className="py-16 text-center">
              <Calendar className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
              <p className="text-zinc-500 font-medium font-sans">No banquet enquiries found</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {bookings.map(booking => (
                <Card key={booking._id} className="p-4 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-zinc-900 text-base font-sans">{booking.guestName}</h3>
                      <Badge className={
                        booking.enquiryStatus === 'NEW' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20' :
                        booking.enquiryStatus === 'CONTACTED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-zinc-100 text-zinc-500 border-zinc-200'
                      }>
                        {booking.enquiryStatus || 'NEW'}
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
                      className="font-sans"
                      onClick={() => {
                        resetBooking({
                          status: booking.status,
                          enquiryStatus: booking.enquiryStatus || 'NEW',
                          paymentStatus: booking.paymentStatus,
                        });
                        setEditBookingTarget(booking);
                      }}
                    >
                      Update Enquiry
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : activeTab === 'bookings' ? (
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
                          enquiryStatus: booking.enquiryStatus || 'NEW',
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
        ) : activeTab === 'calendar' ? (
          <BanquetCalendarView bookings={bookings} halls={halls} />
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
                          description: hall.description || '',
                          area: hall.area || '',
                          eventTypes: hall.eventTypes ? hall.eventTypes.join(', ') : '',
                          image: hall.image || '',
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
                      onClick={() => setDeleteHallTarget(hall)}
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

            <Field label="Description">
              <Input {...regHall('description')} placeholder="A luxurious multi-functional space..." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area (sq. ft.)">
                <Input {...regHall('area')} placeholder="6,000 sq. ft." />
              </Field>
              <Field label="Suited For (Event Types)">
                <Input {...regHall('eventTypes')} placeholder="Weddings, Meetings..." />
              </Field>
            </div>
            <Field label="Image">
                <div className="flex gap-2">
                  <select
                    {...regHall('image')}
                    className="h-10 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] font-sans text-zinc-900"
                  >
                    <option value="">Default (Royal Theme)</option>
                    <option value="/bnk2.png">Royal Ballroom Theme</option>
                    <option value="/abt1.png">Imperial Banquet Theme</option>
                    <option value="/hotel1.png">Crystal Palace Theme</option>
                    <option value="/dining-banner.png">Grand Celebration Theme</option>
                    <option value="/abt2.png">Heritage Courtyard Theme</option>
                    {watchHall('image') && !['', '/bnk2.png', '/abt1.png', '/hotel1.png', '/dining-banner.png', '/abt2.png'].includes(watchHall('image') as string) && (
                      <option value={watchHall('image') as string}>Custom Uploaded</option>
                    )}
                  </select>
                  <label className={`flex h-10 items-center justify-center rounded-lg border px-4 text-xs font-semibold cursor-pointer transition-colors shadow-sm font-sans shrink-0 ${uploading ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' : 'bg-white text-zinc-700 hover:bg-zinc-50 border-zinc-200'}`}>
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3 w-3 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Uploading...
                      </span>
                    ) : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, false);
                      }}
                      disabled={uploading}
                    />
                  </label>
                </div>
                {uploadSuccessMsg && <p className="mt-2 text-xs font-medium text-green-600">{uploadSuccessMsg}</p>}
                <p className="mt-1.5 text-[10px] text-zinc-400 font-light">For faster upload speeds, please compress your images to under 1MB before uploading.</p>
            </Field>

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

            <Field label="Description">
              <Input {...regEditHall('description')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area (sq. ft.)">
                <Input {...regEditHall('area')} />
              </Field>
              <Field label="Suited For (Event Types)">
                <Input {...regEditHall('eventTypes')} />
              </Field>
            </div>
            <Field label="Image">
                <div className="flex gap-2">
                  <select
                    {...regEditHall('image')}
                    className="h-10 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] font-sans text-zinc-900"
                  >
                    <option value="">Default (Royal Theme)</option>
                    <option value="/bnk2.png">Royal Ballroom Theme</option>
                    <option value="/abt1.png">Imperial Banquet Theme</option>
                    <option value="/hotel1.png">Crystal Palace Theme</option>
                    <option value="/dining-banner.png">Grand Celebration Theme</option>
                    <option value="/abt2.png">Heritage Courtyard Theme</option>
                    {watchEditHall('image') && !['', '/bnk2.png', '/abt1.png', '/hotel1.png', '/dining-banner.png', '/abt2.png'].includes(watchEditHall('image') as string) && (
                      <option value={watchEditHall('image') as string}>Custom Uploaded</option>
                    )}
                  </select>
                  <label className={`flex h-10 items-center justify-center rounded-lg border px-4 text-xs font-semibold cursor-pointer transition-colors shadow-sm font-sans shrink-0 ${uploading ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' : 'bg-white text-zinc-700 hover:bg-zinc-50 border-zinc-200'}`}>
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3 w-3 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Uploading...
                      </span>
                    ) : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, true);
                      }}
                      disabled={uploading}
                    />
                  </label>
                </div>
                {uploadSuccessMsg && <p className="mt-2 text-xs font-medium text-green-600">{uploadSuccessMsg}</p>}
                <p className="mt-1.5 text-[10px] text-zinc-400 font-light">For faster upload speeds, please compress your images to under 1MB before uploading.</p>
              </Field>

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

      {/* Delete Hall Confirm Modal */}
      {deleteHallTarget && (
        <Dialog open onClose={() => setDeleteHallTarget(null)} title="Delete Banquet Hall" widthClass="max-w-sm">
          <div className="space-y-4 font-sans">
            <p className="text-sm text-zinc-600">
              Are you sure you want to delete <strong>{deleteHallTarget.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => setDeleteHallTarget(null)}
                disabled={deleteHallMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-transparent"
                onClick={() => deleteHallMutation.mutate(deleteHallTarget._id)}
                disabled={deleteHallMutation.isPending}
              >
                {deleteHallMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {editBookingTarget && (
        <Dialog open onClose={() => setEditBookingTarget(null)} title="Manage Banquet Reservation" widthClass="max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
            {/* Booking Details Side */}
            <div className="space-y-4 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <h3 className="font-semibold text-sm text-zinc-900 border-b pb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4AF37]"/> Guest Information
              </h3>
              <div className="space-y-2 text-sm text-zinc-700">
                <p><span className="text-zinc-500 font-medium w-20 inline-block">Name:</span> {editBookingTarget.guestName}</p>
                <p><span className="text-zinc-500 font-medium w-20 inline-block">Phone:</span> {editBookingTarget.phone}</p>
                <p><span className="text-zinc-500 font-medium w-20 inline-block">Email:</span> {editBookingTarget.email}</p>
              </div>

              <h3 className="font-semibold text-sm text-zinc-900 border-b pb-2 mt-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D4AF37]"/> Event Details
              </h3>
              <div className="space-y-2 text-sm text-zinc-700">
                <p><span className="text-zinc-500 font-medium w-24 inline-block">Event Type:</span> {editBookingTarget.eventType}</p>
                <p><span className="text-zinc-500 font-medium w-24 inline-block">Hall:</span> {editBookingTarget.hall.name}</p>
                <p><span className="text-zinc-500 font-medium w-24 inline-block">Date:</span> {new Date(editBookingTarget.eventDate).toLocaleDateString()}</p>
                <p><span className="text-zinc-500 font-medium w-24 inline-block">Time:</span> {editBookingTarget.startTime} - {editBookingTarget.endTime}</p>
                <p><span className="text-zinc-500 font-medium w-24 inline-block">Guests:</span> {editBookingTarget.guestCount} pax</p>
                <p className="pt-2 mt-2 border-t font-semibold flex justify-between">
                  <span>Grand Total:</span>
                  <span className="text-[#D4AF37]">{formatINR(editBookingTarget.totalPrice)}</span>
                </p>
              </div>
            </div>

            {/* Action Side */}
            <form onSubmit={handleBooking(d => updateBookingMutation.mutate({ id: editBookingTarget._id, d }))} className="space-y-5">
              <h3 className="font-semibold text-sm text-zinc-900 border-b pb-2">Update Status & Enquiry</h3>
              
              <Field label="Enquiry Status">
                <select
                  {...regBooking('enquiryStatus')}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] font-sans transition-shadow shadow-sm"
                >
                  <option value="NEW">New Enquiry</option>
                  <option value="CONTACTED">Contacted Guest</option>
                  <option value="CLOSED">Closed/Resolved</option>
                </select>
              </Field>

              <Field label="Booking Status">
                <select
                  {...regBooking('status')}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] font-sans transition-shadow shadow-sm"
                >
                  <option value="PENDING">Pending Approval</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </Field>

              <Field label="Payment Status">
                <select
                  {...regBooking('paymentStatus')}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] font-sans transition-shadow shadow-sm"
                >
                  <option value="PENDING">Pending Payment</option>
                  <option value="PAID">Fully Paid</option>
                </select>
              </Field>

              <Button type="submit" className="w-full font-sans bg-[#D4AF37] hover:bg-[#AE963C] text-white py-6 shadow-md mt-4" disabled={updateBookingMutation.isPending}>
                {updateBookingMutation.isPending ? 'Updating…' : 'Save Changes'}
              </Button>
            </form>
          </div>
        </Dialog>
      )}
    </AdminShell>
  );
}

function BanquetCalendarView({ bookings, halls }: { bookings: BanquetBooking[]; halls: BanquetHall[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedHallFilter, setSelectedHallFilter] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevDaysInMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];

  // Pad previous month days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevDaysInMonth - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevDaysInMonth - i),
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i),
    });
  }

  // Pad next month days
  const remainingCells = 42 - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getBookingsForDate = (date: Date) => {
    const dStr = date.toDateString();
    return bookings.filter(b => {
      const matchDate = new Date(b.eventDate).toDateString() === dStr;
      const matchHall = selectedHallFilter ? b.hall?._id === selectedHallFilter : true;
      return matchDate && matchHall && b.status !== 'CANCELLED';
    });
  };

  const selectedDateBookings = selectedDate ? getBookingsForDate(selectedDate) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      {/* Calendar Grid Column */}
      <Card className="p-5 lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between border-b pb-3 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-zinc-800 text-base">
              {MONTH_NAMES[month]} {year}
            </h3>
            <select
              value={selectedHallFilter}
              onChange={(e) => setSelectedHallFilter(e.target.value)}
              className="border rounded text-xs font-semibold px-2 py-1 bg-white text-zinc-700 focus:outline-none"
            >
              <option value="">All Halls</option>
              {halls.map((h) => (
                <option key={h._id} value={h._id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={handlePrevMonth}>&larr; Prev</Button>
            <Button size="sm" variant="outline" onClick={handleNextMonth}>Next &rarr;</Button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 text-center text-xs font-bold text-zinc-400 py-1 uppercase tracking-wider">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 gap-1 border-t pt-1">
          {calendarDays.map((cell, idx) => {
            const dateBookings = getBookingsForDate(cell.date);
            const isSelected = selectedDate?.toDateString() === cell.date.toDateString();
            const isToday = new Date().toDateString() === cell.date.toDateString();

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(cell.date)}
                className={`min-h-[70px] p-1.5 border rounded-lg flex flex-col justify-between cursor-pointer transition-all hover:bg-zinc-50 ${
                  cell.isCurrentMonth ? 'bg-white text-zinc-800' : 'bg-zinc-50/50 text-zinc-400 border-zinc-100'
                } ${isSelected ? 'border-brand ring-1 ring-brand bg-brand/5' : 'border-zinc-100'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isToday ? 'bg-brand text-white rounded-full h-5 w-5 flex items-center justify-center' : ''}`}>
                    {cell.day}
                  </span>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  {dateBookings.slice(0, 2).map((b) => (
                    <div
                      key={b._id}
                      className="text-[9px] font-bold px-1 py-0.5 rounded truncate text-zinc-700 bg-brand/10 border border-brand/20"
                      title={`${b.guestName} - ${b.eventType}`}
                    >
                      {b.eventType}
                    </div>
                  ))}
                  {dateBookings.length > 2 && (
                    <div className="text-[8px] font-bold text-zinc-400 pl-1">
                      +{dateBookings.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Day details list Column */}
      <div className="lg:col-span-4 space-y-4">
        <Card className="p-5 space-y-4">
          <div className="border-b pb-3">
            <h3 className="font-extrabold text-zinc-800 text-sm">
              Schedule: {selectedDate ? selectedDate.toLocaleDateString('en-IN', { dateStyle: 'long' }) : 'Selected Date'}
            </h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {selectedDateBookings.length} event{selectedDateBookings.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {selectedDateBookings.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                No events scheduled for this date.
              </div>
            ) : (
              selectedDateBookings.map((b) => (
                <div key={b._id} className="p-3 border rounded-lg bg-zinc-50 hover:bg-zinc-100/50 transition-all space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-zinc-800">{b.guestName}</span>
                    <Badge className="text-[9px] font-semibold bg-green-50 text-green-700 border-green-200">
                      {b.status}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-zinc-500 space-y-1">
                    <p>Event: <strong className="text-zinc-700">{b.eventType}</strong></p>
                    <p>Hall: <strong className="text-zinc-700">{b.hall?.name || 'Grand Hall'}</strong></p>
                    <p>Guests: <strong>{b.guestCount} Pax</strong></p>
                    <p>Time: <strong>{new Date(b.startTime).toLocaleTimeString('en-IN', { timeStyle: 'short' })} - {new Date(b.endTime).toLocaleTimeString('en-IN', { timeStyle: 'short' })}</strong></p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
