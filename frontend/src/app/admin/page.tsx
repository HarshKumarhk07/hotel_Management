'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  Car,
  CheckCircle2,
  IndianRupee,
  ClipboardList,
  TimerReset,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Clock,
  CircleDot,
  ParkingCircle,
  ToggleLeft,
  ToggleRight,
  Activity,
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
import { useAuthStore } from '@/stores/auth';
import { useKitchenMutations } from '@/hooks/useAdminKitchens';

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
}

interface KitchenDashboard {
  today: { ordersCount: number; revenue: number };
  statusCounts: { pending: number; preparing: number; ready: number };
  topSellingItems: { menuItem: string; name: string; quantitySold: number }[];
  lowStockItems: { id: string; name: string; stockQuantity: number | null; inStock: boolean }[];
  kitchenStatus: { name: string; isActive: boolean; temporarilyClosed: boolean; isOpenNow: boolean } | null;
  recentOrders: { _id: string; orderNumber: string; status: string; pricing: { total: number }; createdAt: string }[];
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
              <Stat
                label="Revenue"
                value={formatINR(data.revenue)}
                icon={<IndianRupee className="h-5 w-5 text-green-600" />}
                accent="bg-green-50"
              />
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

function KitchenOwnerOverview() {
  const user = useAuthStore((s) => s.user);
  const { update } = useKitchenMutations();

  const { data: d, isLoading, refetch } = useQuery({
    queryKey: ['kitchen-dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: KitchenDashboard }>('/kitchens/my-kitchen/dashboard');
      return res.data.data;
    },
  });

  const toggleClosure = async () => {
    if (!d?.kitchenStatus || !user?.kitchenId) return;
    const isClosed = d.kitchenStatus.temporarilyClosed;
    try {
      await update.mutateAsync({
        id: user.kitchenId,
        input: { temporarilyClosed: !isClosed },
      });
      refetch();
    } catch (err) {
      alert('Could not toggle kitchen status');
    }
  };

  if (isLoading || !d) {
    return <CenteredSpinner label="Loading dashboard metrics…" />;
  }

  const kStatus = d.kitchenStatus;

  return (
    <div className="space-y-6">
      {/* Top Header & Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{kStatus?.name ?? 'Kitchen Dashboard'}</h1>
          <p className="text-sm text-zinc-500">Operational overview & metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              kStatus?.temporarilyClosed
                ? 'bg-red-100 text-red-700'
                : kStatus?.isOpenNow
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            <CircleDot className="h-3 w-3" />
            {kStatus?.temporarilyClosed
              ? 'Temporarily Closed'
              : kStatus?.isOpenNow
              ? 'Open & Operating'
              : 'Closed (Outside Hours)'}
          </span>
          <Button
            variant={kStatus?.temporarilyClosed ? 'default' : 'outline'}
            size="sm"
            onClick={toggleClosure}
            className="flex items-center gap-1.5"
            disabled={update.isPending}
          >
            {kStatus?.temporarilyClosed ? (
              <>
                <ToggleRight className="h-5 w-5 text-green-500" /> Open Kitchen
              </>
            ) : (
              <>
                <ToggleLeft className="h-5 w-5 text-zinc-400" /> Temporarily Close
              </>
            )}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat
          label="Revenue Today"
          value={formatINR(d.today.revenue)}
          icon={<IndianRupee className="h-5 w-5 text-green-600" />}
          accent="bg-green-50"
        />
        <Stat
          label="Today's Orders"
          value={String(d.today.ordersCount)}
          icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
          accent="bg-blue-50"
        />
        <Stat
          label="Pending Orders"
          value={String(d.statusCounts.pending)}
          icon={<TimerReset className="h-5 w-5 text-amber-600" />}
          accent="bg-amber-50"
        />
        <Stat
          label="Preparing Orders"
          value={String(d.statusCounts.preparing)}
          icon={<Clock className="h-5 w-5 text-indigo-600" />}
          accent="bg-indigo-50"
        />
        <Stat
          label="Ready Orders"
          value={String(d.statusCounts.ready)}
          icon={<CheckCircle2 className="h-5 w-5 text-teal-600" />}
          accent="bg-teal-50"
        />
      </div>

      {/* Detail widgets */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Top Selling & Low Stock */}
        <div className="space-y-6">
          {/* Top Selling Items */}
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
              <TrendingUp className="h-4 w-4" /> Top Selling Items
            </h2>
            {d.topSellingItems.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-400">No orders yet</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {d.topSellingItems.map((item) => (
                  <div key={item.menuItem} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-zinc-900">{item.name}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                      {item.quantitySold} sold
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Low Stock Items */}
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Stock Warnings
            </h2>
            {d.lowStockItems.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-400">All items fully stocked</p>
            ) : (
              <div className="space-y-2">
                {d.lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-2 text-sm"
                  >
                    <span className="font-medium text-zinc-800">{item.name}</span>
                    <span className="font-semibold text-red-600">
                      {item.stockQuantity === 0 || !item.inStock ? 'OUT OF STOCK' : `${item.stockQuantity} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Recent Activity */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
            <Activity className="h-4 w-4" /> Recent Orders
          </h2>
          {d.recentOrders.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-400">No recent orders</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-zinc-400">
                    <th className="py-2">Order #</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {d.recentOrders.map((o) => (
                    <tr key={o._id} className="text-zinc-800">
                      <td className="py-2.5 font-medium">{o.orderNumber}</td>
                      <td className="py-2.5">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-zinc-600">
                          {o.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-semibold">{formatINR(o.pricing.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <AdminShell>
      {user?.role === 'SUPER_ADMIN' ? <SuperAdminOverview /> : <KitchenOwnerOverview />}
    </AdminShell>
  );
}
