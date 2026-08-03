'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import { Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: "An absolute masterpiece of hospitality. The attention to detail in the royal suites made us feel like true royalty. Unforgettable.",
    author: "Elena R.",
    title: "Global Traveler"
  },
  {
    quote: "From the majestic banquets to the incredible dining experience, The Page sets a new benchmark for luxury in the region.",
    author: "James M.",
    title: "Business Executive"
  },
  {
    quote: "The seamless digital concierge was a delightful touch. Everything we needed was instantly available while maintaining the heritage charm.",
    author: "Aanya P.",
    title: "Wedding Guest"
  }
];

export function Testimonials() {
  return (
    <section className="bg-page-cream py-32 md:py-48 px-6">
      <div className="max-w-7xl mx-auto space-y-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center flex flex-col items-center"
        >
          <motion.span variants={fadeUp} className="text-[10px] md:text-xs font-bold text-page-gold uppercase tracking-[0.25em]">
            GUEST STORIES
          </motion.span>
          <motion.h2 variants={fadeUp} className="mt-6 text-4xl md:text-5xl font-serif text-page-black">
            Words of Prestige
          </motion.h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {TESTIMONIALS.map((t, idx) => (
            <motion.div
              key={idx}
              variants={fadeUp}
              className="group bg-page-ivory p-12 flex flex-col h-full border border-page-black/5 relative transition-all duration-300 hover:-translate-y-[2px] shadow-sm hover:shadow-luxury-hover will-change-transform"
            >
              <div className="absolute top-8 left-10 text-page-gold/20 font-serif text-6xl leading-none select-none transition-colors duration-300 group-hover:text-page-gold/30">
                &ldquo;
              </div>
              <div className="flex gap-1 mb-8 relative z-10 pl-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-page-gold text-page-gold" />
                ))}
              </div>
              <p className="flex-1 text-sm md:text-base font-serif italic text-page-black/80 leading-relaxed relative z-10 pl-2">
                &quot;{t.quote}&quot;
              </p>
              <div className="mt-10 pt-8 border-t border-page-black/5 relative z-10 pl-2">
                <p className="font-bold text-xs uppercase tracking-widest text-page-black">{t.author}</p>
                <p className="text-[10px] uppercase tracking-widest text-page-black/40 mt-1">{t.title}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
