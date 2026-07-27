'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { KitchenGate } from './KitchenGate';
import { KitchenNotificationBell } from './KitchenNotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth';
import { KITCHEN_NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';

/**
 * Layout shell for the Kitchen portal. Fully isolated from the Admin portal:
 * it imports no admin component and renders only KITCHEN_NAV. Wrap any kitchen
 * page with <KitchenShell> to get the gate + sidebar + chrome.
 */
function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const isActive = (href: string) =>
    href === '/kitchen' ? pathname === '/kitchen' : pathname === href || pathname.startsWith(`${href}/`);

  const navLinks = (onNavigate?: () => void) =>
    KITCHEN_NAV.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            active ? 'bg-brand text-white' : 'text-zinc-600 hover:bg-zinc-100',
          )}
        >
          <Icon className="h-4 w-4" />
          {item.label}
        </Link>
      );
    });

  return (
    <div className="flex min-h-screen bg-zinc-100 flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="flex h-16 items-center justify-between border-b bg-white px-5 md:hidden w-full sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
          </div>
          <span className="font-bold text-zinc-900 text-sm">The Page · Kitchen</span>
        </div>
        <div className="flex items-center gap-2">
          <KitchenNotificationBell />
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

      {/* Mobile Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 transform flex-col border-r bg-white transition-transform duration-300 ease-in-out md:hidden',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
            </div>
            <span className="font-bold text-zinc-900 text-sm">The Page · Kitchen</span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">{navLinks(() => setMenuOpen(false))}</nav>
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
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white md:flex sticky top-0 h-screen z-30">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="Logo" width={36} height={36} className="object-contain" />
            </div>
            <span className="font-bold text-zinc-900">The Page · Kitchen</span>
          </div>
          <KitchenNotificationBell align="left-flyout" />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto">{navLinks()}</nav>
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

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-5">{children}</div>
      </main>
    </div>
  );
}

/** Wrap any kitchen page: enforces KITCHEN_OWNER + renders the kitchen sidebar. */
export function KitchenShell({ children }: { children: ReactNode }) {
  return (
    <KitchenGate>
      <Shell>{children}</Shell>
    </KitchenGate>
  );
}
