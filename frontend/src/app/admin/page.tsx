'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  Car,
  CheckCircle2,
  IndianRupee,
  ClipboardList,
  TimerReset,
  Boxes,
  ParkingCircle,
  Wifi,
  Users,
  DoorOpen,
  UtensilsCrossed,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin/AdminShell';
import { Card, CenteredSpinner } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';

interface Summary {
  totalOrders: number;
  revenue: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
  cancellationRate: number;
  refundedAmount: number;
  roomOccupancy?: {
    total: number;
    occupied: number;
  };
  tableOccupancy?: {
    total: number;
    occupied: number;
  };
  liveTableBookings?: number;
  activeValetVehicles?: number;
  pendingBanquetEnquiries?: number;
  revenueBreakdown?: {
    food: number;
    room: number;
    banquet: number;
  };
}

interface ValetStats {
  totalValetManagers: number;
  onlineValetManagers: number;
  activeVehicles: number;
  deliveredToday: number;
  totalSlots: number;
  freeSlots: number;
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
    </Card>
  );
}

function SuperAdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-summary'],
    queryFn: async () => {
      const res = await api.get<{ data: Summary }>('/analytics/summary');
      return res.data.data;
    },
  });

  const { data: valetStats } = useQuery({
    queryKey: ['valet-admin-stats-overview'],
    queryFn: async () => {
      const res = await api.get<{ data: ValetStats }>('/valet/admin/stats');
      return res.data.data;
    },
    staleTime: 30_000,
  });

  return (
    <div className="space-y-8 font-sans">
      {/* Header and Quick Summary */}
      <div className="bg-zinc-900 text-white p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Super Admin Control Center</h1>
          <p className="text-xs text-zinc-400 mt-1">Live hotel metrics, real-time table statuses, and system operations</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/audit">
            <Button variant="outline" size="sm" className="text-white border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs">
              View System Logs
            </Button>
          </Link>
          <Button onClick={() => window.location.reload()} size="sm" className="bg-[#D4AF37] hover:bg-[#c49e27] text-white text-xs font-semibold">
            Refresh Metrics
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <CenteredSpinner label="Loading dashboard metrics..." />
      ) : (
        <div className="space-y-8">
          
          {/* Quick Operations Section */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Quick Operations Shortcuts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Link href="/admin/rooms" className="p-4 border bg-white hover:bg-zinc-50 transition-colors flex flex-col items-center justify-center text-center space-y-2 group">
                <DoorOpen className="h-6 w-6 text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs text-zinc-800">Rooms & QR</span>
              </Link>
              <Link href="/admin/restaurant" className="p-4 border bg-white hover:bg-zinc-50 transition-colors flex flex-col items-center justify-center text-center space-y-2 group">
                <UtensilsCrossed className="h-6 w-6 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs text-zinc-800">Table & Dining</span>
              </Link>
              <Link href="/admin/housekeeping" className="p-4 border bg-white hover:bg-zinc-50 transition-colors flex flex-col items-center justify-center text-center space-y-2 group">
                <Boxes className="h-6 w-6 text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs text-zinc-800">Housekeeping</span>
              </Link>
              <Link href="/admin/valet" className="p-4 border bg-white hover:bg-zinc-50 transition-colors flex flex-col items-center justify-center text-center space-y-2 group">
                <Car className="h-6 w-6 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs text-zinc-800">Valet Logs</span>
              </Link>
              <Link href="/admin/banquets" className="p-4 border bg-white hover:bg-zinc-50 transition-colors flex flex-col items-center justify-center text-center space-y-2 group">
                <Calendar className="h-6 w-6 text-purple-500 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs text-zinc-800">Banquet Booking</span>
              </Link>
            </div>
          </div>

          {/* Real-time Business Overview */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Live Hotel Occupancy</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              
              {/* Room Occupancy Card */}
              <Card className="p-5 flex flex-col justify-between border-l-4 border-l-blue-500 shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Room Occupancy</p>
                    <DoorOpen className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-extrabold text-zinc-900">
                      {data.roomOccupancy ? (data.roomOccupancy.total > 0 ? Math.round((data.roomOccupancy.occupied / data.roomOccupancy.total) * 100) : 0) : 0}%
                    </p>
                    <p className="text-xs text-zinc-500">
                      {data.roomOccupancy ? `${data.roomOccupancy.occupied} / ${data.roomOccupancy.total} rooms active` : '—'}
                    </p>
                  </div>
                </div>
                {data.roomOccupancy && (
                  <div className="w-full bg-zinc-100 h-1.5 mt-4 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-500"
                      style={{ width: `${data.roomOccupancy.total > 0 ? (data.roomOccupancy.occupied / data.roomOccupancy.total) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </Card>

              {/* Restaurant Table Booking Card */}
              <Card className="p-5 flex flex-col justify-between border-l-4 border-l-emerald-500 shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Table Occupancy</p>
                    <UtensilsCrossed className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-extrabold text-zinc-900">
                      {data.tableOccupancy ? (data.tableOccupancy.total > 0 ? Math.round((data.tableOccupancy.occupied / data.tableOccupancy.total) * 100) : 0) : 0}%
                    </p>
                    <p className="text-xs text-zinc-500">
                      {data.tableOccupancy ? `${data.tableOccupancy.occupied} / ${data.tableOccupancy.total} tables seated` : '—'}
                    </p>
                  </div>
                </div>
                {data.tableOccupancy && (
                  <div className="w-full bg-zinc-100 h-1.5 mt-4 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${data.tableOccupancy.total > 0 ? (data.tableOccupancy.occupied / data.tableOccupancy.total) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </Card>

              {/* Active Valet Vehicles Card */}
              <Card className="p-5 flex flex-col justify-between border-l-4 border-l-amber-500 shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Active Valet Vehicles</p>
                    <Car className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-extrabold text-zinc-900">
                      {data.activeValetVehicles ?? 0}
                    </p>
                    <p className="text-xs text-zinc-500">Vehicles parked / requested</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-100">
                  <span>Slots occupied:</span>
                  <span className="font-semibold text-zinc-700">
                    {valetStats ? `${valetStats.totalSlots - valetStats.freeSlots} / ${valetStats.totalSlots}` : '—'}
                  </span>
                </div>
              </Card>

              {/* Pending Banquet Enquiries Card */}
              <Card className="p-5 flex flex-col justify-between border-l-4 border-l-purple-500 shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Banquet Enquiries</p>
                    <Calendar className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-extrabold text-zinc-900">
                      {data.pendingBanquetEnquiries ?? 0}
                    </p>
                    <p className="text-xs text-zinc-500">Awaiting confirmation</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs pt-2 border-t border-zinc-100">
                  <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                    Action Required
                  </span>
                  <span className="text-zinc-400 text-[10px]">
                    Live reservations: {data.liveTableBookings ?? 0}
                  </span>
                </div>
              </Card>
            </div>
          </div>

          {/* Sales & Revenue Summary */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Sales & Revenue Overview</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-2 col-span-1 lg:col-span-1">
                <Stat
                  label="Grand Total Revenue"
                  value={formatINR(data.revenue)}
                  icon={<IndianRupee className="h-5 w-5 text-green-600" />}
                  accent="bg-green-50"
                />
                {data.revenueBreakdown && (
                  <div className="flex flex-col gap-1 text-xs text-zinc-500 bg-white p-3 rounded-xl border border-zinc-100 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1"><UtensilsCrossed className="w-3 h-3 text-orange-500" /> Food & Dining</span>
                      <span className="font-semibold text-zinc-700">{formatINR(data.revenueBreakdown.food)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1"><DoorOpen className="w-3 h-3 text-blue-500" /> Rooms</span>
                      <span className="font-semibold text-zinc-700">{formatINR(data.revenueBreakdown.room)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-purple-500" /> Banquets</span>
                      <span className="font-semibold text-zinc-700">{formatINR(data.revenueBreakdown.banquet)}</span>
                    </div>
                  </div>
                )}
              </div>
              <Stat
                label="Total orders"
                value={String(data.totalOrders)}
                icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
                accent="bg-blue-50"
              />
              <Stat
                label="Pending"
                value={String(data.pendingOrders)}
                icon={<TimerReset className="h-5 w-5 text-amber-600" />}
                accent="bg-amber-50"
              />
              <Stat
                label="Completed"
                value={String(data.completedOrders)}
                icon={<CheckCircle2 className="h-5 w-5 text-teal-600" />}
                accent="bg-teal-50"
              />
              <Stat
                label="Cancelled"
                value={String(data.cancelledOrders)}
                icon={<Ban className="h-5 w-5 text-red-600" />}
                accent="bg-red-50"
              />
              <Stat
                label="Avg order value"
                value={formatINR(data.avgOrderValue)}
                icon={<IndianRupee className="h-5 w-5 text-violet-600" />}
                accent="bg-violet-50"
              />
            </div>
          </div>

        </div>
      )}

      {/* Valet Parking Stats */}
      {valetStats && (
        <div className="space-y-4 pt-4 border-t border-zinc-100">
          <h2 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
            <Car className="h-5 w-5 text-amber-500" /> Valet Parking Details
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Total Managers"
              value={String(valetStats.totalValetManagers)}
              icon={<Users className="h-5 w-5 text-blue-600" />}
              accent="bg-blue-50"
            />
            <Stat
              label="Online Now"
              value={String(valetStats.onlineValetManagers)}
              icon={<Wifi className="h-5 w-5 text-green-600" />}
              accent="bg-green-50"
            />
            <Stat
              label="Active Vehicles"
              value={String(valetStats.activeVehicles)}
              icon={<Car className="h-5 w-5 text-amber-600" />}
              accent="bg-amber-50"
            />
            <Stat
              label="Delivered Today"
              value={String(valetStats.deliveredToday)}
              icon={<CheckCircle2 className="h-5 w-5 text-teal-600" />}
              accent="bg-teal-50"
            />
            <Stat
              label="Free Slots"
              value={String(valetStats.freeSlots)}
              icon={<ParkingCircle className="h-5 w-5 text-violet-600" />}
              accent="bg-violet-50"
            />
            <Stat
              label="Total Slots"
              value={String(valetStats.totalSlots)}
              icon={<ParkingCircle className="h-5 w-5 text-zinc-500" />}
              accent="bg-zinc-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOverviewPage() {
  // The Admin portal is SUPER_ADMIN-only (enforced by AdminShell → AdminGate).
  // Kitchen owners have their own dashboard at /kitchen.
  return (
    <AdminShell>
      <SuperAdminOverview />
    </AdminShell>
  );
}
