'use client';

import { usePathname } from 'next/navigation';

/**
 * Customer shell. The landing page (`/`) is a full-width, website-style page
 * (nav + featured + footer); every other customer screen keeps the mobile-app
 * frame used for ordering.
 */
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullWidth = pathname === '/';

  if (fullWidth) {
    return <div className="min-h-screen bg-zinc-50">{children}</div>;
  }
  return <div className="min-h-screen bg-zinc-50">{children}</div>;
}
