'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ClipboardList, LifeBuoy, Send, CheckCircle2, History, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState, Badge } from '@/components/ui/primitives';
import { Field, Input, FieldError } from '@/components/ui/input';
import { api, apiErrorMessage } from '@/lib/api';
import { SiteFooter } from '@/components/site/SiteFooter';
import { getSocket } from '@/lib/socket';

const complaintSchema = z.object({
  guestName: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits'),
  category: z.enum(['HOUSEKEEPING', 'MAINTENANCE', 'ROOM_SERVICE', 'OTHER']),
  description: z.string().trim().min(5, 'Describe your request in detail (min 5 chars)').max(1000),
});

type ComplaintForm = z.infer<typeof complaintSchema>;

function GuestServicesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');
  const roomNumber = searchParams.get('rno');
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'request' | 'tickets'>('request');
  const [successTicket, setSuccessTicket] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // For tracking lookup
  const [lookupPhone, setLookupPhone] = useState('');
  const [hasLookedUp, setHasLookedUp] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ComplaintForm>({
    resolver: zodResolver(complaintSchema),
    defaultValues: { category: 'HOUSEKEEPING' },
  });

  const [guestEmail, setGuestEmail] = useState('');

  // Load guest details if authenticated
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.data?.user) {
          setValue('guestName', res.data.data.user.name);
          setValue('phone', res.data.data.user.phone || '');
          setLookupPhone(res.data.data.user.phone || '');
          setGuestEmail(res.data.data.user.email || '');
        }
      } catch {
        // Degrade gracefully
      }
    };
    fetchMe();
  }, [setValue]);

  // Service requests are only available once the guest has checked in.
  const { data: eligibility, isLoading: loadingEligibility } = useQuery({
    queryKey: ['service-eligibility', guestEmail, lookupPhone],
    enabled: !!guestEmail || !!lookupPhone,
    queryFn: async () => {
      const res = await api.get('/complaints/eligibility', {
        params: { email: guestEmail || undefined, phone: lookupPhone || undefined },
      });
      return res.data?.data as { eligible: boolean; reason: string | null; rooms: { roomId: string; roomNumber: string }[] };
    },
  });

  const canRequestService = !!eligibility?.eligible;

  // Fetch guest's complaints
  const { data: tickets, isLoading: loadingTickets, refetch: executeLookup } = useQuery({
    queryKey: ['my-complaints', lookupPhone, roomId],
    enabled: hasLookedUp || !!roomId,
    queryFn: async () => {
      const params: any = {};
      if (lookupPhone) params.phone = lookupPhone;
      if (roomId) params.roomId = roomId;
      const res = await api.get('/complaints/my', { params });
      return res.data?.data?.complaints ?? [];
    },
  });

  // Socket updates for live ticket tracking
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('complaint:updated', (updated: any) => {
      queryClient.setQueryData(['my-complaints', lookupPhone, roomId], (prev: any[] | undefined) => {
        if (!prev) return prev;
        return prev.map((c) => (c._id === updated._id ? updated : c));
      });
    });

    // A brand new ticket isn't in the cache to patch — refetch instead.
    socket.on('complaint:new', () => {
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
    });

    return () => {
      socket.off('complaint:updated');
      socket.off('complaint:new');
    };
  }, [queryClient, lookupPhone, roomId]);

  const submitMutation = useMutation({
    mutationFn: async (data: ComplaintForm) => {
      const targetRoomId = roomId || eligibility?.rooms?.[0]?.roomId;
      const res = await api.post('/complaints', {
        ...data,
        roomId: targetRoomId,
        email: guestEmail || undefined,
      });
      return res.data?.data?.complaint;
    },
    onSuccess: (data) => {
      setSuccessTicket(data);
      reset();
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
    },
    onError: (err) => {
      setError(apiErrorMessage(err, 'Failed to file your service request.'));
    },
  });

  const onSubmit = (values: ComplaintForm) => {
    setError(null);
    setSuccessTicket(null);
    submitMutation.mutate(values);
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupPhone) return;
    setHasLookedUp(true);
    executeLookup();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case 'ASSIGNED':
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Assigned</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">In Progress</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case 'CLOSED':
        return <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">Closed</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors text-xs font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to menu
          </button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-brand" /> Room Service Desk
            </h1>
            {roomNumber && <p className="text-zinc-500 text-sm mt-1">Room {roomNumber} desk service desk</p>}
          </div>

          <div className="flex rounded-lg border bg-zinc-100 p-0.5 text-xs">
            <button
              onClick={() => setActiveTab('request')}
              className={`rounded-md px-3 py-1.5 font-semibold transition-all ${
                activeTab === 'request' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Submit Request
            </button>
            <button
              onClick={() => {
                setActiveTab('tickets');
                if (roomId) setHasLookedUp(true);
              }}
              className={`rounded-md px-3 py-1.5 font-semibold transition-all ${
                activeTab === 'tickets' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Track Tickets
            </button>
          </div>
        </div>

        {activeTab === 'request' ? (
          <Card className="p-6 md:p-8 space-y-6">
            {successTicket ? (
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-zinc-900">Request Filed Successfully!</h3>
                  <p className="text-zinc-500 text-xs">
                    Our hotel operations staff has been notified. Ticket ID: #{successTicket._id.substring(18).toUpperCase()}
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    onClick={() => {
                      setSuccessTicket(null);
                      setActiveTab('tickets');
                      setHasLookedUp(true);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Track Live Progress
                  </Button>
                </div>
              </div>
            ) : !loadingEligibility && !canRequestService ? (
              <div className="text-center py-8 space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-zinc-900">Check-in required</h3>
                  <p className="text-zinc-500 text-xs max-w-sm mx-auto">
                    {eligibility?.reason || 'You can request hotel services after completing check-in.'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {error && (
                  <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Guest Name" error={errors.guestName?.message}>
                    <Input placeholder="John Doe" {...register('guestName')} />
                  </Field>

                  <Field label="Mobile Number" error={errors.phone?.message}>
                    <Input placeholder="9876543210" {...register('phone')} />
                  </Field>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Service Category</label>
                  <select
                    {...register('category')}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="HOUSEKEEPING">Housekeeping (Towels, Linens, Cleaning)</option>
                    <option value="MAINTENANCE">Maintenance (AC, Plumbing, Electrical)</option>
                    <option value="ROOM_SERVICE">Room Delivery / Amenities</option>
                    <option value="OTHER">Other Assistance</option>
                  </select>
                </div>

                <Field label="How can we assist you?" error={errors.description?.message}>
                  <textarea
                    rows={4}
                    placeholder="Provide details about your request (e.g. Please bring 2 extra towels, AC is not cooling properly...)"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                    {...register('description')}
                  />
                </Field>

                <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? 'Filing request...' : 'File Service Request'}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}
          </Card>
        ) : (
          <div className="space-y-6">
            {!roomId && (
              <Card className="p-5">
                <form onSubmit={handleLookup} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter mobile number to view tickets"
                      value={lookupPhone}
                      onChange={(e) => setLookupPhone(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm">
                    Find Tickets
                  </Button>
                </form>
              </Card>
            )}

            {loadingTickets ? (
              <CenteredSpinner label="Fetching tickets..." />
            ) : tickets && tickets.length > 0 ? (
              <div className="space-y-4">
                {tickets.map((t: any) => (
                  <Card key={t._id} className="p-5 border-l-4 border-l-brand">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            {t.category}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            #{t._id.substring(18).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Filed {new Date(t.createdAt).toLocaleString('en-IN')}
                        </p>
                      </div>
                      {getStatusBadge(t.status)}
                    </div>

                    <p className="text-xs text-zinc-700 bg-zinc-50 rounded-lg p-3 border font-medium">
                      {t.description}
                    </p>

                    {t.assignedStaff && (
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="font-bold">Assigned to:</span>
                        <span>{t.assignedStaff.name} ({t.assignedStaff.designation || 'Staff'})</span>
                      </div>
                    )}

                    {t.staffNotes && (
                      <div className="mt-3 rounded-lg bg-green-50/50 p-2.5 text-xs text-zinc-700 border border-green-100 flex flex-col gap-1">
                        <span className="font-bold text-green-700 text-[10px] uppercase tracking-wider">
                          Staff Update:
                        </span>
                        <p>{t.staffNotes}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : hasLookedUp ? (
              <EmptyState
                title="No tickets found"
                description="We couldn't find any service tickets linked to this description."
              />
            ) : null}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

export default function GuestServicesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-400 text-sm">Loading...</div>}>
      <GuestServicesInner />
    </Suspense>
  );
}
