'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import { QrCode, Car, Bell } from 'lucide-react';
import { useQrStore } from '@/stores/qr';
import { useRouter } from 'next/navigation';

export function DigitalConcierge() {
  const router = useRouter();
  const openScanner = useQrStore((s) => s.openScanner);

  return (
    <section className="bg-page-black py-32 md:py-48 px-6 text-page-ivory">
      <div className="max-w-7xl mx-auto space-y-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center flex flex-col items-center"
        >
          <motion.span variants={fadeUp} className="text-[10px] md:text-xs font-bold text-page-gold uppercase tracking-[0.25em]">
            INSTANT RETRIEVAL & REQUESTS
          </motion.span>
          <motion.h2 variants={fadeUp} className="mt-6 text-4xl md:text-5xl font-serif text-page-ivory">
            Digital Guest Concierge
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-8 max-w-md mx-auto text-sm text-page-ivory/70 font-light leading-relaxed">
            Request room check-in validation, order gourmet food delivery, or request your valet vehicle retrieval with a single touch.
          </motion.p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left"
        >
          <motion.div
            variants={fadeUp}
            onClick={() => openScanner()}
            className="group p-12 border border-page-ivory/5 bg-page-ivory/[0.02] transition-all duration-300 cursor-pointer flex flex-col items-start h-full hover:-translate-y-[2px] shadow-sm hover:shadow-luxury hover:border-page-gold/20 will-change-transform"
          >
            <div className="h-12 w-12 bg-page-gold/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 will-change-transform mb-10">
              <QrCode strokeWidth={1.5} className="h-6 w-6 text-page-gold" />
            </div>
            <h3 className="font-serif text-2xl tracking-wide text-page-ivory mb-4 group-hover:text-page-gold transition-colors duration-300">Verify Stay QR</h3>
            <p className="text-sm text-page-ivory/60 font-light leading-relaxed">
              Scan the dynamic code placed inside your suite or table to authenticate and start room billing.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            onClick={() => router.push('/valet-tracking')}
            className="group p-12 border border-page-ivory/5 bg-page-ivory/[0.02] transition-all duration-300 cursor-pointer flex flex-col items-start h-full hover:-translate-y-[2px] shadow-sm hover:shadow-luxury hover:border-page-gold/20 will-change-transform"
          >
            <div className="h-12 w-12 bg-page-gold/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 will-change-transform mb-10">
              <Car strokeWidth={1.5} className="h-6 w-6 text-page-gold" />
            </div>
            <h3 className="font-serif text-2xl tracking-wide text-page-ivory mb-4 group-hover:text-page-gold transition-colors duration-300">Valet Car Request</h3>
            <p className="text-sm text-page-ivory/60 font-light leading-relaxed">
              Provide your vehicle parking token code to request instant retrieval by our specialized valet staff.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            onClick={() => router.push('/services')}
            className="group p-12 border border-page-ivory/5 bg-page-ivory/[0.02] transition-all duration-300 cursor-pointer flex flex-col items-start h-full hover:-translate-y-[2px] shadow-sm hover:shadow-luxury hover:border-page-gold/20 will-change-transform"
          >
            <div className="h-12 w-12 bg-page-gold/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 will-change-transform mb-10">
              <Bell strokeWidth={1.5} className="h-6 w-6 text-page-gold" />
            </div>
            <h3 className="font-serif text-2xl tracking-wide text-page-ivory mb-4 group-hover:text-page-gold transition-colors duration-300">Staff Assistance</h3>
            <p className="text-sm text-page-ivory/60 font-light leading-relaxed">
              Call room maintenance, report issues, or demand towels and room cleaning quickly via our ticket panel.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
