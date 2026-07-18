'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { CenteredSpinner } from '@/components/ui/primitives';

/**
 * Guards customer-only pages. While the session is bootstrapping it shows a
 * spinner; if unauthenticated it redirects to /login with a `next` param so the
 * user returns here after signing in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== 'authenticated') return <CenteredSpinner label="Checking your session…" />;
  return <>{children}</>;
}
