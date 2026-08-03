'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    question: "What time is check-in and check-out?",
    answer: "Check-in is from 2:00 PM, and check-out is until 12:00 PM. Early check-in or late check-out is subject to availability and may incur additional charges."
  },
  {
    question: "Is valet parking available?",
    answer: "Yes, we offer complimentary 24/7 secure valet parking for all our guests. You can request your vehicle directly through our digital concierge."
  },
  {
    question: "Do you offer airport transfers?",
    answer: "Yes, luxury airport transfers can be arranged through our concierge team. We offer a fleet of premium sedans and SUVs for your comfort."
  },
  {
    question: "How does the digital in-room dining work?",
    answer: "Each room features a unique QR code. Simply scan it with your mobile device to browse our menus, place orders, and have culinary masterpieces delivered to your door."
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-page-ivory py-32 md:py-48 px-6">
      <div className="max-w-4xl mx-auto space-y-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center flex flex-col items-center"
        >
          <motion.span variants={fadeUp} className="text-[10px] md:text-xs font-bold text-page-gold uppercase tracking-[0.25em]">
            ESSENTIAL INFORMATION
          </motion.span>
          <motion.h2 variants={fadeUp} className="mt-6 text-4xl md:text-5xl font-serif text-page-black">
            Frequently Asked
          </motion.h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="space-y-4"
        >
          {FAQS.map((faq, idx) => (
            <motion.div key={idx} variants={fadeUp} className="border-b border-page-black/10">
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="w-full flex items-center justify-between py-8 px-4 text-left group hover:bg-page-black/[0.02] transition-colors duration-300"
              >
                <span className="font-serif text-lg md:text-xl text-page-black group-hover:text-page-gold transition-colors duration-300">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-page-gold transition-transform duration-500 ${
                    openIndex === idx ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden px-4"
                  >
                    <p className="pb-8 text-sm text-page-black/60 font-light leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
