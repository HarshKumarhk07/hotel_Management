'use client';

import { useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { KitchenSelect } from '@/components/admin/KitchenSelect';
import { MenuManager } from '@/components/manage/MenuManager';
import { EmptyState } from '@/components/ui/primitives';

/**
 * Super Admin menu management. Admins manage ANY kitchen's menu, so they pick
 * the target kitchen explicitly (the backend requires an explicit kitchen id
 * for super admins). Kitchen owners use the auto-scoped /kitchen/menu instead.
 */
function MenuManagerPage() {
  const [kitchenId, setKitchenId] = useState('');

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Menu</h1>
        <KitchenSelect value={kitchenId} onChange={setKitchenId} />
      </div>

      {!kitchenId ? (
        <EmptyState title="Select a kitchen" description="Choose a kitchen to manage its menu." />
      ) : (
        <MenuManager kitchenId={kitchenId} />
      )}
    </div>
  );
}

export default function AdminMenuPage() {
  return (
    <AdminShell>
      <MenuManagerPage />
    </AdminShell>
  );
}
