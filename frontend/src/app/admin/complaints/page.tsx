'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ClipboardList,
  Clock,
  LifeBuoy,
  Plus,
  RefreshCw,
  Search,
  Users,
  AlertTriangle,
  CheckCircle2,
  X,
  User,
  Check,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  designation?: string;
}

interface Complaint {
  _id: string;
  room: {
    _id: string;
    roomNumber: string;
    floor: number;
  };
  guestName: string;
  phone: string;
  category: 'HOUSEKEEPING' | 'MAINTENANCE' | 'ROOM_SERVICE' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
  status: TicketStatus;
  assignedStaff?: StaffMember;
  staffNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Ticket lifecycle. REJECTED is a terminal side-exit kept for legacy tickets. */
const TICKET_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'REJECTED',
] as const;

type TicketStatus = (typeof TICKET_STATUSES)[number];

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
};

const TICKET_STATUS_BADGE: Record<TicketStatus, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  CLOSED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const updateSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  assignedStaff: z.string().optional().or(z.literal('')),
  staffNotes: z.string().trim().max(1000).optional(),
});

type UpdateForm = z.infer<typeof updateSchema>;

export default function AdminComplaintsPage() {
  const qc = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<Complaint | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<UpdateForm>({
    resolver: zodResolver(updateSchema),
  });

  // Query complaints
  const { data: listRes, isLoading, refetch } = useQuery<{ data: { complaints: Complaint[] } }>({
    queryKey: ['admin-complaints', statusFilter, categoryFilter, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter) p.set('status', statusFilter);
      if (categoryFilter) p.set('category', categoryFilter);
      if (search) p.set('search', search);
      return api.get(`/complaints?${p.toString()}`).then((r) => r.data);
    },
  });
  const complaints = listRes?.data?.complaints ?? [];

  // Query staff list for assignment
  const { data: staffRes } = useQuery<{ data: { staff: StaffMember[] } }>({
    queryKey: ['admin-staff-list'],
    queryFn: () => api.get('/staff').then((r) => r.data),
  });
  const staffList = staffRes?.data?.staff ?? [];

  // Socket listener for new/updated tickets
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('complaint:new', (complaint: Complaint) => {
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
    });

    socket.on('complaint:updated', (updated: Complaint) => {
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
    });

    return () => {
      socket.off('complaint:new');
      socket.off('complaint:updated');
    };
  }, [qc]);

  // Update ticket mutation
  const updateMutation = useMutation({
    mutationFn: (d: UpdateForm) => {
      return api.patch(`/complaints/${selectedTicket?._id}`, {
        status: d.status,
        assignedStaff: d.assignedStaff || null,
        staffNotes: d.staffNotes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
      setSelectedTicket(null);
      reset();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Failed to update ticket')),
  });

  const onSubmit = (values: UpdateForm) => {
    setError('');
    updateMutation.mutate(values);
  };

  const handleEditClick = (c: Complaint) => {
    setSelectedTicket(c);
    setValue('status', c.status);
    setValue('assignedStaff', c.assignedStaff?._id || '');
    setValue('staffNotes', c.staffNotes || '');
  };

  const getStatusBadge = (status: string) => {
    const cls = TICKET_STATUS_BADGE[status as TicketStatus];
    if (!cls) return <Badge>{status}</Badge>;
    return <Badge className={cls}>{TICKET_STATUS_LABEL[status as TicketStatus]}</Badge>;
  };

  return (
    <AdminShell>
      <div className="space-y-6 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-brand animate-pulse" /> Service Desk Tickets
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Manage guest requests, housekeeping issues, and room maintenance</p>
          </div>
          <Button onClick={() => void refetch()} variant="outline" size="sm" className="self-start">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* How it works info banner */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 text-xl">🎫</div>
          <div className="space-y-2 min-w-0">
            <p className="text-sm font-bold text-blue-900">How Service Tickets work</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-700">
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold text-blue-800">1</span>
                <p><span className="font-semibold">Guest submits</span> a request from their room&apos;s QR menu under <em>Request a Service</em> — they pick a category (Housekeeping, Maintenance, Room Service, Other) and describe their need.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold text-blue-800">2</span>
                <p><span className="font-semibold">Ticket appears here</span> instantly via real-time socket. You&apos;ll also see a pop-up notification and a badge on the bell icon at the top.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold text-blue-800">3</span>
                <p><span className="font-semibold">Assign a staff member</span>, update status to <em>In Progress</em>, add resolution notes, then mark it <em>Completed</em> when done. The guest sees live status updates from their QR menu.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and search */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by guest name, phone, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg text-xs font-semibold px-3 py-2 bg-white text-zinc-700 focus:outline-none"
            >
              <option value="">All Statuses</option>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABEL[s]}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border rounded-lg text-xs font-semibold px-3 py-2 bg-white text-zinc-700 focus:outline-none"
            >
              <option value="">All Categories</option>
              <option value="HOUSEKEEPING">Housekeeping</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="ROOM_SERVICE">Room Delivery</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <CenteredSpinner label="Loading service tickets..." />
        ) : complaints.length === 0 ? (
          <Card className="py-16 text-center">
            <ClipboardList className="mx-auto h-12 w-12 text-zinc-300 mb-3" />
            <p className="text-sm font-semibold text-zinc-900">No tickets found</p>
            <p className="text-xs text-zinc-400 mt-1">There are no active complaints matching the filters.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {complaints.map((c) => (
              <Card key={c._id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-zinc-800 text-sm">Room {c.room?.roomNumber}</span>
                      <span className="text-[10px] text-zinc-400">Floor {c.room?.floor}</span>
                    </div>
                    {getStatusBadge(c.status)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                      <span>{c.category}</span>
                      <span>·</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        c.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                        c.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                        c.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                        'bg-zinc-100 text-zinc-700'
                      }`}>{c.priority} Priority</span>
                      <span>·</span>
                      <span className="text-[10px]">#{c._id.substring(18).toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Filed: {new Date(c.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <p className="text-xs text-zinc-700 bg-zinc-50 p-2.5 rounded-lg border font-medium line-clamp-3">
                    {c.description}
                  </p>

                  <div className="border-t pt-2.5 text-[11px] text-zinc-500 space-y-1">
                    <p><span className="font-bold text-zinc-600">Guest:</span> {c.guestName} ({c.phone})</p>
                    {c.assignedStaff ? (
                      <p className="flex items-center gap-1">
                        <span className="font-bold text-zinc-600">Staff:</span>
                        <span className="text-zinc-700">{c.assignedStaff.name} ({c.assignedStaff.designation || 'Staff'})</span>
                      </p>
                    ) : (
                      <p className="text-red-500 font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Unassigned
                      </p>
                    )}
                  </div>

                  {c.staffNotes && (
                    <div className="bg-green-50/50 text-zinc-600 border border-green-100 p-2 rounded text-[10px] space-y-0.5">
                      <span className="font-bold text-green-700 uppercase tracking-widest text-[8px]">Notes:</span>
                      <p className="line-clamp-2">{c.staffNotes}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t">
                  <Button onClick={() => handleEditClick(c)} className="w-full text-xs" size="sm">
                    Manage Request
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Update Ticket Dialog */}
        <Dialog open={!!selectedTicket} onClose={() => setSelectedTicket(null)} title="Manage Service Ticket">
          {selectedTicket && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="border rounded-lg bg-zinc-50 p-3 text-xs space-y-1.5">
                <p><span className="font-bold text-zinc-500">Ticket:</span> #{selectedTicket._id.substring(18).toUpperCase()}</p>
                <p><span className="font-bold text-zinc-500">Room:</span> {selectedTicket.room?.roomNumber} (Floor {selectedTicket.room?.floor})</p>
                <p><span className="font-bold text-zinc-500">Guest:</span> {selectedTicket.guestName} ({selectedTicket.phone})</p>
                <p><span className="font-bold text-zinc-500">Request:</span> {selectedTicket.description}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Update Status</label>
                <select
                  {...register('status')}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900"
                >
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TICKET_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-400">
                  Lifecycle: Pending → Assigned → In Progress → Completed → Closed. The guest is emailed on
                  every status change.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Assign Staff Member</label>
                <select
                  {...register('assignedStaff')}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900"
                >
                  <option value="">-- Unassigned --</option>
                  {staffList.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Staff Resolution Notes</label>
                <textarea
                  rows={3}
                  placeholder="Details of action taken, resolution, or reasons..."
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900"
                  {...register('staffNotes')}
                />
                {errors.staffNotes?.message && (
                  <p className="text-xs text-red-600">{errors.staffNotes.message}</p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setSelectedTicket(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      </div>
    </AdminShell>
  );
}
