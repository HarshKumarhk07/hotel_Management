'use client';

import { usePathname } from 'next/navigation';
import { SiteNav } from '@/components/site/SiteNav';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <div className="min-h-screen bg-zinc-50">
      {!isHome && <SiteNav fullMenuHref="/" />}
      {children}
    </div>
  );
}
