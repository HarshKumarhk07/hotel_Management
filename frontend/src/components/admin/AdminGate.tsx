'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { CenteredSpinner, EmptyState } from '@/components/ui/primitives';

/** Guards the admin area: requires an authenticated SUPER_ADMIN. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user, status } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') return <CenteredSpinner label="Loading…" />;
  if (user && user.role !== 'SUPER_ADMIN' && user.role !== 'KITCHEN_OWNER') {
    return (
      <div className="grid min-h-screen place-items-center">
        <EmptyState title="Restricted Access" description="This area requires an admin or kitchen owner account." />
      </div>
    );
  }
  return <>{children}</>;
}
