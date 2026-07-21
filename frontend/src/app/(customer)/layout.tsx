'use client';

import { Navbar } from '@/components/ui/Navbar';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar />
      {children}
    </div>
  );
}
