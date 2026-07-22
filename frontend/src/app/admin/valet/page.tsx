'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Activity,
  Car,
  CheckCircle2,
  CircleDot,
  KeyRound,
  ParkingCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ValetManager {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  employeeId?: string;
  isOnline: boolean;
  isActive: boolean;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
  activeVehicles: number;
  vehiclesDeliveredToday: number;
}

interface ValetStats {
  totalValetManagers: number;
  onlineValetManagers: number;
  activeVehicles: number;
  requestedVehicles: number;
  bringingVehicles: number;
  gateVehicles: number;
  deliveredToday: number;
  totalSlots: number;
  occupiedSlots: number;
  freeSlots: number;
}

interface ValetActivity {
  _id: string;
  type: string;
  description: string;
  createdAt: string;
  valetManager?: { name: string; email: string; employeeId?: string };
  vehicle?: { carNumber: string; brand?: string; model?: string; status: string };
}

// ── Validation schemas ─────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().email('Valid email required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  employeeId: z.string().trim().optional(),
});

const editSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().email('Valid email required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  employeeId: z.string().trim().optional(),
  isActive: z.boolean(),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, accent,
}: { label: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <Card className="p-4">
      <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </Card>
  );
}

// ── Activity Feed ──────────────────────────────────────────────────────────────

function ActivityFeed() {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);

  const { data, isLoading } = useQuery({
    queryKey: ['valet-activity'],
    queryFn: async () => {
      const res = await api.get<{ data: ValetActivity[] }>('/valet/admin/activity');
      return res.data.data;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (status !== 'authenticated') return;
    const socket = getSocket();
    const onUpdate = () => queryClient.invalidateQueries({ queryKey: ['valet-activity'] });
    socket.on('valet:new', onUpdate);
    socket.on('valet:updated', onUpdate);
    return () => {
      socket.off('valet:new', onUpdate);
      socket.off('valet:updated', onUpdate);
    };
  }, [status, queryClient]);

  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
        <Activity className="h-4 w-4" /> Recent Activity
      </h2>
      {isLoading ? (
        <CenteredSpinner />
      ) : !data || data.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">No recent valet activity</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {data.map((item) => (
            <div key={item._id} className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Car className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 truncate">
                  {item.vehicle?.carNumber ?? item.description ?? item.type ?? 'Activity'}
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  {[
                    item.valetManager?.name,
                    new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {item.vehicle?.status && (
                <Badge className="ml-auto shrink-0 bg-zinc-100 text-zinc-600 text-[10px] capitalize">
                  {item.vehicle.status.toLowerCase()}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Create Modal ───────────────────────────────────────────────────────────────

function CreateManagerModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });
  const [serverError, setServerError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => api.post('/valet/admin/managers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valet-managers'] });
      queryClient.invalidateQueries({ queryKey: ['valet-admin-stats'] });
      onClose();
    },
    onError: (err) => setServerError(apiErrorMessage(err)),
  });

  return (
    <form
      id="create-valet-form"
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      className="space-y-4"
    >
      {serverError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>
      )}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        A temporary password <strong>Valet123!</strong> will be assigned. A welcome email will be sent.
      </div>
      <Field label="Full Name">
        <Input id="vm-name" {...register('name')} placeholder="e.g. Rajesh Kumar" />
        <FieldError message={errors.name?.message} />
      </Field>
      <Field label="Email">
        <Input id="vm-email" type="email" {...register('email')} placeholder="valet@hotel.com" />
        <FieldError message={errors.email?.message} />
      </Field>
      <Field label="Phone">
        <Input id="vm-phone" {...register('phone')} placeholder="+91 98765 43210" />
        <FieldError message={errors.phone?.message} />
      </Field>
      <Field label="Employee ID (optional)">
        <Input id="vm-empid" {...register('employeeId')} placeholder="e.g. VM-001" />
      </Field>
      <Button
        id="create-valet-submit"
        type="submit"
        className="w-full"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Creating…' : 'Create Valet Manager'}
      </Button>
    </form>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

function EditManagerModal({ manager, onClose }: { manager: ValetManager; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: manager.name,
      email: manager.email,
      phone: manager.phone ?? '',
      employeeId: manager.employeeId ?? '',
      isActive: manager.isActive,
    },
  });
  const [serverError, setServerError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: EditForm) => api.patch(`/valet/admin/managers/${manager._id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valet-managers'] });
      onClose();
    },
    onError: (err) => setServerError(apiErrorMessage(err)),
  });

  return (
    <form
      id="edit-valet-form"
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      className="space-y-4"
    >
      {serverError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>
      )}
      <Field label="Full Name">
        <Input id="edit-vm-name" {...register('name')} />
        <FieldError message={errors.name?.message} />
      </Field>
      <Field label="Email">
        <Input id="edit-vm-email" type="email" {...register('email')} />
        <FieldError message={errors.email?.message} />
      </Field>
      <Field label="Phone">
        <Input id="edit-vm-phone" {...register('phone')} />
        <FieldError message={errors.phone?.message} />
      </Field>
      <Field label="Employee ID (optional)">
        <Input id="edit-vm-empid" {...register('employeeId')} />
      </Field>
      <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
        <label htmlFor="vm-isactive" className="flex-1 text-sm font-medium text-zinc-700">Account Active</label>
        <input id="vm-isactive" type="checkbox" {...register('isActive')} className="h-4 w-4 rounded" />
      </div>
      <Button
        id="edit-valet-submit"
        type="submit"
        className="w-full"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  );
}

// ── Manage Slots Modal ──────────────────────────────────────────────────────────

function ManageSlotsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [newSlot, setNewSlot] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data: slots, isLoading } = useQuery<{ _id: string; slotNumber: string; isOccupied: boolean }[]>({
    queryKey: ['admin-valet-slots'],
    queryFn: async () => {
      const res = await api.get('/valet/admin/slots'); // Note: we can use the existing /valet/slots or the admin one. Let's use /valet/slots
      return res.data.data;
    },
    refetchInterval: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: (slotNumber: string) => api.post('/valet/admin/slots', { slotNumber }),
    onSuccess: () => {
      setNewSlot('');
      setErrorMsg('');
      queryClient.invalidateQueries({ queryKey: ['admin-valet-slots'] });
    },
    onError: (err) => setErrorMsg(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/valet/admin/slots/${id}`),
    onSuccess: () => {
      setErrorMsg('');
      queryClient.invalidateQueries({ queryKey: ['admin-valet-slots'] });
    },
    onError: (err) => setErrorMsg(apiErrorMessage(err)),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlot.trim()) return;
    createMutation.mutate(newSlot.trim());
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
      )}
      
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input 
          value={newSlot} 
          onChange={(e) => setNewSlot(e.target.value)} 
          placeholder="New slot (e.g. P-51)" 
          className="flex-1"
        />
        <Button type="submit" disabled={!newSlot.trim() || createMutation.isPending}>
          Add
        </Button>
      </form>

      <div className="border rounded-lg max-h-80 overflow-y-auto bg-zinc-50">
        {isLoading ? (
          <CenteredSpinner />
        ) : !slots || slots.length === 0 ? (
          <p className="p-4 text-center text-sm text-zinc-500">No parking slots found.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 sticky top-0 border-b">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-600">Slot Number</th>
                <th className="px-3 py-2 font-medium text-zinc-600 w-24">Status</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {slots.map(s => (
                <tr key={s._id} className="hover:bg-white transition-colors">
                  <td className="px-3 py-2 font-semibold text-zinc-800">{s.slotNumber}</td>
                  <td className="px-3 py-2">
                    {s.isOccupied ? (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Occupied</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Free</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(s._id)}
                      disabled={s.isOccupied || deleteMutation.isPending}
                      className="text-zinc-400 hover:text-red-500 disabled:opacity-50 disabled:hover:text-zinc-400"
                      title={s.isOccupied ? "Cannot delete occupied slot" : "Delete slot"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="pt-2 flex justify-end">
        <Button variant="outline" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function ValetManagementContent() {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ValetManager | null>(null);
  const [resetTarget, setResetTarget] = useState<ValetManager | null>(null);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetError, setResetError] = useState('');

  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleDownloadReport = async (format: 'pdf' | 'xlsx') => {
    try {
      const res = await api.get('/valet/reports/export', {
        params: { date: reportDate, format },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `valet-report-${reportDate}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download report. Make sure you are logged in.');
    }
  };

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['valet-admin-stats'],
    queryFn: async () => {
      const res = await api.get<{ data: ValetStats }>('/valet/admin/stats');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  // Managers list
  const { data: managersData, isLoading: managersLoading } = useQuery({
    queryKey: ['valet-managers', search, statusFilter, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (activeFilter !== 'all') params.set('activeState', activeFilter);
      const res = await api.get<{ data: { items: ValetManager[]; meta: { total: number } } }>(
        `/valet/admin/managers?${params}`
      );
      return res.data.data;
    },
    staleTime: 15_000,
  });

  // Live socket updates
  useEffect(() => {
    if (status !== 'authenticated') return;
    const socket = getSocket();
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['valet-managers'] });
      queryClient.invalidateQueries({ queryKey: ['valet-admin-stats'] });
    };
    socket.on('valet:status_change', refresh);
    socket.on('valet:new', refresh);
    socket.on('valet:updated', refresh);
    return () => {
      socket.off('valet:status_change', refresh);
      socket.off('valet:new', refresh);
      socket.off('valet:updated', refresh);
    };
  }, [status, queryClient]);

  const resetMutation = useMutation({
    mutationFn: (id: string) => api.post(`/valet/admin/managers/${id}/reset-password`),
    onSuccess: () => {
      setResetTarget(null);
      setResetConfirmed(false);
    },
    onError: (err) => setResetError(apiErrorMessage(err)),
  });

  const handleResetPassword = useCallback(() => {
    if (!resetTarget) return;
    setResetError('');
    resetMutation.mutate(resetTarget._id);
  }, [resetTarget, resetMutation]);

  const managers = managersData?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Valet Parking</h1>
          <p className="text-sm text-zinc-500">Manage valet managers and monitor parking operations</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setSlotsOpen(true)}
            className="flex items-center gap-2"
          >
            <ParkingCircle className="h-4 w-4" /> Manage Slots
          </Button>
          <Button
            id="create-valet-manager-btn"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#AE963C] text-white"
          >
            <Plus className="h-4 w-4" /> Add Valet Manager
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Total Managers"
            value={stats.totalValetManagers}
            icon={<Users className="h-4 w-4 text-blue-600" />}
            accent="bg-blue-50"
          />
          <StatCard
            label="Online Now"
            value={stats.onlineValetManagers}
            icon={<Wifi className="h-4 w-4 text-green-600" />}
            accent="bg-green-50"
          />
          <StatCard
            label="Active Vehicles"
            value={stats.activeVehicles}
            icon={<Car className="h-4 w-4 text-amber-600" />}
            accent="bg-amber-50"
          />
          <StatCard
            label="Delivered Today"
            value={stats.deliveredToday}
            icon={<CheckCircle2 className="h-4 w-4 text-teal-600" />}
            accent="bg-teal-50"
          />
          <StatCard
            label="Free Slots"
            value={`${stats.freeSlots} / ${stats.totalSlots}`}
            icon={<ParkingCircle className="h-4 w-4 text-violet-600" />}
            accent="bg-violet-50"
          />
        </div>
      )}

      {/* Daily Activity Report Card */}
      <Card className="p-5 border-zinc-200 shadow-sm max-w-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm text-zinc-900">Export Daily Operations Report</h3>
            <p className="text-xs text-zinc-400">Download activity summaries for any operational date.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
            <Button
              size="sm"
              onClick={() => handleDownloadReport('pdf')}
              className="bg-[#D4AF37] hover:bg-[#AE963C] text-white text-xs h-9 px-4 font-semibold"
            >
              PDF
            </Button>
            <Button
              size="sm"
              onClick={() => handleDownloadReport('xlsx')}
              className="bg-zinc-800 hover:bg-zinc-900 text-white text-xs h-9 px-4 font-semibold"
            >
              Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Managers Table & Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Managers Table (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {/* Search — full width on mobile */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="valet-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, ID…"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
              {/* Two filter selects side-by-side */}
              <div className="flex gap-2">
                <select
                  id="valet-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value="all">All</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
                <select
                  id="valet-active-filter"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
                  className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden">
            {managersLoading ? (
              <CenteredSpinner label="Loading valet managers…" />
            ) : managers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Car className="h-10 w-10 text-zinc-300" />
                <p className="text-base font-semibold text-zinc-700">No valet managers found</p>
                <p className="text-sm text-zinc-400">Create the first one to get started</p>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full text-left text-sm table-fixed">
                  <colgroup>
                    <col />
                    <col className="hidden sm:table-column w-28" />
                    <col className="w-20" />
                  </colgroup>
                  <thead className="border-b bg-zinc-50">
                    <tr className="text-xs uppercase tracking-wide text-zinc-400">
                      <th className="px-3 py-3">Manager</th>
                      <th className="px-3 py-3 hidden sm:table-cell">Status</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {managers.map((m) => (
                      <tr key={m._id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-3 py-3 min-w-0">
                          <div className="flex items-center gap-2.5">
                            {/* Avatar */}
                            <div className="relative h-9 w-9 shrink-0">
                              {m.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.avatarUrl} alt={m.name} className="h-9 w-9 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              {/* Online dot */}
                              <span
                                className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white ${
                                  m.isOnline ? 'bg-green-500' : 'bg-zinc-300'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-zinc-900 truncate">{m.name}</p>
                              <p className="text-xs text-zinc-400 truncate">{m.email}</p>
                              {/* Status badge visible ONLY on mobile (hidden on sm+) */}
                              <div className="flex gap-1 mt-0.5 sm:hidden">
                                <Badge className={m.isOnline ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                                  {m.isOnline ? 'Online' : 'Offline'}
                                </Badge>
                                {!m.isActive && <Badge className="bg-red-100 text-red-600">Disabled</Badge>}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Status column — hidden on mobile, shown sm+ */}
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <div className="flex flex-col gap-1">
                            <Badge className={m.isOnline ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}>
                              <span className="flex items-center gap-1">
                                {m.isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                {m.isOnline ? 'Online' : 'Offline'}
                              </span>
                            </Badge>
                            {!m.isActive && (
                              <Badge className="bg-red-100 text-red-600">Disabled</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              id={`edit-valet-${m._id}`}
                              onClick={() => setEditTarget(m)}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              id={`reset-valet-${m._id}`}
                              onClick={() => { setResetTarget(m); setResetConfirmed(false); setResetError(''); }}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                              title="Reset password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {managersData?.meta && (
              <div className="border-t px-4 py-2 text-xs text-zinc-400">
                {managersData.meta.total} manager{managersData.meta.total !== 1 ? 's' : ''} total
              </div>
            )}
          </Card>
        </div>

        {/* Activity Feed (1/3 width) */}
        <ActivityFeed />
      </div>

      {/* ── Modals ── */}

      {/* Create */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Add Valet Manager">
        <CreateManagerModal onClose={() => setCreateOpen(false)} />
      </Dialog>

      {/* Manage Slots */}
      <Dialog open={slotsOpen} onClose={() => setSlotsOpen(false)} title="Manage Parking Slots">
        <ManageSlotsModal onClose={() => setSlotsOpen(false)} />
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Valet Manager">
        {editTarget && (
          <EditManagerModal manager={editTarget} onClose={() => setEditTarget(null)} />
        )}
      </Dialog>

      {/* Reset Password Confirmation */}
      <Dialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset Password"
      >
        {resetTarget && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Reset the password for <strong>{resetTarget.name}</strong> back to{' '}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm">Valet123!</code>?
            </p>
            {resetError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{resetError}</div>
            )}
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer select-none">
              <input
                id="reset-confirm-checkbox"
                type="checkbox"
                checked={resetConfirmed}
                onChange={(e) => setResetConfirmed(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              I understand this will override their current password
            </label>
            <div className="flex gap-3">
              <Button
                id="reset-password-confirm-btn"
                variant="destructive"
                className="flex-1 flex items-center gap-2"
                disabled={!resetConfirmed || resetMutation.isPending}
                onClick={handleResetPassword}
              >
                <RotateCcw className="h-4 w-4" />
                {resetMutation.isPending ? 'Resetting…' : 'Reset Password'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setResetTarget(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Online Status Legend */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <CircleDot className="h-3.5 w-3.5 text-green-500" />
            <span>Green dot = currently online (logged in to Valet Dashboard)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CircleDot className="h-3.5 w-3.5 text-zinc-300" />
            <span>Grey dot = offline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-amber-500" />
            <span>Resets password to <code>Valet123!</code></span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ValetManagementPage() {
  return (
    <AdminShell>
      <ValetManagementContent />
    </AdminShell>
  );
}
