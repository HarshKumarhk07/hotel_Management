'use client';

import { KitchenShell } from '@/components/kitchen/KitchenShell';
import { OrdersList } from '@/components/manage/OrdersList';

export default function KitchenOrdersPage() {
  return (
    <KitchenShell>
      {/* No kitchen filter: the backend force-scopes to the owner's kitchen. */}
      <OrdersList showKitchenFilter={false} />
    </KitchenShell>
  );
}
