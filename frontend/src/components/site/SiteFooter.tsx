'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Instagram, MapPin, Phone, Mail, ArrowUpRight } from 'lucide-react';

const FACEBOOK_URL = 'https://www.facebook.com/people/The-Page/61571289382844/';
const INSTAGRAM_URL = 'https://www.instagram.com/thepage_rohtak/';

/** Public site footer, mirroring the hotel's main website (no WhatsApp widget). */
export function SiteFooter() {
  return (
    <footer className="border-t border-[#ECECEC] bg-[#FAF9F6]">
      {/* Main Content */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-8 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="The Page Hotel"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-[#111111]">The Page</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#666666]">Premium Hotel</span>
            </div>
          </div>
          <p className="max-w-[250px] text-sm leading-relaxed text-[#666666]">
            A destination of refined luxury, curated experiences, and unforgettable hospitality.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="The Page on Facebook"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#666666] shadow-sm ring-1 ring-[#ECECEC] transition-all duration-300 hover:bg-[#111111] hover:text-white hover:shadow-md hover:ring-transparent"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="The Page on Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#666666] shadow-sm ring-1 ring-[#ECECEC] transition-all duration-300 hover:bg-[#111111] hover:text-white hover:shadow-md hover:ring-transparent"
            >
              <Instagram className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#D4AF37]">
            <MapPin className="h-3.5 w-3.5" />
            Address
          </h3>
          <p className="text-sm leading-[1.8] text-[#666666]">
            The Page Hotel,<br />
            Delhi Bypass,<br />
            Opposite Tilyar Lake.
          </p>
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#D4AF37]">
            <Phone className="h-3.5 w-3.5" />
            Contact
          </h3>
          <a
            href="tel:+917664007601"
            className="group flex items-center gap-2 text-sm text-[#666666] transition-colors hover:text-[#D4AF37]"
          >
            +91 7664007601
            <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        </div>

        {/* Email */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#D4AF37]">
            <Mail className="h-3.5 w-3.5" />
            E-mail
          </h3>
          <a
            href="mailto:reservation@thepagerohtak.com"
            className="group flex items-center gap-2 break-all text-sm text-[#666666] transition-colors hover:text-[#D4AF37]"
          >
            reservation@thepagerohtak.com
            <ArrowUpRight className="hidden h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
          </a>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-[#ECECEC] bg-[#111111] py-5 text-center">
        <p className="text-xs tracking-wide text-zinc-400">
          © {new Date().getFullYear()}{' '}
          <span className="font-semibold text-[#D4AF37]">The Page Hotel</span>. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
