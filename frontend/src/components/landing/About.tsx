'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function About() {
  return (
    <section id="about" className="bg-page-ivory py-32 md:py-48 px-6">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="max-w-3xl mx-auto text-center flex flex-col items-center"
      >
        <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl lg:text-6xl font-serif text-page-black leading-tight">
          A Symphony of Regal Grandeur<br />
          <span className="font-serif italic text-page-gold">&amp; Timeless Elegance</span>
        </motion.h2>

        <motion.p variants={fadeUp} className="max-w-xl mt-12 text-sm md:text-base leading-relaxed text-page-black/70 font-light">
          Welcome to The Page — where regal grandeur and timeless elegance converge to create an experience beyond imagination. Nestled in the heart of heritage, our palace stands as a magnificent testament to the art of refined living.
        </motion.p>

        <motion.p variants={fadeUp} className="max-w-lg mt-6 text-xs md:text-sm text-page-black/50 font-light">
          Every courtyard celebrates tradition. Every chamber embodies grace, glory, and the promise of memories that last a lifetime.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-16 flex flex-col sm:flex-row justify-center items-center gap-6 w-full sm:w-auto">
          <Link href="/rooms" className="group bg-page-gold px-10 py-4 text-[10px] font-bold uppercase tracking-widest text-page-ivory transition-all duration-300 hover:-translate-y-[2px] shadow-luxury hover:shadow-luxury-hover w-full sm:w-auto text-center will-change-transform">
            Reserve Your Royal Suite
          </Link>
          <Link href="#rooms" className="group px-10 py-4 text-[10px] font-bold uppercase tracking-widest text-page-gold border border-page-gold/30 hover:border-page-gold hover:-translate-y-[2px] hover:bg-page-gold/5 transition-all duration-300 w-full sm:w-auto text-center will-change-transform">
            Discover Our Legacy
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
