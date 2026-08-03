'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import NextImage from 'next/image';
import Link from 'next/link';

const ROOMS_DATA = [
  {
    id: 1,
    tag: "ACCOMMODATION",
    title: "Royal Suites & Chambers",
    desc: "From intimate heritage rooms to sprawling royal suites, each space tells a story of tradition, craftsmanship, and uncompromising comfort.",
    img: "/abt1.png",
    actionText: "View Chambers →",
    href: '/rooms'
  },
  {
    id: 2,
    tag: "WEDDINGS & EVENTS",
    title: "Majestic Celebrations",
    desc: "Choose from grand ballrooms, heritage courtyards, and palace gardens. Each venue transforms your special moments into legendary celebrations.",
    img: "/bnk2.png",
    actionText: "Explore Venues →",
    href: '/banquets'
  },
  {
    id: 3,
    tag: "FINE DINING",
    title: "Culinary Excellence",
    desc: "Our master chefs present a symphony of flavors—from royal Awadhi cuisine to contemporary international gastronomy.",
    img: "/dining-banner.png",
    actionText: "Reserve Table →",
    href: '/restaurant/waitlist'
  }
];

export function Rooms() {
  return (
    <section id="rooms" className="bg-white py-32 md:py-48 px-6">
      <div className="max-w-7xl mx-auto space-y-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="text-center flex flex-col items-center"
        >
          <motion.span variants={fadeUp} className="text-[10px] md:text-xs font-bold text-page-gold uppercase tracking-[0.25em]">
            CURATED FOR ROYALTY
          </motion.span>
          <motion.h2 variants={fadeUp} className="mt-6 text-4xl md:text-5xl font-serif text-page-black">
            Signature Experiences
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-8 max-w-md mx-auto text-sm text-page-black/60 font-light leading-relaxed">
            Immerse yourself in a world where every detail is crafted to perfection, creating memories of unparalleled luxury.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-10"
        >
          {ROOMS_DATA.map((card) => (
            <motion.div key={card.id} variants={fadeUp}>
              <Link href={card.href} className="group flex flex-col h-full overflow-hidden bg-page-ivory transition-all duration-300 hover:-translate-y-[2px] shadow-sm hover:shadow-luxury will-change-transform">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <NextImage
                    src={card.img}
                    alt={card.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-1000 ease-[0.25,0.1,0.25,1] group-hover:scale-105 will-change-transform"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-page-black/70 via-page-black/5 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="absolute bottom-6 left-8 right-8 text-center md:text-left">
                    <span className="text-[9px] font-bold text-page-gold uppercase tracking-[0.25em]">
                      {card.tag}
                    </span>
                    <h3 className="mt-2 text-xl md:text-2xl font-serif text-page-ivory font-medium tracking-wide">
                      {card.title}
                    </h3>
                  </div>
                </div>
                <div className="p-8 md:p-10 flex-1 flex flex-col justify-between space-y-8">
                  <p className="text-sm text-page-black/60 font-light leading-relaxed">
                    {card.desc}
                  </p>
                  <div className="text-[10px] font-bold text-page-gold uppercase tracking-widest flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-2 will-change-transform">
                    {card.actionText}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
