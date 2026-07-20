'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthBootstrap } from '@/hooks/useAuth';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

function AuthBootstrap({ children }: { children: ReactNode }) {
  useAuthBootstrap();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && pathname.startsWith('/valet')) {
      document.body.classList.remove('sharp-edges');
    } else {
      document.body.classList.add('sharp-edges');
    }
  }, [pathname]);

  return <>{children}</>;
}

/** App-wide client providers (React Query + auth session bootstrap). */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  );
}
