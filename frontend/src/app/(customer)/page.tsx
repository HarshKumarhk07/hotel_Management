'use client';

import { Navbar } from '@/components/ui/Navbar'; // We'll rewrite this next to support new tokens/transparent logic
import { Hero } from '@/components/landing/Hero';
import { About } from '@/components/landing/About';
import { Rooms } from '@/components/landing/Rooms';
import { Amenities } from '@/components/landing/Amenities';
import { Dining } from '@/components/landing/Dining';
import { Gallery } from '@/components/landing/Gallery';
import { Testimonials } from '@/components/landing/Testimonials';
import { Offers } from '@/components/landing/Offers';
import { FAQ } from '@/components/landing/FAQ';
import { DigitalConcierge } from '@/components/landing/DigitalConcierge';
import { CTA } from '@/components/landing/CTA';
import Link from 'next/link';
import { MapPin, Phone, Mail } from 'lucide-react';
import { useQrStore } from '@/stores/qr';

export default function HomePage() {
  const openScanner = useQrStore((s) => s.openScanner);

  const handleScrollToAbout = () => {
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-page-ivory text-page-black font-sans selection:bg-page-gold/20 selection:text-page-gold-dark">
      <main className="flex-1 w-full overflow-x-hidden">
        <Hero onScrollToAbout={handleScrollToAbout} />
        <About />
        <Rooms />
        <Amenities />
        <Dining />
        <Offers />
        <Gallery />
        <Testimonials />
        <FAQ />
        <DigitalConcierge />
        <CTA />
      </main>

      {/* Elegant Luxury Footer */}
      <footer className="bg-page-black text-page-ivory py-24 px-6 border-t border-page-ivory/5 font-sans">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 text-left">
          <div className="space-y-6">
            <h3 className="text-xl font-serif font-semibold tracking-[0.2em] text-page-gold uppercase">THE PAGE</h3>
            <p className="text-xs text-page-ivory/50 font-light leading-relaxed max-w-sm">
              Experience the pinnacle of hospitality, heritage grandeur, and culinary elegance. A world where regal traditions meet modern luxury.
            </p>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-page-gold">Quick Links</h4>
            <div className="flex flex-col gap-4 text-xs text-page-ivory/60 font-light">
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-page-gold transition-colors text-left w-fit">Home</button>
              <Link href="/rooms" className="hover:text-page-gold transition-colors text-left w-fit">Accommodation</Link>
              <Link href="/banquets" className="hover:text-page-gold transition-colors text-left w-fit">Banquets</Link>
              <Link href="/restaurant/waitlist" className="hover:text-page-gold transition-colors text-left w-fit">Dining</Link>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-page-gold">Palace Address</h4>
            <div className="space-y-4 text-xs text-page-ivory/60 font-light">
              <p className="flex items-start gap-3"><MapPin className="h-4 w-4 shrink-0 text-page-gold" /> Delhi NCR Road, Sector 15, Near Crown Landmark, India</p>
              <p className="flex items-center gap-3"><Phone className="h-4 w-4 shrink-0 text-page-gold" /> +91 98765 43210</p>
              <p className="flex items-center gap-3"><Mail className="h-4 w-4 shrink-0 text-page-gold" /> contact@thepagerohtak.com</p>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-page-gold">Guest Access</h4>
            <p className="text-xs text-page-ivory/50 font-light leading-relaxed">
              Scan your in-room QR code to access our digital concierge, in-room dining, and valet services.
            </p>
            <button
              onClick={() => openScanner()}
              className="group relative overflow-hidden bg-page-gold/10 border border-page-gold/30 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-page-gold transition-all duration-medium hover:border-page-gold hover:bg-page-gold/20 w-full text-center"
            >
              Open Scan Utility
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-page-ivory/10 mt-16 pt-8 flex flex-col md:flex-row items-center justify-between text-[10px] text-page-ivory/40 font-light uppercase tracking-widest">
          <p>© {new Date().getFullYear()} The Page. All Rights Reserved.</p>
          <div className="flex gap-6 mt-6 md:mt-0">
            <Link href="/login?next=/valet" className="hover:text-page-ivory transition-colors">Staff Access</Link>
            <span className="text-page-ivory/20">|</span>
            <Link href="/privacy" className="hover:text-page-ivory transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
