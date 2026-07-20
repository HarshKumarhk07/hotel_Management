'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { LogIn, QrCode, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** Top navigation for subpages. */
export function SiteNav({ fullMenuHref }: { fullMenuHref: string }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-[#ECECEC]/60 bg-white/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.03)] font-sans">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
        
        {/* Left Side: Logo and Hotel Name */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-zinc-50 border border-zinc-200/80 shadow-sm transition-all duration-300 group-hover:shadow-md">
            <Image
              src="/logo.png"
              alt="The Page Logo"
              width={32}
              height={32}
              priority
              className="h-full w-full object-contain p-0.5"
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-sm font-bold tracking-[0.15em] text-[#111111] font-serif uppercase leading-none group-hover:text-[#D4AF37] transition-colors">
              THE PAGE
            </span>
            <span className="text-[6px] sm:text-[7px] font-semibold tracking-[0.2em] text-[#666666] uppercase mt-0.5">
              LUXURY HOTEL
            </span>
          </div>
        </Link>

        {/* Center: Navigation Links (hidden on mobile/tablet) */}
        <nav className="hidden lg:flex items-center gap-6 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#666666]">
          <Link href="/" className="hover:text-[#D4AF37] transition-colors pb-0.5">
            Home
          </Link>
          <Link href="/rooms" className="hover:text-[#D4AF37] transition-colors pb-0.5">
            Rooms
          </Link>
          <Link href="/banquets" className="hover:text-[#D4AF37] transition-colors pb-0.5">
            Banquet
          </Link>
          <Link href="/restaurant/waitlist" className="hover:text-[#D4AF37] transition-colors pb-0.5">
            Restaurant
          </Link>
          <Link href="/#amenities" className="hover:text-[#D4AF37] transition-colors pb-0.5">
            Amenities
          </Link>
          <Link href="/about" className="hover:text-[#D4AF37] transition-colors pb-0.5">
            About
          </Link>
        </nav>

        {/* Right Side: Scan QR & Login/Dashboard */}
        <nav className="flex items-center gap-2 sm:gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em]">
          <Link
            href="/?scan=true"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[#D4AF37] px-3.5 text-[#D4AF37] transition-all duration-300 hover:bg-[#D4AF37]/5 max-sm:p-2"
            title="Scan QR Code"
          >
            <QrCode className="h-4 w-4" />
            <span className="hidden sm:inline">Scan QR</span>
          </Link>
          
          {status === 'authenticated' ? (
            <Link
              href={
                user?.role === 'SUPER_ADMIN' || user?.role === 'KITCHEN_OWNER'
                  ? '/admin'
                  : user?.role === 'VALET_MANAGER'
                  ? '/valet/dashboard'
                  : '/orders'
              }
              className="hidden md:inline-flex h-9 items-center justify-center rounded-full bg-[#D4AF37] px-5 text-white transition-all duration-300 hover:bg-[#AE963C]"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden md:inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#111111] px-5 text-white transition-all duration-300 hover:bg-zinc-800"
            >
              <LogIn className="h-3.5 w-3.5 opacity-80 text-[#D4AF37]" aria-hidden="true" />
              <span>Login</span>
            </Link>
          )}

          {/* Hamburger Menu Toggle (hidden on desktop) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 text-zinc-700 hover:text-[#D4AF37] transition-colors rounded-lg border border-zinc-200/80 bg-zinc-50"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-[#ECECEC]/60 bg-white px-6 py-6 space-y-4 flex flex-col text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#666666]"
          >
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#D4AF37] py-1 text-left border-b border-zinc-100">
              Home
            </Link>
            <Link href="/rooms" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#D4AF37] py-1 text-left border-b border-zinc-100">
              Rooms
            </Link>
            <Link href="/banquets" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#D4AF37] py-1 text-left border-b border-zinc-100">
              Banquet
            </Link>
            <Link href="/restaurant/waitlist" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#D4AF37] py-1 text-left border-b border-zinc-100">
              Restaurant
            </Link>
            <Link href="/#amenities" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#D4AF37] py-1 text-left border-b border-zinc-100">
              Amenities
            </Link>
            <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#D4AF37] py-1 text-left border-b border-zinc-100">
              About
            </Link>
            {status === 'authenticated' ? (
              <Link
                href={
                  user?.role === 'SUPER_ADMIN' || user?.role === 'KITCHEN_OWNER'
                    ? '/admin'
                    : user?.role === 'VALET_MANAGER'
                    ? '/valet/dashboard'
                    : '/orders'
                }
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#D4AF37] text-white text-center font-bold tracking-wider uppercase mt-2"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#111111] text-white text-center font-bold tracking-wider uppercase mt-2"
              >
                <LogIn className="h-4 w-4 text-[#D4AF37]" />
                <span>Login</span>
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
