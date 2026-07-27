'use client';

import { KitchenShell } from '@/components/kitchen/KitchenShell';
import { MenuManager } from '@/components/manage/MenuManager';
import { CenteredSpinner } from '@/components/ui/primitives';
import { useAuthStore } from '@/stores/auth';

export default function KitchenMenuPage() {
  const kitchenId = useAuthStore((s) => s.user?.kitchenId);

  return (
    <KitchenShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Menu</h1>
        <p className="text-sm text-zinc-500">Manage your kitchen&apos;s categories and items.</p>
      </div>
      {kitchenId ? <MenuManager kitchenId={kitchenId} /> : <CenteredSpinner label="Loading your kitchen…" />}
    </KitchenShell>
  );
}
