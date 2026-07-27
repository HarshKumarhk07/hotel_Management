'use client';

import { useState } from 'react';
import { Boxes } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { KitchenSelect } from '@/components/admin/KitchenSelect';
import { StockManager } from '@/components/manage/StockManager';
import { EmptyState } from '@/components/ui/primitives';

/**
 * Super Admin stock management for any kitchen (explicit picker). Kitchen owners
 * use the auto-scoped /kitchen/stock instead.
 */
function StockManagerPage() {
  const [kitchenId, setKitchenId] = useState('');

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-brand" /> Stock Management
          </h1>
          <p className="text-sm text-zinc-500">Manage item stock status and track kitchen inventory</p>
        </div>
        <KitchenSelect value={kitchenId} onChange={setKitchenId} />
      </div>

      {!kitchenId ? (
        <EmptyState title="Select a kitchen" description="Choose a kitchen to manage its stock." />
      ) : (
        <StockManager kitchenId={kitchenId} />
      )}
    </div>
  );
}

export default function AdminStockPage() {
  return (
    <AdminShell>
      <StockManagerPage />
    </AdminShell>
  );
}
