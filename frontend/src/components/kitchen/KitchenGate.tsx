'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { CenteredSpinner, EmptyState } from '@/components/ui/primitives';

/**
 * Guards the kitchen dashboard. Requires an authenticated KITCHEN_OWNER (Super
 * Admins are allowed through for support). Anyone else is sent to the staff login.
 */
export function KitchenGate({ children }: { children: ReactNode }) {
  const { user, status } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') return <CenteredSpinner label="Loading…" />;
  if (status === 'unauthenticated') return <CenteredSpinner label="Redirecting…" />;

  if (user && user.role !== 'KITCHEN_OWNER' && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="grid min-h-screen place-items-center">
        <EmptyState
          title="Kitchen access only"
          description="This dashboard is for kitchen staff. Use the customer app to place orders."
        />
      </div>
    );
  }
  return <>{children}</>;
}
