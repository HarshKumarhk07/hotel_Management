'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { homeForRole } from '@/lib/nav';
import { CenteredSpinner } from '@/components/ui/primitives';

/**
 * Guards the Kitchen portal. Strictly KITCHEN_OWNER only — no other role may
 * render kitchen pages. Anyone else is redirected to their own home (Super
 * Admins → /admin, guests → /login). This is the client-side half of the guard;
 * the edge middleware blocks the wrong role before the shell is served, and the
 * backend API is the authoritative authorization boundary.
 */
export function KitchenGate({ children }: { children: ReactNode }) {
  const { user, status } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?next=/kitchen');
      return;
    }
    if (status === 'authenticated' && user && user.role !== 'KITCHEN_OWNER') {
      router.replace(homeForRole(user.role));
    }
  }, [status, user, router]);

  if (status !== 'authenticated') return <CenteredSpinner label="Loading…" />;
  if (!user || user.role !== 'KITCHEN_OWNER') return <CenteredSpinner label="Redirecting…" />;

  return <>{children}</>;
}
