'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { LogIn, QrCode } from 'lucide-react';

/** Top navigation for subpages. */
export function SiteNav({ fullMenuHref }: { fullMenuHref: string }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 border-b border-[#ECECEC]/60 bg-white/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.03)] font-sans">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Left Side: Logo and Hotel Name */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-zinc-50 border border-zinc-200/80 shadow-sm transition-all duration-300 group-hover:shadow-md">
            <Image
              src="/logo.png"
              alt="The Page Logo"
              width={36}
              height={36}
              priority
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold tracking-[0.2em] text-[#111111] font-serif uppercase leading-none group-hover:text-[#D4AF37] transition-colors">
              THE PAGE
            </span>
            <span className="text-[7px] font-semibold tracking-[0.25em] text-[#666666] uppercase mt-0.5">
              LUXURY HOTEL
            </span>
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#666666]">
          <Link href="/" className="hover:text-[#D4AF37] transition-colors">
            Home
          </Link>
          <Link href="/rooms" className="hover:text-[#D4AF37] transition-colors">
            Rooms
          </Link>
          <Link href="/banquets" className="hover:text-[#D4AF37] transition-colors">
            Banquet
          </Link>
          <Link href="/restaurant/waitlist" className="hover:text-[#D4AF37] transition-colors">
            Restaurant
          </Link>
          <Link href="/#amenities" className="hover:text-[#D4AF37] transition-colors">
            Amenities
          </Link>
          <Link href="/about" className="hover:text-[#D4AF37] transition-colors">
            About
          </Link>
        </nav>

        {/* Right Side: Scan QR & Login/Dashboard */}
        <nav className="flex items-center gap-4 text-[10px] font-extrabold uppercase tracking-[0.18em]">
          <Link
            href="/?scan=true"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37] px-4 py-2 text-[#D4AF37] transition-all duration-300 hover:bg-[#D4AF37]/5"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>Scan QR</span>
          </Link>
          {status === 'authenticated' ? (
            <Link
              href={user?.role === 'VALET_MANAGER' ? '/valet/dashboard' : '/admin'}
              className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2 text-white transition-all duration-300 hover:bg-[#AE963C] hover:shadow-md"
            >
              <span>Dashboard</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2 text-white transition-all duration-300 hover:bg-zinc-800 hover:shadow-md"
            >
              <LogIn className="h-3.5 w-3.5 opacity-80 text-[#D4AF37]" aria-hidden="true" />
              <span>Login</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
