'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bell, BellOff, ChefHat, LogOut, RefreshCw } from 'lucide-react';
import { KitchenGate } from '@/components/kitchen/KitchenGate';
import { OrderCard } from '@/components/kitchen/OrderCard';
import { Button } from '@/components/ui/button';
import { CenteredSpinner } from '@/components/ui/primitives';
import { useKitchenOrders } from '@/hooks/useKitchenOrders';
import { useAuth } from '@/hooks/useAuth';
import { playNewOrderChime } from '@/lib/sound'; // fallback just in case or keep original imports
import { primeAudio } from '@/lib/sound';
import { STATUS_LABEL } from '@/lib/orderStatus';
import type { Order } from '@/hooks/useOrders';

const COLUMNS = ['NEW_ORDER', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

function Board() {
  const router = useRouter();
  const { logout } = useAuth();
  const { active, isLoading, refetch, isRefetching } = useKitchenOrders();
  const [soundOn, setSoundOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a minute so elapsed timers stay fresh between refetches.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Order[]> = {};
    for (const c of COLUMNS) map[c] = [];
    for (const o of active) map[o.status]?.push(o);
    return map;
  }, [active]);

  const enableSound = () => {
    primeAudio();
    setSoundOn(true);
  };

  const onLogout = async () => {
    await logout();
    router.replace('/kitchen/login');
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
          </div>
          <div>
            <h1 className="font-bold leading-tight text-zinc-900">Kitchen Queue</h1>
            <p className="text-xs text-zinc-500">{active.length} active order{active.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={isRefetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
          <Button variant={soundOn ? 'subtle' : 'outline'} size="sm" onClick={enableSound}>
            {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{soundOn ? 'Sound on' : 'Enable sound'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {isLoading ? (
        <CenteredSpinner label="Loading orders…" />
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto bg-zinc-100 p-4">
          {COLUMNS.map((col) => (
            <section key={col} className="flex w-80 shrink-0 flex-col">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-600">
                  {STATUS_LABEL[col]}
                </h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-zinc-600">
                  {grouped[col].length}
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pb-4">
                {grouped[col].length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-xs text-zinc-400">
                    No orders
                  </p>
                ) : (
                  grouped[col].map((o) => <OrderCard key={o._id} order={o} now={now} />)
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KitchenDashboardPage() {
  return (
    <KitchenGate>
      <Board />
    </KitchenGate>
  );
}
