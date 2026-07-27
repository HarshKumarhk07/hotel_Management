'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, RefreshCw } from 'lucide-react';
import { KitchenShell } from '@/components/kitchen/KitchenShell';
import { OrderCard } from '@/components/kitchen/OrderCard';
import { Button } from '@/components/ui/button';
import { CenteredSpinner } from '@/components/ui/primitives';
import { useKitchenOrders } from '@/hooks/useKitchenOrders';
import { primeAudio } from '@/lib/sound';
import { STATUS_LABEL } from '@/lib/orderStatus';
import type { Order } from '@/hooks/useOrders';

const COLUMNS = ['NEW_ORDER', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

function Board() {
  const { active, isLoading, refetch, isRefetching } = useKitchenOrders();
  const [soundOn, setSoundOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick so elapsed timers stay fresh between refetches.
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

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Live Queue</h1>
          <p className="text-sm text-zinc-500">
            {active.length} active order{active.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={isRefetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant={soundOn ? 'subtle' : 'outline'} size="sm" onClick={enableSound}>
            {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span className="hidden sm:inline">{soundOn ? 'Sound on' : 'Enable sound'}</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <CenteredSpinner label="Loading orders…" />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2" style={{ minHeight: 'calc(100vh - 12rem)' }}>
          {COLUMNS.map((col) => (
            <section key={col} className="flex w-80 shrink-0 flex-col">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-600">{STATUS_LABEL[col]}</h2>
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

export default function KitchenQueuePage() {
  return (
    <KitchenShell>
      <Board />
    </KitchenShell>
  );
}
