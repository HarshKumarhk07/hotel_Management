'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import NextImage from 'next/image';
import { Sparkles, Compass, Award, Shield } from 'lucide-react';

const AMENITIES = [
  {
    title: "Royal Wellness Spa",
    desc: "Rejuvenate your body and mind with authentic Ayurvedic therapies, steam rooms, and restorative body treatments.",
    icon: <Sparkles strokeWidth={1.5} className="h-6 w-6 text-page-gold" />,
    badge: "SPA & SALON"
  },
  {
    title: "Azure Pool Cabanas",
    desc: "Relax by our temperature-controlled pool, complete with private luxury cabanas and poolside refreshments.",
    icon: <Compass strokeWidth={1.5} className="h-6 w-6 text-page-gold" />,
    badge: "RECREATION"
  },
  {
    title: "Imperial Boardrooms",
    desc: "Conduct distinguished business meetings in high-tech corporate spaces with private butler services.",
    icon: <Award strokeWidth={1.5} className="h-6 w-6 text-page-gold" />,
    badge: "CONFERENCES"
  },
  {
    title: "Secure Valet & Guard",
    desc: "Enjoy complete peace of mind with 24/7 security surveillance and round-the-clock secure valet parking.",
    icon: <Shield strokeWidth={1.5} className="h-6 w-6 text-page-gold" />,
    badge: "SERVICES"
  }
];

export function Amenities() {
  return (
    <section id="amenities" className="relative py-32 md:py-48 px-6 overflow-hidden bg-page-black">
      {/* Subtle Background Parallax Image with Dark Overlay */}
      <div className="absolute inset-0 z-0">
        <NextImage
          src="/abt2.png"
          alt="Amenities background"
          fill
          sizes="100vw"
          className="object-cover brightness-[0.2]"
        />
        <div className="absolute inset-0 bg-page-black/70" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center flex flex-col items-center"
        >
          <motion.span variants={fadeUp} className="text-[10px] md:text-xs font-bold text-page-gold uppercase tracking-[0.25em]">
            WORLD-CLASS OFFERINGS
          </motion.span>
          <motion.h2 variants={fadeUp} className="mt-6 text-4xl md:text-5xl font-serif text-page-ivory">
            Palace Amenities
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-8 max-w-md mx-auto text-sm text-page-ivory/70 font-light leading-relaxed">
            Indulge in premium services and facilities, crafted to exceed imperial expectations.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {AMENITIES.map((amenity, idx) => (
            <motion.div
              key={idx}
              variants={fadeUp}
              className="group flex flex-col justify-between border border-page-ivory/5 bg-page-black/40 backdrop-blur-md p-10 hover:bg-page-black/60 transition-all duration-300 hover:-translate-y-[2px] hover:shadow-luxury text-left h-full will-change-transform"
            >
              <div className="space-y-10">
                <div className="flex items-center justify-between">
                  <div className="group-hover:rotate-[3deg] transition-transform duration-500 will-change-transform">
                    {amenity.icon}
                  </div>
                  <span className="text-[8px] font-bold text-page-ivory/40 uppercase tracking-widest border border-page-ivory/10 px-3 py-1">
                    {amenity.badge}
                  </span>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xl font-serif font-medium text-page-ivory tracking-wide group-hover:text-page-gold transition-colors duration-300">
                    {amenity.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-page-ivory/60 font-light">
                    {amenity.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
