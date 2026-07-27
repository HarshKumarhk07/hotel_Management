'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { getSocket } from '@/lib/socket';
import { playNewOrderChime } from '@/lib/sound';
import { cn } from '@/lib/utils';

interface KitchenNotif {
  id: string;
  title: string;
  body: string;
  time: Date;
  read: boolean;
}

/**
 * Kitchen-only notification bell. Listens for new food orders and links to the
 * kitchen orders page. Deliberately does NOT subscribe to admin-only events
 * (valet, service tickets, contact messages) — the kitchen portal is isolated.
 */
export function KitchenNotificationBell({ align = 'right' }: { align?: 'right' | 'left-flyout' }) {
  const [notifications, setNotifications] = useState<KitchenNotif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const status = useAuthStore((s) => s.status);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (status !== 'authenticated') return;
    const socket = getSocket();
    const onOrder = (p: { orderNumber?: string }) => {
      const num = p?.orderNumber ?? '';
      setNotifications((prev) =>
        [
          {
            id: `${num}-${prev.length}`,
            title: 'New Order',
            body: `Order ${num} placed`,
            time: new Date(),
            read: false,
          },
          ...prev,
        ].slice(0, 30),
      );
      playNewOrderChime();
    };
    socket.on('order:new', onOrder);
    return () => {
      socket.off('order:new', onOrder);
    };
  }, [status]);

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
          className={cn(
            'absolute z-50 w-80 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden',
            align === 'left-flyout' ? 'left-full top-0 ml-2' : 'right-0 top-full mt-2',
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
                  href="/kitchen/orders"
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors ${!n.read ? 'bg-zinc-50/80' : ''}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-base">
                    🍽️
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-900">{n.title}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{n.body}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
