'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/admin/AdminShell';
import { Card, CenteredSpinner } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Dashboard {
  summary: {
    revenue: number;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    avgOrderValue: number;
    refundedAmount: number;
    revenueBreakdown?: {
      food: number;
      room: number;
      banquet: number;
    };
  };
  revenueTrends: { period: string; revenue: number; orders: number }[];
  peakHours: { hour: number; orders: number }[];
}

const COLORS = ['#D4AF37', '#111111', '#8884d8'];

export default function RevenueDashboardPage() {
  const [kitchen, setKitchen] = useState('');
  const qs = kitchen ? `?kitchen=${kitchen}` : '';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-revenue', kitchen],
    queryFn: async () => {
      const res = await api.get<{ data: Dashboard }>(`/analytics/dashboard${qs}`);
      return res.data.data;
    },
  });

  const getPieData = () => {
    if (!data?.summary?.revenueBreakdown) return [];
    return [
      { name: 'Room Bookings', value: data.summary.revenueBreakdown.room || 0 },
      { name: 'Restaurant (Food)', value: data.summary.revenueBreakdown.food || 0 },
      { name: 'Banquets', value: data.summary.revenueBreakdown.banquet || 0 },
    ].filter(i => i.value > 0);
  };

  const pieData = getPieData();

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-zinc-900">Revenue Dashboard</h1>
            <p className="text-xs text-zinc-500">Detailed financial metrics and revenue distribution</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-24"><CenteredSpinner /></div>
        ) : !data ? (
          <div className="py-24 text-center text-zinc-500 text-sm">Failed to load revenue data.</div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-5 space-y-2 border-l-4 border-l-[#D4AF37]">
                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Total Gross Revenue</p>
                <p className="text-3xl font-serif font-semibold text-zinc-900">{formatINR(data.summary.revenue)}</p>
              </Card>
              <Card className="p-5 space-y-2">
                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Total Transactions</p>
                <p className="text-3xl font-serif font-semibold text-zinc-900">{data.summary.completedOrders}</p>
              </Card>
              <Card className="p-5 space-y-2">
                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Average Value</p>
                <p className="text-3xl font-serif font-semibold text-[#D4AF37]">{formatINR(data.summary.avgOrderValue)}</p>
              </Card>
              <Card className="p-5 space-y-2">
                <p className="text-[10px] uppercase font-bold tracking-widest text-red-400">Refunds & Cancellations</p>
                <p className="text-3xl font-serif font-semibold text-red-600">{formatINR(data.summary.refundedAmount)}</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue Trends Area Chart */}
              <Card className="p-6 lg:col-span-2 space-y-4 shadow-sm border border-zinc-200">
                <h3 className="text-sm font-bold text-zinc-900">Revenue Timeline (7 Days)</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.revenueTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(val) => `₹${(val / 1000)}k`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(value: number) => formatINR(value)}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#D4AF37" fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Revenue Breakdown Pie Chart */}
              <Card className="p-6 space-y-4 shadow-sm border border-zinc-200 flex flex-col">
                <h3 className="text-sm font-bold text-zinc-900">Revenue Distribution</h3>
                <div className="flex-1 min-h-[250px]">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatINR(value)} />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-400">No revenue breakdown available</div>
                  )}
                </div>
              </Card>
            </div>

            {/* Peak Hours Bar Chart */}
            <Card className="p-6 space-y-4 shadow-sm border border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">Peak Transaction Hours</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(h) => `${h}:00`} 
                      tick={{ fontSize: 10 }} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#f4f4f5' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="orders" fill="#111111" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

          </div>
        )}
      </div>
    </AdminShell>
  );
}
