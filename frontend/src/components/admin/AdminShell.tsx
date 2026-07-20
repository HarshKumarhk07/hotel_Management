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
  Heart,
  LifeBuoy,
  Globe,
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

interface Notif {
  id: string;
  type: 'valet' | 'ticket' | 'order';
  title: string;
  body: string;
  time: Date;
  read: boolean;
  href: string;
}

const TYPE_STYLES: Record<Notif['type'], { bg: string; icon: string; color: string }> = {
  valet:  { bg: 'bg-amber-100',   color: 'text-amber-600',  icon: '🚗' },
  ticket: { bg: 'bg-red-100',     color: 'text-red-600',    icon: '🎫' },
  order:  { bg: 'bg-emerald-100', color: 'text-emerald-600', icon: '🍽️' },
};

/** Unified notification bell for valet, service-tickets, and new orders */
function NotificationBell({ role, align = 'right' }: { role: string; align?: 'right' | 'left-flyout' }) {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const status = useAuthStore((s) => s.status);

  const unread = notifications.filter((n) => !n.read).length;

  const addNotif = (notif: Omit<Notif, 'id' | 'time' | 'read'>) => {
    const n: Notif = { ...notif, id: `${Date.now()}-${Math.random()}`, time: new Date(), read: false };
    setNotifications((prev) => [n, ...prev].slice(0, 30));
    playNewOrderChime();

    // Pop a toast for 4s
    const toast = document.createElement('div');
    toast.className = [
      'fixed bottom-6 right-6 z-[9999] flex items-start gap-3 max-w-xs',
      'rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xl',
      'animate-in slide-in-from-bottom-4 fade-in duration-300',
    ].join(' ');
    toast.innerHTML = `
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TYPE_STYLES[notif.type].bg} text-lg">${TYPE_STYLES[notif.type].icon}</div>
      <div class="min-w-0">
        <p class="text-sm font-semibold text-zinc-900 truncate">${n.title}</p>
        <p class="text-xs text-zinc-500 truncate">${n.body}</p>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  };

  useEffect(() => {
    if (status !== 'authenticated') return;
    const socket = getSocket();

    // Valet vehicle requested
    socket.on('valet:new', (p: { vehicle?: { carNumber?: string }; carNumber?: string }) => {
      const car = p?.vehicle?.carNumber ?? p?.carNumber ?? 'Unknown';
      addNotif({ type: 'valet', title: 'Vehicle Requested', body: `Guest waiting for ${car}`, href: '/admin/valet' });
    });

    // New service desk ticket (emitted by complaint controller)
    socket.on('complaint:new', (p: { room?: { roomNumber?: string }; guestName?: string; category?: string }) => {
      const room = p?.room?.roomNumber ?? '?';
      const guest = p?.guestName ?? 'Guest';
      const cat = p?.category ?? 'Request';
      addNotif({ type: 'ticket', title: 'New Service Ticket', body: `${cat} from ${guest} · Room ${room}`, href: '/admin/complaints' });
    });

    // New food order placed (emitted by order service)
    socket.on('order:new', (p: { orderNumber?: string; roomSnapshot?: { number?: string } }) => {
      const num = p?.orderNumber ?? '';
      addNotif({ type: 'order', title: 'New Order', body: `Order ${num} placed`, href: '/admin/orders' });
    });

    return () => {
      socket.off('valet:new');
      socket.off('complaint:new');
      socket.off('order:new');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        id="notification-bell-btn"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notifications-dropdown"
          className={cn(
            "absolute z-50 w-80 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden",
            align === 'left-flyout' ? "left-full top-0 ml-2" : "right-0 top-full mt-2"
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-3 bg-zinc-50">
            <p className="text-sm font-bold text-zinc-900">Notifications</p>
            {notifications.length > 0 && (
              <button onClick={() => setNotifications([])} className="text-xs text-zinc-400 hover:text-zinc-600">
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="mx-auto h-7 w-7 text-zinc-200 mb-2" />
                <p className="text-sm text-zinc-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors ${!n.read ? 'bg-zinc-50/80' : ''}`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${TYPE_STYLES[n.type].bg}`}>
                    {TYPE_STYLES[n.type].icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-900">{n.title}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{n.body}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                </Link>
              ))
            )}
          </div>
          <div className="border-t px-4 py-2.5 flex gap-3 bg-zinc-50">
            <Link href="/admin/valet" onClick={() => setOpen(false)} className="flex-1 text-center text-[11px] font-medium text-zinc-500 hover:text-zinc-800">Valet</Link>
            <span className="text-zinc-200">|</span>
            <Link href="/admin/complaints" onClick={() => setOpen(false)} className="flex-1 text-center text-[11px] font-medium text-zinc-500 hover:text-zinc-800">Tickets</Link>
            <span className="text-zinc-200">|</span>
            <Link href="/admin/orders" onClick={() => setOpen(false)} className="flex-1 text-center text-[11px] font-medium text-zinc-500 hover:text-zinc-800">Orders</Link>
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
    { href: '/', label: 'Go to Website', icon: <Globe className="h-4 w-4" />, ready: true },
    { href: '/admin', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, ready: true },
    ...(user?.role === 'SUPER_ADMIN' ? [
      { href: '/admin/kitchens', label: 'Kitchens', icon: <ChefHat className="h-4 w-4" />, ready: true },
      { href: '/admin/rooms', label: 'Rooms & QR', icon: <DoorOpen className="h-4 w-4" />, ready: true },
      { href: '/admin/housekeeping', label: 'Housekeeping', icon: <Boxes className="h-4 w-4" />, ready: true },
      { href: '/admin/valet', label: 'Valet Parking', icon: <Car className="h-4 w-4" />, ready: true },
      { href: '/admin/restaurant', label: 'Restaurant', icon: <UtensilsCrossed className="h-4 w-4" />, ready: true },
      { href: '/admin/complaints', label: 'Service Tickets', icon: <LifeBuoy className="h-4 w-4" />, ready: true },
      { href: '/admin/guests', label: 'Guests', icon: <Users className="h-4 w-4" />, ready: true },
      { href: '/admin/feedback', label: 'Guest Feedback', icon: <Heart className="h-4 w-4" />, ready: true },
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
          <NotificationBell role={user?.role ?? ''} />
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
          <NotificationBell role={user?.role ?? ''} align="left-flyout" />
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
