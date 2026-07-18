'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, BarChart3, DoorOpen, Car, UtensilsCrossed } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { KitchenSelect } from '@/components/admin/KitchenSelect';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, Badge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { downloadAuthed } from '@/lib/download';
import { formatINR } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Dashboard {
  summary: {
    revenue: number;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    avgOrderValue: number;
    refundedAmount: number;
  };
  revenueTrends: { period: string; revenue: number; orders: number }[];
  topItems: { name: string; quantitySold: number; revenue: number }[];
  leastItems: { name: string; quantitySold: number; revenue: number }[];
  peakHours: { hour: number; orders: number }[];
  refunds: { status: string; count: number; amount: number }[];
  roomOccupancy: { total: number; occupied: number };
  tableOccupancy: { total: number; occupied: number };
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

// ── Simple bar chart component ──────────────────────────────────────────────────

function BarChart({ data, color = 'bg-brand' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="py-8 text-center text-sm text-zinc-400">No data</p>;
  return (
    <div className="flex h-44 items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.value}`}>
          <div className="flex w-full flex-1 items-end">
            <div className={`w-full rounded-t ${color}`} style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="truncate text-[9px] text-zinc-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────────

function AnalyticsInner() {
  const [kitchen, setKitchen] = useState('');
  const qs = kitchen ? `?kitchen=${kitchen}` : '';

  // Main analytics dashboard query
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard', kitchen],
    queryFn: async () => {
      const res = await api.get<{ data: Dashboard }>(`/analytics/dashboard${qs}`);
      return res.data.data;
    },
  });

  // Valet stats query
  const { data: valetStats, isLoading: loadingValet } = useQuery({
    queryKey: ['valet-stats-analytics'],
    queryFn: async () => {
      const res = await api.get<{ data: ValetStats }>('/valet/admin/stats');
      return res.data.data;
    },
  });

  const exportReport = (format: 'csv' | 'xlsx' | 'pdf', report: 'orders' | 'summary' | 'top-items') => {
    const params = new URLSearchParams({ format, report });
    if (kitchen) params.set('kitchen', kitchen);
    void downloadAuthed(`/analytics/export?${params}`, `${report}-report.${format}`);
  };

  const getOccupancyPercent = (occupied: number, total: number) => {
    if (!total) return 0;
    return Math.round((occupied / total) * 100);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Analytics</h1>
        <div className="flex flex-wrap items-center gap-2">
          <KitchenSelect value={kitchen} onChange={setKitchen} allowAll />
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => exportReport('csv', 'orders')}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReport('xlsx', 'orders')}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReport('pdf', 'summary')}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {isLoading || !data ? (
        <CenteredSpinner />
      ) : (
        <div className="space-y-6">
          {/* Key Metric cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total Revenue" value={formatINR(data.summary.revenue)} />
            <Stat label="Total Orders" value={String(data.summary.totalOrders)} />
            <Stat label="Avg Order Value" value={formatINR(data.summary.avgOrderValue)} />
            <Stat label="Refunded Amount" value={formatINR(data.summary.refundedAmount)} />
          </div>

          {/* Occupancy metrics row */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Room Occupancy */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-zinc-700">Room Occupancy</h2>
                  <DoorOpen className="h-5 w-5 text-zinc-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-extrabold text-zinc-900">
                    {getOccupancyPercent(data.roomOccupancy.occupied, data.roomOccupancy.total)}%
                  </p>
                  <p className="text-xs text-zinc-500">
                    ({data.roomOccupancy.occupied} / {data.roomOccupancy.total} rooms active)
                  </p>
                </div>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full mt-4 overflow-hidden">
                <div
                  className="bg-brand h-full rounded-full transition-all duration-500"
                  style={{ width: `${getOccupancyPercent(data.roomOccupancy.occupied, data.roomOccupancy.total)}%` }}
                />
              </div>
            </Card>

            {/* Restaurant Table Occupancy */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-zinc-700">Table Occupancy</h2>
                  <UtensilsCrossed className="h-5 w-5 text-zinc-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-extrabold text-zinc-900">
                    {getOccupancyPercent(data.tableOccupancy.occupied, data.tableOccupancy.total)}%
                  </p>
                  <p className="text-xs text-zinc-500">
                    ({data.tableOccupancy.occupied} / {data.tableOccupancy.total} tables seated)
                  </p>
                </div>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full mt-4 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${getOccupancyPercent(data.tableOccupancy.occupied, data.tableOccupancy.total)}%` }}
                />
              </div>
            </Card>

            {/* Valet Parking Occupancy */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-zinc-700">Valet Slot Occupancy</h2>
                  <Car className="h-5 w-5 text-zinc-400" />
                </div>
                {loadingValet || !valetStats ? (
                  <CenteredSpinner />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-extrabold text-zinc-900">
                      {getOccupancyPercent(valetStats.occupiedSlots, valetStats.totalSlots)}%
                    </p>
                    <p className="text-xs text-zinc-500">
                      ({valetStats.occupiedSlots} / {valetStats.totalSlots} slots occupied)
                    </p>
                  </div>
                )}
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full mt-4 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      valetStats
                        ? getOccupancyPercent(valetStats.occupiedSlots, valetStats.totalSlots)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-bold text-zinc-700">Revenue trend</h2>
              <BarChart data={data.revenueTrends.map((t) => ({ label: t.period.slice(5), value: t.revenue }))} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-bold text-zinc-700">Orders by hour</h2>
              <BarChart
                data={data.peakHours.map((h) => ({ label: `${h.hour}`, value: h.orders }))}
                color="bg-blue-500"
              />
            </Card>
          </div>

          {/* Item Lists Row */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Best Sellers */}
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-bold text-zinc-700 flex items-center justify-between">
                <span>Best Sellers</span>
                <Badge className="bg-green-50 text-green-700 border-green-200">Top Popular</Badge>
              </h2>
              <ul className="space-y-2">
                {data.topItems.length === 0 ? (
                  <li className="text-sm text-zinc-400">No sales yet</li>
                ) : (
                  data.topItems.map((it, i) => (
                    <li key={i} className="flex items-center justify-between text-sm py-1 border-b border-zinc-50 last:border-0">
                      <span className="text-zinc-700 font-medium">
                        {i + 1}. {it.name}
                      </span>
                      <span className="text-zinc-500">
                        {it.quantitySold} sold · <span className="font-semibold text-zinc-900">{formatINR(it.revenue)}</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Card>

            {/* Least Selling (Menu Management Insight) */}
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-bold text-zinc-700 flex items-center justify-between">
                <span>Under-performing Items</span>
                <Badge className="bg-red-50 text-red-700 border-red-200">Low Sales</Badge>
              </h2>
              <ul className="space-y-2">
                {data.leastItems.length === 0 ? (
                  <li className="text-sm text-zinc-400">No underperforming items</li>
                ) : (
                  data.leastItems.map((it, i) => (
                    <li key={i} className="flex items-center justify-between text-sm py-1 border-b border-zinc-50 last:border-0">
                      <span className="text-zinc-700 font-medium">
                        {i + 1}. {it.name}
                      </span>
                      <span className="text-zinc-500">
                        {it.quantitySold} sold · <span className="font-semibold text-zinc-900">{formatINR(it.revenue)}</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
    </Card>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <AdminShell>
      <AnalyticsInner />
    </AdminShell>
  );
}