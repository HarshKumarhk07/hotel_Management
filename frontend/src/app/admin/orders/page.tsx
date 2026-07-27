'use client';

import { AdminShell } from '@/components/admin/AdminShell';
import { OrdersList } from '@/components/manage/OrdersList';

export default function AdminOrdersPage() {
  return (
    <AdminShell>
      {/* Super admins can filter across every kitchen. */}
      <OrdersList showKitchenFilter />
    </AdminShell>
  );
}
