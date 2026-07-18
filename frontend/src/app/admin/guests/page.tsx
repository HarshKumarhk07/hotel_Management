'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Car,
  Clock,
  History,
  Mail,
  MapPin,
  Phone,
  Search,
  User,
  Utensils,
  ChevronRight,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Card, CenteredSpinner } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { Badge } from '@/components/ui/primitives';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GuestProfile {
  name: string;
  email?: string;
  phone?: string;
  userId?: string;
}

interface GuestHistory {
  orders: any[];
  vehicles: any[];
  reservations: any[];
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function GuestManagementPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GuestProfile | null>(null);

  // Fetch guest search results
  const { data: searchData, isLoading: searching } = useQuery<{ data: { guests: GuestProfile[] } }>({
    queryKey: ['guests-search', search],
    queryFn: () => api.get(`/guests?q=${encodeURIComponent(search)}`).then(r => r.data),
    enabled: true,
  });
  const guests = searchData?.data?.guests ?? [];

  // Fetch selected guest history details
  const { data: historyData, isLoading: loadingHistory } = useQuery<{ data: GuestHistory }>({
    queryKey: ['guest-history', selected?.userId, selected?.email, selected?.phone],
    queryFn: () => {
      const p = new URLSearchParams();
      if (selected?.userId) p.set('userId', selected.userId);
      if (selected?.email) p.set('email', selected.email);
      if (selected?.phone) p.set('phone', selected.phone);
      if (selected?.name) p.set('name', selected.name);
      return api.get(`/guests/details?${p}`).then(r => r.data);
    },
    enabled: !!selected,
  });
  const history = historyData?.data;

  // Render combined timeline
  const getTimeline = () => {
    if (!history) return [];
    const items: { date: Date; type: string; title: string; desc: string; amount?: number; badge?: string }[] = [];

    history.orders.forEach((o: any) => {
      items.push({
        date: new Date(o.createdAt),
        type: 'order',
        title: `Food Order ${o.orderNumber}`,
        desc: `${o.items.map((i: any) => `${i.name} x${i.quantity}`).join(', ')}`,
        amount: o.pricing.total,
        badge: o.status,
      });
    });

    history.vehicles.forEach((v: any) => {
      items.push({
        date: new Date(v.checkedInAt),
        type: 'valet',
        title: `Valet Ticket ${v.carNumber}`,
        desc: `${v.brand} ${v.model} (${v.color}) · Slot ${v.parkingSlot}`,
        badge: v.status,
      });
    });

    history.reservations.forEach((r: any) => {
      items.push({
        date: new Date(r.scheduledAt),
        type: 'reservation',
        title: 'Table Reservation',
        desc: `${r.table ? `Table ${r.table.number}` : 'Restaurant Table'} · ${r.partySize} guests · ${r.durationMins} mins`,
        badge: r.status,
      });
    });

    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const timeline = getTimeline();

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Guest Profiles</h1>
          <p className="text-sm text-zinc-500 mt-0.5">View and search guest profiles & guest interactions</p>
        </div>

        {/* Layout */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Search column */}
          <div className="md:col-span-1 space-y-4">
            <Card className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search name, email, phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                />
              </div>

              {searching ? (
                <CenteredSpinner />
              ) : guests.length === 0 ? (
                <p className="text-center py-6 text-sm text-zinc-400">No guests found</p>
              ) : (
                <div className="divide-y max-h-[60vh] overflow-y-auto pr-1">
                  {guests.map((g, i) => {
                    const isSelected = selected && (selected.phone === g.phone && selected.email === g.email && selected.name === g.name);
                    return (
                      <button
                        key={i}
                        onClick={() => setSelected(g)}
                        className={`w-full text-left py-2.5 px-3 rounded-xl transition-all flex items-center justify-between ${
                          isSelected ? 'bg-brand/5 border border-brand/20 text-brand' : 'hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{g.name}</p>
                          <p className="text-xs text-zinc-400 truncate">{g.email || g.phone || 'Guest'}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Details & Timeline column */}
          <div className="md:col-span-2">
            {selected ? (
              <div className="space-y-4">
                {/* Guest Card */}
                <Card className="p-5 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-xl font-bold text-zinc-900">{selected.name}</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
                      {selected.email && (
                        <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {selected.email}</span>
                      )}
                      {selected.phone && (
                        <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {selected.phone}</span>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Timeline */}
                <Card className="p-5">
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2 mb-4">
                    <History className="h-4 w-4 text-zinc-400" /> Guest History & Timeline
                  </h3>

                  {loadingHistory ? (
                    <CenteredSpinner />
                  ) : timeline.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-400">No history found for this guest.</p>
                  ) : (
                    <div className="relative border-l border-zinc-200 ml-4 pl-6 space-y-6">
                      {timeline.map((item, idx) => (
                        <div key={idx} className="relative">
                          {/* Dot / Icon */}
                          <span className="absolute -left-[35px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 border-zinc-200">
                            {item.type === 'order' && <Utensils className="h-3 w-3 text-zinc-500" />}
                            {item.type === 'valet' && <Car className="h-3 w-3 text-zinc-500" />}
                            {item.type === 'reservation' && <CalendarDays className="h-3 w-3 text-zinc-500" />}
                          </span>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                            <div>
                              <p className="text-sm font-semibold text-zinc-800">{item.title}</p>
                              <p className="text-xs text-zinc-400">{item.desc}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.amount !== undefined && (
                                <span className="text-sm font-bold text-zinc-950">{formatINR(item.amount)}</span>
                              )}
                              {item.badge && (
                                <Badge>{item.badge}</Badge>
                              )}
                              <span className="text-xs text-zinc-400 shrink-0">
                                {item.date.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            ) : (
              <Card className="py-20 text-center">
                <User className="mx-auto h-12 w-12 text-zinc-300 mb-3" />
                <p className="text-zinc-500 font-medium">Select a guest</p>
                <p className="text-sm text-zinc-400 mt-1">Search and select a guest from the left sidebar to view their profile details.</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
