'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import NextImage from 'next/image';

const GALLERY_IMAGES = [
  { url: '/hotel1.png', aspect: 'aspect-[3/4]', alt: 'Hotel Facade' },
  { url: '/dining-banner.png', aspect: 'aspect-[4/3]', alt: 'Dining Experience' },
  { url: '/abt1.png', aspect: 'aspect-square', alt: 'Luxury Suite' },
  { url: '/bnk2.png', aspect: 'aspect-[16/9]', alt: 'Banquet Hall' },
  { url: '/abt2.png', aspect: 'aspect-square', alt: 'Pool Side' },
];

export function Gallery() {
  return (
    <section className="bg-page-ivory py-32 md:py-48 px-6">
      <div className="max-w-7xl mx-auto space-y-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center flex flex-col items-center"
        >
          <motion.span variants={fadeUp} className="text-[10px] md:text-xs font-bold text-page-gold uppercase tracking-[0.25em]">
            A GLIMPSE OF GRANDEUR
          </motion.span>
          <motion.h2 variants={fadeUp} className="mt-6 text-4xl md:text-5xl font-serif text-page-black">
            The Palace Gallery
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-8 max-w-md mx-auto text-sm text-page-black/60 font-light leading-relaxed">
            Wander through moments of elegance. A visual journey into the heart of The Page.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="columns-1 sm:columns-2 lg:columns-3 gap-8 space-y-8"
        >
          {GALLERY_IMAGES.map((img, idx) => (
            <motion.div
              key={idx}
              variants={fadeUp}
              className={`relative w-full overflow-hidden break-inside-avoid bg-page-cream group transition-all duration-300 hover:-translate-y-[2px] hover:shadow-luxury will-change-transform ${img.aspect}`}
            >
              <NextImage
                src={img.url}
                alt={img.alt}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-1000 ease-[0.25,0.1,0.25,1] group-hover:scale-105 will-change-transform"
              />
              <div className="absolute inset-0 bg-page-black/0 group-hover:bg-page-black/10 transition-colors duration-500 pointer-events-none" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
