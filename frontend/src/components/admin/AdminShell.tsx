'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Car,
  ChefHat,
  DoorOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Tag,
  Ticket,
  UtensilsCrossed,
  X,
  Boxes,
  Clock,
  RotateCcw,
  Settings,
  Users,
  Image as ImageIcon,
  Landmark,
} from 'lucide-react';
import { AdminGate } from './AdminGate';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth';
import { getSocket } from '@/lib/socket';
import { playNewOrderChime } from '@/lib/sound';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  ready?: boolean;
}

interface ValetNotification {
  id: string;
  carNumber: string;
  message: string;
  time: Date;
  read: boolean;
}

/** Bell + dropdown for valet vehicle request notifications */
function ValetBell({ role }: { role: string }) {
  const [notifications, setNotifications] = useState<ValetNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const status = useAuthStore((s) => s.status);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (role !== 'SUPER_ADMIN' || status !== 'authenticated') return;
    const socket = getSocket();

    const handleValetNew = (payload: { vehicle?: { carNumber?: string }; carNumber?: string }) => {
      const carNumber = payload?.vehicle?.carNumber ?? payload?.carNumber ?? 'Unknown';
      const notif: ValetNotification = {
        id: `${Date.now()}-${carNumber}`,
        carNumber,
        message: `Guest requested vehicle ${carNumber}`,
        time: new Date(),
        read: false,
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 20));
      playNewOrderChime();

      // Auto-show toast for 4 seconds
      const toastId = `valet-toast-${notif.id}`;
      const toast = document.createElement('div');
      toast.id = toastId;
      toast.className = [
        'fixed bottom-6 right-6 z-[9999] flex items-start gap-3',
        'rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-xl',
        'animate-in slide-in-from-bottom-4 fade-in duration-300',
      ].join(' ');
      toast.innerHTML = `
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2Z"/><path d="M7 17v2"/><path d="M17 17v2"/></svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-zinc-900">🚗 Vehicle Requested</p>
          <p class="text-xs text-zinc-500">Guest is waiting for <strong>${carNumber}</strong></p>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    };

    socket.on('valet:new', handleValetNew);
    return () => {
      socket.off('valet:new', handleValetNew);
    };
  }, [role, status]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (role !== 'SUPER_ADMIN') return null;

  return (
    <div ref={ref} className="relative">
      <button
        id="valet-bell-btn"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAllRead();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors"
        aria-label="Valet notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="valet-notifications-dropdown"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-bold text-zinc-900">Valet Requests</p>
            {notifications.length > 0 && (
              <button
                onClick={() => setNotifications([])}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-50">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-400">No valet requests yet</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <Car className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{n.message}</p>
                    <p className="text-xs text-zinc-400">
                      {n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t px-4 py-2.5">
            <Link
              href="/admin/valet"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-brand hover:underline"
            >
              View Valet Management →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);

  const NAV: NavItem[] = [
    { href: '/admin', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, ready: true },
    ...(user?.role === 'SUPER_ADMIN' ? [
      { href: '/admin/kitchens', label: 'Kitchens', icon: <ChefHat className="h-4 w-4" />, ready: true },
      { href: '/admin/rooms', label: 'Rooms & QR', icon: <DoorOpen className="h-4 w-4" />, ready: true },
      { href: '/admin/valet', label: 'Valet Parking', icon: <Car className="h-4 w-4" />, ready: true },
      { href: '/admin/restaurant', label: 'Restaurant', icon: <UtensilsCrossed className="h-4 w-4" />, ready: true },
      { href: '/admin/guests', label: 'Guests', icon: <Users className="h-4 w-4" />, ready: true },
    ] : []),
    { href: '/admin/menu', label: 'Menu', icon: <UtensilsCrossed className="h-4 w-4" />, ready: true },
    ...(user?.role === 'KITCHEN_OWNER' ? [
      { href: '/admin/stock', label: 'Stock', icon: <Boxes className="h-4 w-4" />, ready: true },
    ] : []),
    { href: '/admin/orders', label: 'Orders', icon: <ScrollText className="h-4 w-4" />, ready: true },
    { href: '/admin/banners', label: 'Promotions', icon: <ImageIcon className="h-4 w-4" />, ready: true },
    { href: '/admin/staff', label: 'Staff Management', icon: <Users className="h-4 w-4" />, ready: true },
    { href: '/admin/banquets', label: 'Banquet Halls', icon: <Landmark className="h-4 w-4" />, ready: true },
    ...(user?.role === 'SUPER_ADMIN' ? [
      { href: '/admin/coupons', label: 'Coupons', icon: <Ticket className="h-4 w-4" />, ready: true },
    ] : []),
    { href: '/admin/analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" />, ready: true },
    ...(user?.role === 'KITCHEN_OWNER' ? [
      { href: '/admin/operating-hours', label: 'Operating Hours', icon: <Clock className="h-4 w-4" />, ready: true },
      { href: '/admin/refunds', label: 'Refunds', icon: <RotateCcw className="h-4 w-4" />, ready: true },
      { href: '/admin/settings', label: 'Kitchen Settings', icon: <Settings className="h-4 w-4" />, ready: true },
    ] : []),
    ...(user?.role === 'SUPER_ADMIN' ? [
      { href: '/admin/audit', label: 'Audit log', icon: <Tag className="h-4 w-4" />, ready: true },
    ] : []),
  ];


  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen bg-zinc-100 flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="flex h-16 items-center justify-between border-b bg-white px-5 md:hidden w-full sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
          </div>
          <span className="font-bold text-zinc-900 text-sm">The Page</span>
        </div>
        <div className="flex items-center gap-2">
          <ValetBell role={user?.role ?? ''} />
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {menuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-zinc-900/50 transition-opacity md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 transform flex-col border-r bg-white transition-transform duration-300 ease-in-out md:hidden',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Mobile Drawer Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
            </div>
            <span className="font-bold text-zinc-900 text-sm">The Page</span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-brand text-white' : 'text-zinc-600 hover:bg-zinc-100',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t px-3 py-3 bg-zinc-50">
          <p className="truncate px-2 text-xs text-zinc-500">{user?.email}</p>
          <button
            onClick={onLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white md:flex sticky top-0 h-screen">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="Logo" width={36} height={36} className="object-contain" />
            </div>
            <span className="font-bold text-zinc-900">The Page</span>
          </div>
          <ValetBell role={user?.role ?? ''} />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href;
            if (!item.ready) {
              return (
                <span
                  key={item.href}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300"
                  title="Coming soon"
                >
                  {item.icon}
                  {item.label}
                  <span className="ml-auto text-[10px] uppercase">soon</span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-brand text-white' : 'text-zinc-600 hover:bg-zinc-100',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t px-3 py-3">
          <p className="truncate px-2 text-xs text-zinc-500">{user?.email}</p>
          <button
            onClick={onLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-5">{children}</div>
      </main>
    </div>
  );
}

/** Wrap any admin page: enforces SUPER_ADMIN + renders the sidebar shell. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <Shell>{children}</Shell>
    </AdminGate>
  );
}
