'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import Link from 'next/link';
import NextImage from 'next/image';

export function CTA() {
  return (
    <section className="relative py-32 md:py-48 px-6 overflow-hidden flex items-center justify-center min-h-[70vh]">
      <NextImage
        src="/hotel1.png"
        alt="The Page Exterior"
        fill
        sizes="100vw"
        className="object-cover brightness-[0.4]"
      />
      <div className="absolute inset-0 bg-page-black/60" />
      
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="relative z-10 max-w-3xl text-center space-y-8 flex flex-col items-center"
      >
        <motion.span variants={fadeUp} className="text-[10px] md:text-xs font-bold text-page-gold uppercase tracking-[0.3em]">
          YOUR JOURNEY BEGINS HERE
        </motion.span>
        <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-serif text-page-ivory leading-tight">
          Experience the extraordinary at The Page.
        </motion.h2>
        <motion.div variants={fadeUp} className="pt-8">
          <Link href="/rooms" className="group bg-page-gold px-12 py-5 text-xs font-bold uppercase tracking-widest text-page-ivory transition-all duration-300 hover:-translate-y-[2px] shadow-luxury hover:shadow-luxury-hover inline-block will-change-transform">
            Book Your Stay
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
