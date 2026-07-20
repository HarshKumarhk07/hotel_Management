'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ChevronRight,
  CircleDot,
  Clock,
  CreditCard,
  Plus,
  QrCode,
  RefreshCw,
  Users,
  UtensilsCrossed,
  X,
  CalendarDays,
  Play,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';
import { useWaitlistQueue, useWaitlistMutations, type WaitlistEntry } from '@/hooks/useWaitlist';

interface RestaurantTable {
  _id: string;
  number: string;
  floor: number;
  section?: string;
  capacity: number;
  isActive: boolean;
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'BILLING' | 'INACTIVE';
  qr: { token: string; isActive: boolean; version: number };
  currentSession?: {
    seatedAt?: string;
    partySize?: number;
    guestName?: string;
    phone?: string;
    notes?: string;
  };
}

// ── Validation Schemas ─────────────────────────────────────────────────────────

const createSchema = z.object({
  number: z.string().min(1, 'Table number is required').max(20),
  floor: z.coerce.number().int().min(0),
  section: z.string().max(60).optional(),
  capacity: z.coerce.number().int().min(1).max(50),
  kitchenId: z.string().regex(/^[a-f\d]{24}$/i, 'Select a kitchen'),
});
type CreateForm = z.infer<typeof createSchema>;

const seatSchema = z.object({
  partySize: z.coerce.number().int().min(1),
  guestName: z.string().max(120).optional(),
  phone: z.string().optional(),
  notes: z.string().max(300).optional(),
});
type SeatForm = z.infer<typeof seatSchema>;

// ── Components ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="flex items-center gap-4 p-4 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-900">{value}</p>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
      </div>
    </Card>
  );
}

function TableCard({
  table,
  onSeat,
  onRequestBill,
  onClose,
  onViewBill,
  onRegen,
}: {
  table: RestaurantTable;
  onSeat: (t: RestaurantTable) => void;
  onRequestBill: (t: RestaurantTable) => void;
  onClose: (t: RestaurantTable) => void;
  onViewBill: (t: RestaurantTable) => void;
  onRegen: (t: RestaurantTable) => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'RESERVED':  return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'OCCUPIED':  return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'BILLING':   return 'bg-purple-100 text-purple-700 border-purple-200';
      default:          return 'bg-zinc-200 text-zinc-600 border-zinc-300';
    }
  };

  return (
    <Card className="p-4 flex flex-col justify-between border-[#ECECEC] hover:shadow-lg transition-all duration-300">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg text-zinc-900">Table {table.number}</h3>
            <p className="text-xs text-zinc-500">Floor {table.floor} · Max {table.capacity} guests</p>
          </div>
          <Badge className={getStatusColor(table.status)}>{table.status}</Badge>
        </div>

        {table.status === 'OCCUPIED' && (
          <div className="rounded-lg bg-amber-50/50 p-2.5 text-xs text-zinc-700 border border-amber-100/50 space-y-1">
            <p className="font-semibold text-amber-800">Active Seating Session</p>
            {table.currentSession?.guestName && <p><b>Guest:</b> {table.currentSession.guestName}</p>}
            {table.currentSession?.partySize && <p><b>Party size:</b> {table.currentSession.partySize} guests</p>}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#ECECEC] flex flex-wrap gap-2 justify-end">
        {table.status === 'AVAILABLE' && (
          <Button size="sm" onClick={() => onSeat(table)} className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
            Seat Guests
          </Button>
        )}
        {table.status === 'OCCUPIED' && (
          <>
            <Button size="sm" variant="outline" onClick={() => onRequestBill(table)} className="text-purple-700 hover:bg-purple-50">
              Request Bill
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSeat(table)}>
              Edit Session
            </Button>
          </>
        )}
        {table.status === 'BILLING' && (
          <>
            <Button size="sm" variant="outline" onClick={() => onViewBill(table)}>
              View Bill
            </Button>
            <Button size="sm" className="bg-zinc-800 hover:bg-zinc-900" onClick={() => onClose(table)}>
              Close Table
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          title="Regenerate table QR code"
          onClick={() => onRegen(table)}
          className="text-zinc-400 hover:text-zinc-600"
        >
          <QrCode className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

// ── Bill Modal ─────────────────────────────────────────────────────────────────

interface BillData {
  grandTotal: number;
  orders: {
    _id: string;
    orderNumber: string;
    status: string;
    pricing: { total: number };
  }[];
}

function BillModal({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ data: BillData }>({
    queryKey: ['table-bill', tableId],
    queryFn: () => api.get(`/restaurant/tables/${tableId}/bill`).then(r => r.data),
  });

  const bill = data?.data;

  return (
    <Dialog open onClose={onClose} title="Table Bill">
      {isLoading ? <CenteredSpinner /> : bill ? (
        <div className="space-y-4">
          {bill.orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <UtensilsCrossed className="h-10 w-10 text-zinc-300" />
              <p className="font-semibold text-zinc-600">No orders this session</p>
              <p className="text-xs text-zinc-400">Guests haven&apos;t placed any orders from the table QR code yet.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-500">{bill.orders.length} order(s) this session</p>
              <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
                {bill.orders.map(o => (
                  <div key={o._id} className="flex items-center justify-between px-4 py-3 text-sm bg-white hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">{o.orderNumber}</span>
                      <Badge className={o.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>{o.status}</Badge>
                    </div>
                    <span className="font-bold text-zinc-900">₹{o.pricing.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex items-center justify-between rounded-xl bg-zinc-900 text-white px-5 py-4">
            <span className="font-semibold text-zinc-300">Grand Total</span>
            <span className="text-2xl font-bold">₹{bill.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RestaurantPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const status = useAuthStore(s => s.status);

  const [showCreate, setShowCreate] = useState(false);
  const [seatTarget, setSeatTarget] = useState<RestaurantTable | null>(null);
  const [seatWaitlistTarget, setSeatWaitlistTarget] = useState<WaitlistEntry | null>(null);
  const [billTarget, setBillTarget] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [error, setError] = useState('');

  // Waitlist data queries & mutations
  const { data: waitlistQueue, isLoading: waitlistLoading } = useWaitlistQueue('PENDING');
  const { seat: seatWaitlistMutation, cancel: cancelWaitlistMutation, autoAssign } = useWaitlistMutations();

  // Live table status & waitlist via socket
  useEffect(() => {
    if (status !== 'authenticated') return;
    const socket = getSocket();
    
    const handler = () => qc.invalidateQueries({ queryKey: ['restaurant-tables'] });
    const waitlistHandler = () => qc.invalidateQueries({ queryKey: ['restaurant-waitlist'] });
    
    socket.on('table:status', handler);
    socket.on('waitlist:updated', waitlistHandler);
    
    return () => {
      socket.off('table:status', handler);
      socket.off('waitlist:updated', waitlistHandler);
    };
  }, [status, qc]);

  // Fetch kitchens for create form
  const { data: kitchenData } = useQuery<{ data: { kitchens: { _id: string; name: string }[] } }>({
    queryKey: ['kitchens-list'],
    queryFn: () => api.get('/kitchens?limit=100').then(r => r.data),
  });
  const kitchens = kitchenData?.data?.kitchens ?? [];

  // Fetch tables
  const { data: tableData, isLoading } = useQuery<{ data: { items: RestaurantTable[]; meta: { total: number } } }>({
    queryKey: ['restaurant-tables', sectionFilter, floorFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (sectionFilter) params.set('section', sectionFilter);
      if (floorFilter) params.set('floor', floorFilter);
      return api.get(`/restaurant/tables?${params}`).then(r => r.data);
    },
    refetchInterval: 30_000,
  });
  const tables = tableData?.data?.items ?? [];

  // Counts
  const counts = {
    available: tables.filter(t => t.status === 'AVAILABLE').length,
    reserved:  tables.filter(t => t.status === 'RESERVED').length,
    occupied:  tables.filter(t => t.status === 'OCCUPIED').length,
    billing:   tables.filter(t => t.status === 'BILLING').length,
  };

  // Sections for grouping
  const sections = [...new Set(tables.map(t => t.section ?? 'Main Hall'))];

  // Table Seating Mutations
  const seatMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SeatForm }) =>
      api.post(`/restaurant/tables/${id}/seat`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant-tables'] }); setSeatTarget(null); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const requestBillMutation = useMutation({
    mutationFn: ({ id, billAmount }: { id: string; billAmount?: number }) =>
      api.post(`/restaurant/tables/${id}/request-bill`, { billAmount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] });
      setError('');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/restaurant/tables/${id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant-tables'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const regenMutation = useMutation({
    mutationFn: (id: string) => api.post(`/restaurant/tables/${id}/qr`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant-tables'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => api.post('/restaurant/tables', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant-tables'] }); setShowCreate(false); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  // Create form
  const {
    register: regCreate,
    handleSubmit: handleCreate,
    formState: { errors: createErrors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { floor: 0 } });

  // Seat form
  const {
    register: regSeat,
    handleSubmit: handleSeat,
    formState: { errors: seatErrors },
    reset: resetSeat,
  } = useForm<SeatForm>({ resolver: zodResolver(seatSchema) });

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Restaurant & Seating</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Manage fine dining tables, active waitlists, and live reservations.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/restaurant/reservations">
              <Button variant="outline" size="sm">
                <CalendarDays className="h-4 w-4 mr-1.5" /> Reservations
              </Button>
            </Link>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Table
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Two column layout: main map on left, waitlist queue sidebar on right */}
        <div className="grid gap-6 lg:grid-cols-4">
          
          {/* LEFT 3 COLUMNS: Table map */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Available" value={counts.available} icon={<CircleDot className="h-5 w-5 text-emerald-600" />} color="bg-emerald-50" />
              <KpiCard label="Reserved" value={counts.reserved} icon={<CalendarDays className="h-5 w-5 text-blue-600" />} color="bg-blue-50" />
              <KpiCard label="Occupied" value={counts.occupied} icon={<Users className="h-5 w-5 text-amber-600" />} color="bg-amber-50" />
              <KpiCard label="Billing" value={counts.billing} icon={<CreditCard className="h-5 w-5 text-purple-600" />} color="bg-purple-50" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <input
                className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Filter section..."
                value={sectionFilter}
                onChange={e => setSectionFilter(e.target.value)}
              />
              <input
                className="h-8 w-24 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Floor..."
                type="number"
                min={0}
                value={floorFilter}
                onChange={e => setFloorFilter(e.target.value)}
              />
              {(sectionFilter || floorFilter) && (
                <button
                  onClick={() => { setSectionFilter(''); setFloorFilter(''); }}
                  className="h-8 px-3 text-sm text-zinc-500 hover:text-zinc-800"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Tables grid grouped by section */}
            {isLoading ? (
              <CenteredSpinner />
            ) : tables.length === 0 ? (
              <Card className="py-16 text-center">
                <UtensilsCrossed className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
                <p className="text-zinc-500 font-medium">No tables yet</p>
                <p className="text-sm text-zinc-400 mt-1">Add your first table to get started.</p>
                <Button className="mt-4" size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Table
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {sections.map(section => {
                  const sectionTables = tables.filter(t => (t.section ?? 'Main Hall') === section);
                  if (!sectionTables.length) return null;
                  return (
                    <div key={section}>
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">{section}</h2>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {sectionTables.map(t => (
                          <TableCard
                            key={t._id}
                            table={t}
                            onSeat={(tbl) => { setSeatTarget(tbl); resetSeat(); }}
                            onRequestBill={(tbl) => {
                              const amt = prompt(`Enter final bill amount for Table ${tbl.number} (optional):`);
                              if (amt === null) return;
                              const billAmount = amt.trim() ? parseFloat(amt) : undefined;
                              if (billAmount !== undefined && isNaN(billAmount)) {
                                alert("Invalid amount entered");
                                return;
                              }
                              requestBillMutation.mutate({ id: tbl._id, billAmount });
                            }}
                            onClose={(tbl) => {
                              if (confirm(`Close table ${tbl.number} and mark all TABLE_BILLING orders as paid?`)) {
                                closeMutation.mutate(tbl._id);
                              }
                            }}
                            onViewBill={(tbl) => setBillTarget(tbl._id)}
                            onRegen={(tbl) => {
                              if (confirm('Regenerate QR? The old QR code will stop working.')) {
                                regenMutation.mutate(tbl._id);
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 1 COLUMN: Guest Waitlist Queue */}
          <div className="lg:col-span-1 border-l border-zinc-200 pl-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-bold text-lg text-zinc-900">Waitlist Queue</h2>
                <p className="text-[11px] text-zinc-400">Manage waiting guests in queue</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-[#D4AF37] text-[#D4AF37] hover:bg-[#FAF8F0]"
                onClick={() => autoAssign.mutate()}
                disabled={autoAssign.isPending || !waitlistQueue || waitlistQueue.length === 0}
              >
                <Play className="h-3 w-3 mr-1" /> Auto-Assign
              </Button>
            </div>

            {waitlistLoading ? (
              <div className="flex py-10 justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>
            ) : !waitlistQueue || waitlistQueue.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400">
                <Users className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                No guests in queue.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {waitlistQueue.map((guest) => (
                  <Card key={guest._id} className="p-3.5 space-y-2.5 border-zinc-200 hover:border-[#D4AF37]/50 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-zinc-900">{guest.guestName}</span>
                          <Badge className="bg-[#FAF8F0] text-[#D4AF37] border-none text-[10px] px-1.5 py-0.5">#{guest.position}</Badge>
                        </div>
                        <p className="text-[11px] text-zinc-400">Party of {guest.guestsCount} · Est. {guest.position * 10} mins</p>
                      </div>
                      <span className="text-[10px] font-semibold text-zinc-500">{guest.phone}</span>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        onClick={() => setSeatWaitlistTarget(guest)}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[10px] px-2.5 py-1 h-7"
                      >
                        Seat Group
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remove ${guest.guestName} from waitlist?`)) {
                            cancelWaitlistMutation.mutate(guest._id);
                          }
                        }}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 text-[10px] px-2 h-7"
                        disabled={cancelWaitlistMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Table Modal */}
      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} title="Add Table">
          <form onSubmit={handleCreate(d => createMutation.mutate(d))} className="space-y-4">
            <Field label="Table Number *">
              <Input {...regCreate('number')} placeholder="T-01" />
              <FieldError message={createErrors.number?.message} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Floor">
                <Input type="number" min={0} {...regCreate('floor')} />
              </Field>
              <Field label="Capacity *">
                <Input type="number" min={1} {...regCreate('capacity')} placeholder="4" />
                <FieldError message={createErrors.capacity?.message} />
              </Field>
            </div>
            <Field label="Section">
              <Input {...regCreate('section')} placeholder="Main Hall, Outdoor, Bar…" />
            </Field>
            <Field label="Kitchen *">
              <select
                {...regCreate('kitchenId')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Select kitchen…</option>
                {kitchens.map(k => (
                  <option key={k._id} value={k._id}>{k.name}</option>
                ))}
              </select>
              <FieldError message={createErrors.kitchenId?.message} />
            </Field>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Table'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Seat Guests Modal */}
      {seatTarget && (
        <Dialog open onClose={() => setSeatTarget(null)} title={`Seat Guests — Table ${seatTarget.number}`}>
          <form onSubmit={handleSeat(d => seatMutation.mutate({ id: seatTarget._id, data: d }))} className="space-y-4">
            <Field label="Party Size *">
              <Input type="number" min={1} {...regSeat('partySize')} placeholder={`Max ${seatTarget.capacity}`} />
              <FieldError message={seatErrors.partySize?.message} />
            </Field>
            <Field label="Guest Name">
              <Input {...regSeat('guestName')} placeholder="Optional" />
            </Field>
            <Field label="Phone">
              <Input {...regSeat('phone')} placeholder="Optional" />
            </Field>
            <Field label="Notes">
              <Input {...regSeat('notes')} placeholder="Special requirements…" />
            </Field>
            <Button type="submit" className="w-full" disabled={seatMutation.isPending}>
              {seatMutation.isPending ? 'Seating…' : 'Seat Guests'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Seat Waitlist Guest Modal */}
      {seatWaitlistTarget && (
        <Dialog open onClose={() => setSeatWaitlistTarget(null)} title={`Seat ${seatWaitlistTarget.guestName} (${seatWaitlistTarget.guestsCount} guests)`}>
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">Select an available table with enough capacity to seat this waitlist party.</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {tables.filter(t => t.status === 'AVAILABLE' && t.capacity >= seatWaitlistTarget.guestsCount).length === 0 ? (
                <p className="text-center text-xs text-zinc-400 py-6">No available tables match this party size capacity.</p>
              ) : (
                tables
                  .filter(t => t.status === 'AVAILABLE' && t.capacity >= seatWaitlistTarget.guestsCount)
                  .map(t => (
                    <div key={t._id} className="flex justify-between items-center p-3 border rounded-xl hover:bg-zinc-50">
                      <div>
                        <span className="font-bold text-zinc-900 text-sm">Table {t.number}</span>
                        <span className="text-xs text-zinc-400 block">Floor {t.floor} · Max {t.capacity} guests</span>
                      </div>
                      <Button
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-8"
                        onClick={() => seatWaitlistMutation.mutate({
                          id: seatWaitlistTarget._id,
                          tableId: t._id,
                        }, { onSuccess: () => setSeatWaitlistTarget(null) })}
                        disabled={seatWaitlistMutation.isPending}
                      >
                        Seat Here
                      </Button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* Bill Modal */}
      {billTarget && <BillModal tableId={billTarget} onClose={() => setBillTarget(null)} />}
    </AdminShell>
  );
}
