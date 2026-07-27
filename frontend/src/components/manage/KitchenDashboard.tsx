'use client';

import { useQuery } from '@tanstack/react-query';
import {
  IndianRupee,
  ClipboardList,
  TimerReset,
  TrendingUp,
  AlertTriangle,
  Clock,
  CircleDot,
  ToggleLeft,
  ToggleRight,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { Card, CenteredSpinner } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useKitchenMutations } from '@/hooks/useAdminKitchens';
import { toast } from 'sonner';

interface KitchenDashboardData {
  today: { ordersCount: number; revenue: number };
  lifetime: { totalOrders: number; totalRevenue: number; deliveredOrders: number };
  statusCounts: { pending: number; preparing: number; ready: number };
  topSellingItems: { menuItem: string; name: string; quantitySold: number }[];
  lowStockItems: { id: string; name: string; stockQuantity: number | null; inStock: boolean }[];
  kitchenStatus: { name: string; isActive: boolean; temporarilyClosed: boolean; isOpenNow: boolean } | null;
  recentOrders: { _id: string; orderNumber: string; status: string; pricing: { total: number }; createdAt: string }[];
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <Card className="p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
    </Card>
  );
}

/** Kitchen owner's operational dashboard, scoped to their own kitchen server-side. */
export function KitchenDashboard() {
  const user = useAuthStore((s) => s.user);
  const { update } = useKitchenMutations();

  const { data: d, isLoading, refetch } = useQuery({
    queryKey: ['kitchen-dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: KitchenDashboardData }>('/kitchens/my-kitchen/dashboard');
      return res.data.data;
    },
  });

  const toggleClosure = async () => {
    if (!d?.kitchenStatus || !user?.kitchenId) return;
    const isClosed = d.kitchenStatus.temporarilyClosed;
    try {
      await update.mutateAsync({ id: user.kitchenId, input: { temporarilyClosed: !isClosed } });
      refetch();
    } catch {
      toast.error('Could not toggle kitchen status');
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
        <Stat label="Revenue Today" value={formatINR(d.today.revenue)} icon={<IndianRupee className="h-5 w-5 text-green-600" />} accent="bg-green-50" />
        <Stat label="Today's Orders" value={String(d.today.ordersCount)} icon={<ClipboardList className="h-5 w-5 text-blue-600" />} accent="bg-blue-50" />
        <Stat label="Pending Orders" value={String(d.statusCounts.pending)} icon={<TimerReset className="h-5 w-5 text-amber-600" />} accent="bg-amber-50" />
        <Stat label="Preparing Orders" value={String(d.statusCounts.preparing)} icon={<Clock className="h-5 w-5 text-indigo-600" />} accent="bg-indigo-50" />
        <Stat label="Ready Orders" value={String(d.statusCounts.ready)} icon={<CheckCircle2 className="h-5 w-5 text-teal-600" />} accent="bg-teal-50" />
      </div>

      {/* All-time performance */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">All-time Performance</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat
            label="Total Revenue (paid)"
            value={formatINR(d.lifetime?.totalRevenue ?? 0)}
            icon={<IndianRupee className="h-5 w-5 text-green-600" />}
            accent="bg-green-50"
          />
          <Stat
            label="Total Orders"
            value={String(d.lifetime?.totalOrders ?? 0)}
            icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
            accent="bg-blue-50"
          />
          <Stat
            label="Delivered Orders"
            value={String(d.lifetime?.deliveredOrders ?? 0)}
            icon={<CheckCircle2 className="h-5 w-5 text-teal-600" />}
            accent="bg-teal-50"
          />
        </div>
      </div>

      {/* Detail widgets */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
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

          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Stock Warnings
            </h2>
            {d.lowStockItems.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-400">All items fully stocked</p>
            ) : (
              <div className="space-y-2">
                {d.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-2 text-sm">
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
