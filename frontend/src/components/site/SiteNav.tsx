'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LogIn, UtensilsCrossed } from 'lucide-react';

/** The hotel's public website. */
export const MAIN_SITE = 'https://thepagerohtak.com';

/** Top navigation for the public landing page. */
export function SiteNav({ fullMenuHref }: { fullMenuHref: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#ECECEC]/60 bg-white/80 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-11 w-11 overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-zinc-100 transition-shadow group-hover:shadow-lg">
            <Image
              src="/logo.png"
              alt="The Page"
              width={44}
              height={44}
              priority
              className="h-11 w-11 object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-[#111111]">The Page</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#666666]">Premium Hotel</span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href={fullMenuHref}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#111111] transition-all duration-300 hover:bg-[#FAF9F6] hover:shadow-sm"
          >
            <UtensilsCrossed className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
            <span className="hidden sm:inline">Full Menu</span>
            <span className="sm:hidden">Menu</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-[#222222] hover:shadow-lg"
          >
            <LogIn className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
            <span className="hidden sm:inline">Login</span>
            <span className="sm:hidden">Login</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
