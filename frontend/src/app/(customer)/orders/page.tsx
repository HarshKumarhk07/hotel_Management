'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Receipt,
  Calendar,
  UtensilsCrossed,
  User,
  Mail,
  Phone,
  ArrowRight,
  Sparkles,
  Compass,
  LifeBuoy,
  Plus,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AuthGate } from '@/components/auth/AuthGate';
import { Badge, Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { useMyOrders } from '@/hooks/useOrders';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/orderStatus';
import { formatDate, formatINR } from '@/lib/utils';

interface CustomerBooking {
  _id: string;
  room: { _id: string; roomNumber: string; floor: number; roomType: string };
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  status: string;
  paymentStatus: string;
  confirmationNumber?: string;
}

function DashboardInner() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'bookings' | 'orders' | 'tickets'>('bookings');
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [bookingToCancel, setBookingToCancel] = useState<CustomerBooking | null>(null);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/rooms/bookings/${id}/cancel`, { reason: cancelReason });
    },
    onSuccess: () => {
      toast.success('Booking cancelled successfully');
      setIsCancelModalOpen(false);
      setBookingToCancel(null);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['my-room-bookings', user?.email] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to cancel booking');
    },
  });

  // Fetch food orders
  const { data: orders, isLoading: isLoadingOrders } = useMyOrders();

  // Fetch room bookings
  const { data: bookings, isLoading: isLoadingBookings } = useQuery({
    queryKey: ['my-room-bookings', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const res = await api.get<{ data: { bookings: CustomerBooking[] } }>('/rooms/bookings/my-bookings', {
        params: { email: user.email },
      });
      return res.data.data.bookings;
    },
    enabled: !!user?.email,
  });

  // Fetch service tickets
  const { data: tickets, isLoading: isLoadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ['my-service-tickets', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const res = await api.get('/complaints', {
        params: { email: user.email },
      });
      return res.data.complaints;
    },
    enabled: !!user?.email,
  });

  const ticketSchema = z.object({
    roomId: z.string().min(1, 'Please select your room'),
    category: z.enum(['HOUSEKEEPING', 'MAINTENANCE', 'ROOM_SERVICE', 'OTHER']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    description: z.string().min(1, 'Description is required'),
  });

  const { register: registerTicket, handleSubmit: handleTicketSubmit, formState: { errors: ticketErrors, isSubmitting: isSubmittingTicket }, reset: resetTicket, setValue: setTicketValue } = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      category: 'HOUSEKEEPING',
      priority: 'MEDIUM',
    }
  });

  useEffect(() => {
    if (bookings) {
      const activeBookings = bookings.filter((b: any) => ['CONFIRMED', 'CHECKED_IN'].includes(b.status));
      if (activeBookings.length === 1) {
        setTicketValue('roomId', activeBookings[0].room._id);
      }
    }
  }, [bookings, setTicketValue]);

  const onTicketSubmit = async (data: z.infer<typeof ticketSchema>) => {
    try {
      await api.post('/complaints', {
        ...data,
        guestName: user?.name || 'Guest',
        phone: (user as any)?.phone || '0000000000',
        email: user?.email,
      });
      toast.success('Service request submitted successfully');
      setIsTicketModalOpen(false);
      resetTicket();
      refetchTickets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit request');
    }
  };

  return (
    <div className="mx-auto max-w-4xl w-full p-4 sm:p-6 pt-24 lg:pt-32 space-y-6">
      
      {/* VIP Guest Profile Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/35 bg-gradient-to-br from-zinc-950 to-zinc-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 h-64 w-64 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
              <Sparkles className="h-3 w-3" /> Gold Circle Member
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, <span className="text-[#D4AF37]">{user?.name || 'Valued Guest'}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {user?.email}
              </span>
              <span className="h-3 w-px bg-zinc-700 hidden sm:inline" />
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Guest Portal
              </span>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <Button
              onClick={() => router.push('/rooms')}
              className="flex-1 md:flex-none border border-[#D4AF37]/45 text-[#D4AF37] bg-transparent hover:bg-[#D4AF37]/10 text-xs px-5 py-5 rounded-xl uppercase tracking-wider font-extrabold"
            >
              Book Room
            </Button>
            <Button
              onClick={() => router.push('/restaurant/waitlist')}
              className="flex-1 md:flex-none bg-[#D4AF37] hover:bg-[#AE963C] text-zinc-950 text-xs px-5 py-5 rounded-xl uppercase tracking-wider font-extrabold border border-transparent"
            >
              Reserve Table
            </Button>
            <Button
              onClick={() => {
                setActiveTab('tickets');
                setIsTicketModalOpen(true);
              }}
              className="flex-1 md:flex-none bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 text-xs px-5 py-5 rounded-xl uppercase tracking-wider font-extrabold hidden md:flex"
            >
              Request Service
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-2 pb-4 text-xs sm:text-sm font-extrabold uppercase tracking-widest transition-all ${
            activeTab === 'bookings'
              ? 'border-b-2 border-[#D4AF37] text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-600'
          } px-4`}
        >
          <Calendar className="h-4 w-4" /> Room stays ({bookings?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 pb-4 text-xs sm:text-sm font-extrabold uppercase tracking-widest transition-all ${
            activeTab === 'orders'
              ? 'border-b-2 border-[#D4AF37] text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-600'
          } px-4`}
        >
          <UtensilsCrossed className="h-4 w-4" /> Dining ({orders?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 pb-4 text-xs sm:text-sm font-extrabold uppercase tracking-widest transition-all ${
            activeTab === 'tickets'
              ? 'border-b-2 border-[#D4AF37] text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-600'
          } px-4`}
        >
          <LifeBuoy className="h-4 w-4" /> Service ({tickets?.length ?? 0})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-4">
        {activeTab === 'bookings' && (
          <>
            {isLoadingBookings ? (
              <CenteredSpinner label="Loading your stays…" />
            ) : !bookings || bookings.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-zinc-200">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 text-zinc-400 mb-4">
                  <Compass className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-800 mb-1">No active stays</h3>
                <p className="text-xs text-zinc-500 max-w-sm mb-6">
                  You do not have any room bookings scheduled under this email. Experience our luxury suites and chambers.
                </p>
                <Button
                  onClick={() => router.push('/rooms')}
                  className="bg-[#111] hover:bg-zinc-800 text-[#D4AF37] text-xs uppercase tracking-wider font-extrabold px-6 py-5 rounded-xl"
                >
                  Explore Chambers & Suites
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                {bookings.map((b) => (
                  <Card
                    key={b._id}
                    className="p-5 border-zinc-200/80 bg-white rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-1.5 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-zinc-900 text-lg">
                          Room {b.room?.roomNumber || 'TBD'}
                        </span>
                        <Badge className="bg-zinc-100 text-zinc-600 font-mono text-[9px]">
                          {b.confirmationNumber || 'CONF-TBD'}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 font-medium">
                        Check-in: <span className="font-bold text-zinc-800">{formatDate(b.checkInDate)}</span> · Check-out: <span className="font-bold text-zinc-800">{formatDate(b.checkOutDate)}</span>
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Stay registration name: <span className="font-semibold text-zinc-600">{b.guestName}</span>
                      </p>
                    </div>

                    <div className="flex flex-row md:flex-col justify-between md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-100">
                      <div className="space-y-1 md:text-right">
                        <span className="text-xs font-bold text-zinc-400 block uppercase tracking-wider">Total Charge</span>
                        <span className="text-base font-extrabold text-zinc-900">{formatINR(b.totalPrice)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          className={`
                            ${b.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200/60' : ''}
                            ${b.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700 border-blue-200/60' : ''}
                            ${b.status === 'CHECKED_IN' ? 'bg-green-50 text-green-700 border-green-200/60' : ''}
                            ${b.status === 'CHECKED_OUT' ? 'bg-zinc-100 text-zinc-600 border-zinc-200/60' : ''}
                            ${b.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200/60' : ''}
                            border font-semibold text-[10px] px-2 py-0.5 rounded-full
                          `}
                        >
                          {b.status}
                        </Badge>
                        {['PENDING', 'CONFIRMED'].includes(b.status) && (
                          <button
                            onClick={() => {
                              setBookingToCancel(b);
                              setIsCancelModalOpen(true);
                            }}
                            className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-wider underline mr-2"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/rooms/confirm/${b._id}`)}
                          className="text-xs font-bold text-[#D4AF37] hover:text-[#AE963C] flex items-center gap-0.5 transition-colors"
                        >
                          Manage stay <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'orders' && (
          <>
            {isLoadingOrders ? (
              <CenteredSpinner label="Loading your orders…" />
            ) : !orders || orders.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-zinc-200">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 text-zinc-400 mb-4">
                  <UtensilsCrossed className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-800 mb-1">No dining orders</h3>
                <p className="text-xs text-zinc-500 max-w-sm mb-6">
                  You have not placed any room service or kitchen dining orders yet. Enjoy curated, gourmet culinary delights.
                </p>
                <Button
                  onClick={() => router.push('/menu')}
                  className="bg-[#111] hover:bg-zinc-800 text-[#D4AF37] text-xs uppercase tracking-wider font-extrabold px-6 py-5 rounded-xl"
                >
                  Order In-Room Dining
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                {orders.map((o) => (
                  <Card
                    key={o._id}
                    className="p-5 border-zinc-200/80 bg-white rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-1.5 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-zinc-900 text-lg">
                          Order {o.orderNumber}
                        </span>
                        <Badge className={STATUS_BADGE[o.status] ?? ''}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 font-medium">
                        Placed on: <span className="font-bold text-zinc-800">{o.createdAt ? new Date(o.createdAt).toLocaleString() : 'TBD'}</span>
                      </p>
                      <p className="text-[11px] text-zinc-400 font-semibold">
                        {o.items?.length ?? 0} item{(o.items?.length ?? 0) !== 1 ? 's' : ''} in this order
                      </p>
                    </div>

                    <div className="flex flex-row md:flex-col justify-between md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-100">
                      <div className="space-y-1 md:text-right">
                        <span className="text-xs font-bold text-zinc-400 block uppercase tracking-wider">Total Bill</span>
                        <span className="text-base font-extrabold text-zinc-900">{formatINR(o.pricing?.total ?? 0)}</span>
                      </div>
                      <Link
                        href={`/orders/${o._id}`}
                        className="text-xs font-bold text-[#D4AF37] hover:text-[#AE963C] flex items-center gap-0.5 transition-colors"
                      >
                        Track order <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-800">Your Service Tickets</h3>
              <Button onClick={() => setIsTicketModalOpen(true)} className="bg-[#111] hover:bg-zinc-800 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#D4AF37]" /> Request Service
              </Button>
            </div>
            {isLoadingTickets ? (
              <CenteredSpinner label="Loading tickets…" />
            ) : !tickets || tickets.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-zinc-200">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 text-zinc-400 mb-4">
                  <LifeBuoy className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-800 mb-1">No Service Tickets</h3>
                <p className="text-xs text-zinc-500 max-w-sm mb-6">
                  You haven&apos;t submitted any service requests yet.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {tickets.map((t: any) => (
                  <Card key={t._id} className="p-5 border-zinc-200/80 bg-white rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900">Room {t.room?.roomNumber}</span>
                          <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">{t.category}</span>
                        </div>
                        <p className="text-xs text-zinc-400">Filed on: {new Date(t.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge className={`
                        ${t.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : ''}
                        ${t.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' : ''}
                        ${t.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : ''}
                        ${t.status === 'REJECTED' ? 'bg-red-50 text-red-700' : ''}
                      `}>
                        {t.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-700 bg-zinc-50 p-3 rounded-lg border">{t.description}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} title="Request Service">
        <form onSubmit={handleTicketSubmit(onTicketSubmit)} className="space-y-4 font-sans">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Select Room</label>
            <select
              {...registerTicket('roomId')}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900"
            >
              <option value="">-- Choose your booked room --</option>
              {bookings?.filter(b => ['CONFIRMED', 'CHECKED_IN'].includes(b.status)).map(b => (
                <option key={b.room._id} value={b.room._id}>Room {b.room.roomNumber}</option>
              ))}
            </select>
            {ticketErrors.roomId && <p className="text-xs text-red-500">{ticketErrors.roomId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Category</label>
              <select
                {...registerTicket('category')}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900"
              >
                <option value="HOUSEKEEPING">Housekeeping</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="ROOM_SERVICE">Room Service</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Priority</label>
              <select
                {...registerTicket('priority')}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <Field label="Description" error={ticketErrors.description?.message}>
            <textarea
              {...registerTicket('description')}
              rows={4}
              placeholder="Please describe your request (e.g. extra towels, AC not working...)"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900"
            />
          </Field>

          <Button type="submit" className="w-full" disabled={isSubmittingTicket}>
            {isSubmittingTicket ? 'Submitting...' : 'Submit Request'}
          </Button>
        </form>
      </Dialog>
      <Dialog open={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Booking">
        <div className="space-y-4 font-sans">
          <p className="text-sm text-zinc-600">
            Are you sure you want to cancel your booking for Room {bookingToCancel?.room?.roomNumber}?
            {bookingToCancel?.paymentStatus === 'PAID' && ' A refund will be initiated according to our cancellation policy.'}
          </p>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Reason (Optional)</label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why are you cancelling?"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>
              Keep Booking
            </Button>
            <Button 
              variant="default" 
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              onClick={() => { if(bookingToCancel) cancelMutation.mutate(bookingToCancel._id); }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardInner />
    </AuthGate>
  );
}
