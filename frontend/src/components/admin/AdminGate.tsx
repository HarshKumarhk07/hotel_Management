'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { homeForRole } from '@/lib/nav';
import { CenteredSpinner } from '@/components/ui/primitives';

/**
 * Guards the Admin area. Strictly SUPER_ADMIN only — kitchen owners (and any
 * other role) are redirected to their own home. This is the client-side half of
 * the guard; the edge middleware blocks the wrong role before the shell is
 * served, and the backend API is the authoritative authorization boundary.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user, status } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?next=/admin');
      return;
    }
    if (status === 'authenticated' && user && user.role !== 'SUPER_ADMIN') {
      router.replace(homeForRole(user.role));
    }
  }, [status, user, router]);

  if (status !== 'authenticated') return <CenteredSpinner label="Loading…" />;
  if (!user || user.role !== 'SUPER_ADMIN') return <CenteredSpinner label="Redirecting…" />;

  return <>{children}</>;
}
