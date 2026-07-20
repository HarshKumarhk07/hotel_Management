'use client';

import { motion } from 'framer-motion';
import NextImage from 'next/image';
import Link from 'next/link';
import {
  Award,
  ShieldCheck,
  Star,
  Users,
  Compass,
  Building,
  Heart,
  Clock,
  MapPin,
  Car,
  PhoneCall,
  UtensilsCrossed,
  ArrowRight,
  Landmark
} from 'lucide-react';
import { Badge, Card } from '@/components/ui/primitives';

export default function AboutUsPage() {
  const coreValues = [
    { title: 'Regal Hospitality', desc: 'Inspired by India’s age-old philosophy of "Atithi Devo Bhava", we treat every guest as royalty, wrapping warmth in flawless execution.', icon: <Heart className="h-6 w-6 text-[#D4AF37]" /> },
    { title: 'Heritage & Grandeur', desc: 'Our architecture and design echo the timeless luxury of heritage palaces, preserving cultural aesthetics in every arch.', icon: <Landmark className="h-6 w-6 text-[#D4AF37]" /> },
    { title: 'Uncompromising Comfort', desc: 'Plush bespoke linens, state-of-the-art climate automation, and quiet acoustics ensure an exquisite retreat from the world.', icon: <ShieldCheck className="h-6 w-6 text-[#D4AF37]" /> },
    { title: 'Culinary Masterpieces', desc: 'From royal Awadhi slow-cooking to contemporary international cuisines, our master chefs curate dining that is pure art.', icon: <UtensilsCrossed className="h-6 w-6 text-[#D4AF37]" /> },
    { title: 'Elegance & Detail', desc: 'We believe true luxury lies in the unspoken details: custom floral arrangements, personalized scents, and perfect lighting.', icon: <Star className="h-6 w-6 text-[#D4AF37]" /> },
    { title: 'Service Excellence', desc: 'Our around-the-clock concierges and private butler services cater to your requests proactively, before you even ask.', icon: <Award className="h-6 w-6 text-[#D4AF37]" /> }
  ];

  const highlights = [
    { label: 'Luxury Chambers & Suites', value: '45+' },
    { label: 'Palace Fine Dining Capacity', value: '180 Pax' },
    { label: 'Grand Banquet Halls', value: '6 Venues' },
    { label: 'Delighted Global Guests', value: '10K+' },
    { label: 'Years of Heritage Service', value: '10 Years' },
    { label: 'Royal Events Hosted', value: '1,200+' }
  ];

  const reasons = [
    { title: 'Luxury Chambers', desc: 'Bespoke suites featuring king beds, marble baths, private lounges, and scenic balcony views of the palace grounds.', icon: <Building className="h-5 w-5" /> },
    { title: 'Fine Dining', desc: 'Gourmet restaurant catalog with real-time room food ordering and curated slow-cooked Awadhi specialities.', icon: <UtensilsCrossed className="h-5 w-5" /> },
    { title: 'Banquet Halls', desc: 'Six premium indoor and open-air venues designed for grand wedding galas, celebrations, and corporate events.', icon: <Landmark className="h-5 w-5" /> },
    { title: 'Professional Staff', desc: 'Hospitality experts, private event planners, and dedicated chefs trained in the highest standards of luxury.', icon: <Users className="h-5 w-5" /> },
    { title: 'Secure Valet Desk', desc: 'Comprehensive secure valet parking module with SMS notification-based digital retrieval tracking.', icon: <Car className="h-5 w-5" /> },
    { title: '24/7 Butler Desk', desc: 'Round-the-clock guest support line, smart housekeeping desk, and personalized digital lobby concierge.', icon: <Clock className="h-5 w-5" /> },
    { title: 'Prime Location', desc: 'Centrally located in Delhi NCR Bypass, offering absolute peace and quiet while being highly accessible.', icon: <MapPin className="h-5 w-5" /> }
  ];

  const awards = [
    { title: 'Imperial Hospitality Seal 2024', organization: 'Luxury Travel Guild India', desc: 'Awarded for supreme excellence in custom guest services and heritage preservation.' },
    { title: 'Culinary Heritage Crown 2025', organization: 'Gourmet Gastronomy Forum', desc: 'Recognizing our Master Chef’s contribution in elevating classic Awadhi recipes.' },
    { title: 'Elite Wedding Destination of the Year', organization: 'Indian Royal Weddings Association', desc: 'Recognized for hosting high-profile banquets with seamless coordination.' }
  ];

  const testimonials = [
    { quote: "An absolute masterpiece of heritage luxury. The rooms feel like royal chambers and the private valet service was flawless.", author: "Dr. Vikram Seth", role: "Elite Member" },
    { quote: "We booked the Royal Ballroom for our wedding reception. The palace catering and lighting setup wowed all 400 of our guests.", author: "Meera & Rohan Singhania", role: "Wedding Guests" },
    { quote: "The culinary menu at The Page is a revelation. The Awadhi signature dishes are standard-defining. Exceptional hospitality.", author: "Chef Anthony Du Pont", role: "Michelin Guide Reviewer" }
  ];

  const galleryImages = [
    { url: '/hotel1.png', caption: 'Imperial Facade & Gardens' },
    { url: '/dining-banner.png', caption: 'The Page Dining Saloon' },
    { url: '/bnk2.png', caption: 'Royal Ballroom Gala Setup' },
    { url: '/abt1.png', caption: 'Signature Deluxe Suite' },
    { url: '/abt2.png', caption: 'Open Heritage Courtyard Pool' },
    { url: '/hotel1.png', caption: 'Regal Guest Reception' }
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-24 font-sans text-zinc-800">
      
      {/* ── 1. Hero Section ── */}
      <section className="relative h-[65vh] w-full flex items-center justify-center overflow-hidden bg-black">
        <NextImage
          src="/hotel1.png"
          alt="Luxury Hotel Exterior"
          fill
          priority
          className="object-cover brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
        <div className="relative z-10 max-w-4xl px-6 text-center space-y-4 text-white">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-[#D4AF37]"
          >
            OUR GRAND LEGACY
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-4xl md:text-7xl font-serif tracking-wide uppercase"
          >
            The Legacy of The Page
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="max-w-xl mx-auto text-xs md:text-sm font-light tracking-widest uppercase text-zinc-300"
          >
            Heritage Grandeur · Bespoke Comfort · Unrivaled Hospitality
          </motion.p>
        </div>
      </section>

      {/* ── 2. Our Story Section ── */}
      <section className="max-w-7xl mx-auto px-6 py-24 grid gap-16 md:grid-cols-2 items-center text-left">
        <div className="space-y-6">
          <span className="text-[10px] md:text-xs font-bold text-[#D4AF37] uppercase tracking-[0.25em]">
            DELHI NCR&apos;S PRESTIGIOUS SANCTUARY
          </span>
          <h2 className="text-3xl md:text-5xl font-serif text-zinc-900 leading-tight">
            Crafting Extraordinary<br />
            <span className="font-serif italic text-[#D4AF37]">&amp; Timeless Memories</span>
          </h2>
          <div className="space-y-4 text-xs md:text-sm leading-relaxed text-zinc-500 font-light">
            <p>
              Established in 2016, The Page stands as a proud testament to the golden era of hospitality. We blend the architectural grandeur of classic palaces with contemporary refinements, offering guests an immersive retreat that celebrates cultural heritage and modern comfort in equal measure.
            </p>
            <p>
              From the delicate carvings of our stone arches to the exquisite flavors of our curated Awadhi dining, every detail of our service is designed to evoke absolute grandeur. Our signature chambers and ballrooms are managed by passionate hospitality professionals, dedicated to delivering a tailored experience that exceeds five-star expectations.
            </p>
            <p>
              Whether you are checking in for a tranquil getaway, hosting a majestic wedding gala, or dining at our chef-led restaurant tables, welcome to a sanctuary where time slows down and memories are crafted to last a lifetime.
            </p>
          </div>
        </div>
        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-zinc-100 border border-zinc-200">
          <NextImage
            src="/abt1.png"
            alt="Palace Interior Suite Detail"
            fill
            className="object-cover"
          />
        </div>
      </section>

      {/* ── 3. Mission, Vision, and Core Values ── */}
      <section className="bg-zinc-900 py-24 text-white border-t border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 space-y-20">
          {/* Mission & Vision grid */}
          <div className="grid gap-12 md:grid-cols-2 text-left">
            <div className="space-y-4 p-8 rounded-3xl bg-zinc-950/40 border border-white/5">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#D4AF37]">The Purpose</span>
              <h3 className="text-2xl font-serif tracking-wide text-white uppercase">Our Mission</h3>
              <p className="text-xs text-zinc-400 font-light leading-relaxed">
                To elevate the standard of hospitality by preserving classical heritage aesthetics, sourcing premium regional ingredients, and leveraging smart digital concierge modules to deliver proactive, royal comfort.
              </p>
            </div>
            <div className="space-y-4 p-8 rounded-3xl bg-zinc-950/40 border border-white/5">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#D4AF37]">The Aspiration</span>
              <h3 className="text-2xl font-serif tracking-wide text-white uppercase">Our Vision</h3>
              <p className="text-xs text-zinc-400 font-light leading-relaxed">
                To be universally recognized as the crown jewel of luxury boutique hotels in the region, embodying standard-setting quality, royal architecture, and highly customized guest care.
              </p>
            </div>
          </div>

          {/* Core Values */}
          <div className="space-y-12">
            <div className="text-center space-y-3">
              <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.25em]">OUR COMPASS</span>
              <h3 className="text-3xl font-serif text-white">Core Pillars of Excellence</h3>
            </div>

            <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {coreValues.map((val) => (
                <div key={val.title} className="p-6 rounded-2xl bg-zinc-950/20 border border-white/5 text-left space-y-4 hover:border-[#D4AF37]/30 transition-all duration-300">
                  <div className="h-12 w-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center">
                    {val.icon}
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-serif text-lg font-semibold text-white tracking-wide">{val.title}</h4>
                    <p className="text-xs leading-relaxed text-zinc-400 font-light">{val.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Why Choose Us Section ── */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-16 text-left">
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.25em]">THE PALACE DIFFERENCE</span>
          <h2 className="text-3xl md:text-5xl font-serif text-zinc-900">Why Establishments Choose The Page</h2>
        </div>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((re) => (
            <Card key={re.title} className="p-6 flex flex-col justify-between border border-zinc-200 bg-white hover:shadow-xl transition-all duration-300 rounded-2xl">
              <div className="space-y-4">
                <div className="h-10 w-10 bg-[#FAF8F0] border border-[#D4AF37]/20 rounded-xl flex items-center justify-center text-[#D4AF37]">
                  {re.icon}
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-serif font-bold text-zinc-900 text-base">{re.title}</h4>
                  <p className="text-xs text-zinc-500 font-light leading-relaxed">{re.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── 5. Hotel Highlights (Display Counters) ── */}
      <section className="bg-zinc-950 py-20 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,#D4AF37_0%,transparent_65%)] opacity-10 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            {highlights.map((hi) => (
              <div key={hi.label} className="space-y-2 text-center">
                <span className="block text-4xl sm:text-5xl font-serif text-[#D4AF37] font-semibold">{hi.value}</span>
                <span className="block text-[10px] uppercase tracking-wider text-zinc-400 font-light leading-tight">{hi.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Awards Section ── */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-16 text-left">
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.25em]">ACCOLADES</span>
          <h2 className="text-3xl md:text-5xl font-serif text-zinc-900">Distinguished Accolades</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {awards.map((aw) => (
            <div key={aw.title} className="p-8 rounded-3xl border border-zinc-200 bg-white hover:shadow-xl transition-all duration-300 space-y-4">
              <span className="inline-block p-3 rounded-full bg-[#FAF8F0] border border-[#D4AF37]/20 text-[#D4AF37]">
                <Award className="h-6 w-6" />
              </span>
              <div className="space-y-1.5">
                <h4 className="font-serif text-lg font-semibold text-zinc-900 leading-snug">{aw.title}</h4>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400">{aw.organization}</span>
                <p className="text-xs text-zinc-500 font-light leading-relaxed pt-2">{aw.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 7. Gallery Section ── */}
      <section className="max-w-7xl mx-auto px-6 py-12 space-y-16 text-left">
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.25em]">VISUAL JOURNEY</span>
          <h2 className="text-3xl md:text-5xl font-serif text-zinc-900">A Glimpse into the Palace</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {galleryImages.map((img, idx) => (
            <div key={idx} className="relative aspect-[4/3] rounded-2xl overflow-hidden group shadow bg-zinc-100">
              <NextImage
                src={img.url}
                alt={img.caption}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4 text-left">
                <span className="text-xs font-bold text-white uppercase tracking-wider">{img.caption}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8. Testimonials Section ── */}
      <section className="bg-[#FAF8F0] py-24 border-t border-b border-[#D4AF37]/10">
        <div className="max-w-5xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.25em]">GUEST REVIEWS</span>
            <h2 className="text-3xl md:text-5xl font-serif text-zinc-900">Imperial Voices</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3 text-left">
            {testimonials.map((te, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-white border border-zinc-200 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs leading-relaxed text-zinc-500 font-light italic">
                  &ldquo;{te.quote}&rdquo;
                </p>
                <div className="space-y-0.5 border-t border-zinc-100 pt-3">
                  <h4 className="font-serif font-bold text-xs text-zinc-900">{te.author}</h4>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400">{te.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. Call To Action ── */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center space-y-10">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FAF8F0] border border-[#D4AF37]/20 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
            Begin Your Regal Journey
          </span>
          <h2 className="text-3xl md:text-6xl font-serif text-zinc-900">Experience Timeless Splendor</h2>
          <p className="max-w-lg mx-auto text-xs md:text-sm text-zinc-500 font-light">
            Book your stay, reserve your banquet venue, or register into our fine dining waitlist catalogue directly to experience unmatched heritage grandeur.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link
            href="/rooms"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#AE963C] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Book Your Stay <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/banquets"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37] bg-white px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-[#D4AF37] hover:bg-[#FAF8F0] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Reserve Banquet
          </Link>
          <Link
            href="/restaurant/waitlist"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-zinc-900 bg-zinc-900 px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-zinc-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Reserve Table
          </Link>
        </div>
      </section>

    </div>
  );
}
