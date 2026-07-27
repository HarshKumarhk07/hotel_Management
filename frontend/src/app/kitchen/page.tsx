'use client';

import { KitchenShell } from '@/components/kitchen/KitchenShell';
import { KitchenDashboard } from '@/components/manage/KitchenDashboard';

export default function KitchenDashboardPage() {
  return (
    <KitchenShell>
      <KitchenDashboard />
    </KitchenShell>
  );
}
