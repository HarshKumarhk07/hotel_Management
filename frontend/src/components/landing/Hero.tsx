'use client';

import { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const HERO_IMAGES = [
  { url: '/hotel1.png', alt: 'The Page Exterior' },
  { url: '/abt1.png', alt: 'Signature Suite' },
  { url: '/abt2.png', alt: 'Pool Side' },
  { url: '/dining-banner.png', alt: 'Fine Dining' },
  { url: '/bnk2.png', alt: 'Royal Banquet' }
];

interface HeroProps {
  onScrollToAbout: () => void;
}

export function Hero({ onScrollToAbout }: HeroProps) {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger the staggered entry animation after initial mount
    const loadTimer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearInterval(timer);
      } else {
        timer = setInterval(() => {
          setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length);
        }, 8000); // 8 seconds per image
      }
    };

    if (document.visibilityState === 'visible') {
      timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length);
      }, 8000);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <section className="relative h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-page-black">
      {/* Preload images to avoid flash */}
      <div className="hidden">
        {HERO_IMAGES.map((img, idx) => (
          <NextImage key={`preload-${idx}`} src={img.url} alt="preload" width={100} height={100} priority={idx <= 1} />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }} // 1.5s Crossfade
          className="absolute inset-0 w-full h-full will-change-[opacity]"
        >
          {/* Subtle slow zoom in (scale 1 to 1.08) over 10s */}
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: 1.08 }}
            transition={{ duration: 10, ease: 'linear' }}
            className="w-full h-full will-change-transform"
          >
            <NextImage
              src={HERO_IMAGES[currentSlide].url}
              alt={HERO_IMAGES[currentSlide].alt}
              fill
              priority // Always priority for the active slide
              className="object-cover"
              sizes="100vw"
              quality={100} // Ensure highest quality
            />
          </motion.div>
          {/* Adaptive overlay to preserve lighting but ensure readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-page-black/40 via-page-black/10 to-page-black/80 pointer-events-none mix-blend-overlay" />
          <div className="absolute inset-0 bg-black/30 pointer-events-none backdrop-blur-[2px]" />
        </motion.div>
      </AnimatePresence>

      {/* Hero Content Overlay (Fixed, Staggered Load) */}
      <div className="relative z-10 w-full max-w-5xl px-6 text-center flex flex-col items-center">
        
        <AnimatePresence>
          {isLoaded && (
            <>
              <motion.h1
                initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1.4, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                className="text-5xl sm:text-7xl md:text-8xl lg:text-[10rem] font-serif tracking-widest leading-none text-white mb-6 drop-shadow-2xl uppercase"
                style={{ textShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
              >
                THE PAGE
              </motion.h1>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                className="space-y-4 mb-12 relative"
              >
                <div className="absolute -inset-x-8 -inset-y-4 bg-black/20 blur-2xl rounded-full z-0 pointer-events-none" />
                <p className="relative z-10 max-w-2xl mx-auto text-xs sm:text-sm md:text-base font-medium tracking-[0.2em] text-page-ivory/90 uppercase drop-shadow-lg">
                  Where timeless elegance meets exceptional hospitality.
                </p>
                <p className="relative z-10 max-w-2xl mx-auto text-xs sm:text-sm font-light tracking-widest text-page-ivory/70 drop-shadow-md">
                  Discover refined stays, curated dining, and unforgettable experiences.
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex items-center justify-center w-full"
              >
                <button
                  onClick={() => router.push('/rooms')}
                  className="group relative overflow-hidden bg-page-gold px-12 py-5 text-xs font-bold uppercase tracking-widest text-page-black transition-all duration-300 hover:scale-105 shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:shadow-[0_0_60px_rgba(212,175,55,0.6)] w-full sm:w-auto"
                >
                  <span className="relative z-10">Book Your Stay</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Luxury Floating Concierge Link / Scroll Indicator */}
      <AnimatePresence>
        {isLoaded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 2.0 }}
            className="absolute bottom-10 left-0 right-0 z-10 flex flex-col items-center justify-center text-center text-page-ivory/50"
          >
            <span className="text-[8px] font-extrabold tracking-[0.3em] uppercase mb-4">
              Scroll
            </span>
            <motion.div
              animate={{ y: [0, 8, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="h-12 w-[1px] bg-gradient-to-b from-page-ivory/60 to-transparent"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
