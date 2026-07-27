'use client';

import { Boxes } from 'lucide-react';
import { KitchenShell } from '@/components/kitchen/KitchenShell';
import { StockManager } from '@/components/manage/StockManager';
import { CenteredSpinner } from '@/components/ui/primitives';
import { useAuthStore } from '@/stores/auth';

export default function KitchenStockPage() {
  const kitchenId = useAuthStore((s) => s.user?.kitchenId);

  return (
    <KitchenShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <Boxes className="h-6 w-6 text-brand" /> Stock Management
        </h1>
        <p className="text-sm text-zinc-500">Manage item stock status and track kitchen inventory.</p>
      </div>
      {kitchenId ? <StockManager kitchenId={kitchenId} /> : <CenteredSpinner label="Loading your kitchen…" />}
    </KitchenShell>
  );
}
