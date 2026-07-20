'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Plus, UserX, X } from 'lucide-react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Reservation {
  _id: string;
  guestName: string;
  phone: string;
  email?: string;
  partySize: number;
  scheduledAt: string;
  durationMins: number;
  status: string;
  notes?: string;
  cancelReason?: string;
  table?: { _id: string; number: string; section?: string; capacity: number };
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  tableId:     z.string().min(1, 'Table required'),
  guestName:   z.string().trim().min(1, 'Guest name required'),
  phone:       z.string().trim().min(1, 'Phone required'),
  email:       z.string().email().optional().or(z.literal('')),
  partySize:   z.coerce.number().int().min(1),
  scheduledAt: z.string().min(1, 'Date & time required'),
  durationMins:z.coerce.number().int().min(30).default(90),
  notes:       z.string().trim().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  SEATED:    'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-zinc-100 text-zinc-600',
  NO_SHOW:   'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-50 text-red-400',
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');

  // Tables for create form
  const { data: tableData } = useQuery<{ data: { items: { _id: string; number: string; section?: string; capacity: number }[] } }>({
    queryKey: ['restaurant-tables-all'],
    queryFn: () => api.get('/restaurant/tables?limit=200').then(r => r.data),
  });
  const tables = tableData?.data?.items ?? [];

  // Reservations
  const { data, isLoading, refetch } = useQuery<{ data: { items: Reservation[]; meta: { total: number } } }>({
    queryKey: ['reservations', date],
    queryFn: () => api.get(`/restaurant/reservations?date=${date}&limit=100`).then(r => r.data),
  });
  const reservations = data?.data?.items ?? [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => {
      const payload = {
        ...d,
        scheduledAt: new Date(d.scheduledAt).toISOString(),
      };
      return api.post('/restaurant/reservations', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations'] }); setShowCreate(false); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, cancelReason }: { id: string; status: string; cancelReason?: string }) =>
      api.patch(`/restaurant/reservations/${id}`, { status, cancelReason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
    onError: e => setError(apiErrorMessage(e)),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { durationMins: 90 },
  });

  const grouped = {
    upcoming:  reservations.filter(r => ['PENDING', 'CONFIRMED'].includes(r.status)),
    active:    reservations.filter(r => r.status === 'SEATED'),
    past:      reservations.filter(r => ['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(r.status)),
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/restaurant">
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-zinc-50">
                <ArrowLeft className="h-4 w-4" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Reservations</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {date ? `${reservations.length} reservations for ${date}` : `${reservations.length} total reservations (All Dates)`}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => { setShowCreate(true); reset(); }}>
            <Plus className="h-4 w-4 mr-1.5" /> New Reservation
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Date filter */}
        <div className="flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-zinc-400" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {date ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDate('')}
              className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 h-8"
            >
              Show All Dates
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDate(new Date().toISOString().split('T')[0])}
              className="text-xs text-zinc-500 hover:text-zinc-700 h-8"
            >
              Show Today Only
            </Button>
          )}
          <button onClick={() => refetch()} className="text-sm text-zinc-400 hover:text-zinc-700 ml-auto">Refresh</button>
        </div>

        {isLoading ? <CenteredSpinner /> : (
          <div className="space-y-6">
            {/* Active / Seated */}
            {grouped.active.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-600 mb-3">Currently Seated</h2>
                <ReservationList
                  items={grouped.active}
                  onConfirm={null}
                  onCancel={r => { setCancelTarget(r); setCancelReason(''); }}
                  onNoShow={null}
                  onComplete={r => updateMutation.mutate({ id: r._id, status: 'COMPLETED' })}
                />
              </section>
            )}

            {/* Upcoming */}
            {grouped.upcoming.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">Upcoming</h2>
                <ReservationList
                  items={grouped.upcoming}
                  onConfirm={r => updateMutation.mutate({ id: r._id, status: 'CONFIRMED' })}
                  onCancel={r => { setCancelTarget(r); setCancelReason(''); }}
                  onNoShow={r => updateMutation.mutate({ id: r._id, status: 'NO_SHOW' })}
                  onComplete={null}
                />
              </section>
            )}

            {/* Past */}
            {grouped.past.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">Past</h2>
                <ReservationList
                  items={grouped.past}
                  onConfirm={null}
                  onCancel={null}
                  onNoShow={null}
                  onComplete={null}
                />
              </section>
            )}

            {reservations.length === 0 && (
              <Card className="py-16 text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
                <p className="text-zinc-500 font-medium">No reservations for this date</p>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Create Reservation Modal */}
      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} title="New Reservation">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <Field label="Table *">
              <select
                {...register('tableId')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Select table…</option>
                {tables.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.number}{t.section ? ` (${t.section})` : ''} — {t.capacity} seats
                  </option>
                ))}
              </select>
              <FieldError message={errors.tableId?.message} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Guest Name *">
                <Input {...register('guestName')} placeholder="Full name" />
                <FieldError message={errors.guestName?.message} />
              </Field>
              <Field label="Phone *">
                <Input {...register('phone')} placeholder="Mobile number" />
                <FieldError message={errors.phone?.message} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Party Size *">
                <Input type="number" min={1} {...register('partySize')} />
                <FieldError message={errors.partySize?.message} />
              </Field>
              <Field label="Duration (min)">
                <Input type="number" min={30} {...register('durationMins')} />
              </Field>
            </div>
            <Field label="Date & Time *">
              <Input type="datetime-local" {...register('scheduledAt')} />
              <FieldError message={errors.scheduledAt?.message} />
            </Field>
            <Field label="Notes">
              <Input {...register('notes')} placeholder="Special requirements…" />
            </Field>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Reservation'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Cancel Reason Modal */}
      {cancelTarget && (
        <Dialog open onClose={() => setCancelTarget(null)} title="Cancel Reservation">
          <p className="text-sm text-zinc-600 mb-4">
            Cancelling reservation for <span className="font-semibold">{cancelTarget.guestName}</span>
          </p>
          <Field label="Reason *">
            <Input
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Guest request, no show, overbooking…"
            />
          </Field>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setCancelTarget(null)}>Back</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={!cancelReason.trim() || updateMutation.isPending}
              onClick={() => {
                updateMutation.mutate(
                  { id: cancelTarget._id, status: 'CANCELLED', cancelReason },
                  { onSuccess: () => setCancelTarget(null) },
                );
              }}
            >
              Confirm Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </AdminShell>
  );
}

// ── Reservation List Component ─────────────────────────────────────────────────

function ReservationList({
  items,
  onConfirm,
  onCancel,
  onNoShow,
  onComplete,
}: {
  items: Reservation[];
  onConfirm: ((r: Reservation) => void) | null;
  onCancel: ((r: Reservation) => void) | null;
  onNoShow: ((r: Reservation) => void) | null;
  onComplete: ((r: Reservation) => void) | null;
}) {
  return (
    <div className="space-y-2">
      {items.map(r => (
        <Card key={r._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-zinc-900">{r.guestName}</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {r.status}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {r.table ? `Table ${r.table.number}${r.table.section ? ` · ${r.table.section}` : ''}` : '—'}
              {' · '}{r.partySize} guests · {r.phone}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(r.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' — '}{r.durationMins}min
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onConfirm && r.status === 'PENDING' && (
              <Button size="sm" variant="outline" onClick={() => onConfirm(r)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm
              </Button>
            )}
            {onComplete && (
              <Button size="sm" variant="outline" onClick={() => onComplete(r)}>Complete</Button>
            )}
            {onNoShow && (
              <Button size="sm" variant="outline" onClick={() => onNoShow(r)}>
                <UserX className="h-3.5 w-3.5 mr-1" /> No-Show
              </Button>
            )}
            {onCancel && (
              <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => onCancel(r)}>
                Cancel
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
