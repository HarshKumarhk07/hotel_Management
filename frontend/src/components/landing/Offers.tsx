'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import Link from 'next/link';

const OFFERS = [
  {
    title: "Advance Purchase",
    desc: "Book your stay 14 days in advance and enjoy up to 20% off our best available rates.",
    link: "/rooms"
  },
  {
    title: "Suite Indulgence",
    desc: "Experience our royal suites with complimentary breakfast, spa credits, and late checkout.",
    link: "/rooms"
  },
  {
    title: "Weekend Getaway",
    desc: "Escape the ordinary with our weekend package including curated dining experiences.",
    link: "/restaurant/waitlist"
  }
];

export function Offers() {
  return (
    <section className="bg-white py-32 md:py-48 px-6">
      <div className="max-w-7xl mx-auto space-y-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="flex flex-col md:flex-row justify-between items-end gap-8"
        >
          <div className="text-left max-w-2xl">
            <motion.span variants={fadeUp} className="text-[10px] md:text-xs font-bold text-page-gold uppercase tracking-[0.25em]">
              EXCLUSIVE OFFERS
            </motion.span>
            <motion.h2 variants={fadeUp} className="mt-6 text-4xl md:text-5xl font-serif text-page-black">
              Curated Privileges
            </motion.h2>
          </div>
          <motion.div variants={fadeUp}>
            <Link href="/rooms" className="text-[10px] font-bold text-page-gold uppercase tracking-widest hover:text-page-gold-dark transition-colors border-b border-page-gold pb-1">
              View All Offers
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {OFFERS.map((offer, idx) => (
            <motion.div
              key={idx}
              variants={fadeUp}
              className="group p-12 border border-page-black/5 bg-page-ivory transition-all duration-300 flex flex-col justify-between h-full will-change-transform hover:-translate-y-[2px] shadow-sm hover:shadow-luxury-hover"
            >
              <div>
                <h3 className="font-serif text-2xl text-page-black mb-6 group-hover:text-page-gold transition-colors duration-300">{offer.title}</h3>
                <p className="text-sm text-page-black/60 font-light leading-relaxed">
                  {offer.desc}
                </p>
              </div>
              <div className="mt-12">
                <Link href={offer.link} className="text-[10px] font-bold text-page-gold uppercase tracking-widest flex items-center gap-2 group-hover:translate-x-2 transition-transform duration-300 will-change-transform">
                  Discover More →
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
