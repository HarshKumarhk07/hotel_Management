'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  UtensilsCrossed,
  Star,
  Car,
  QrCode,
  Bell,
  Sparkles,
  Shield,
  Zap,
  Clock,
  User,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Compass,
  Award,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
} from 'lucide-react';
import jsQR from 'jsqr';
import { QrScanner } from '@/components/qr/QrScanner';
import { Dialog } from '@/components/ui/dialog';
import { FoodLabel } from '@/components/ui/primitives';
import { ProductCardSkeleton, ProductError, ProductEmptyState } from '@/components/ui/ProductSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import type { PublicMenu } from '@/lib/types';

interface PublicKitchen {
  id: string;
  name: string;
  slug: string;
}

export default function HomePage() {
  const router = useRouter();

  const HERO_IMAGES = [
    { url: '/hotel1.png', tag: 'EXPERIENCE GRAND LUXURY', title: 'THE PAGE', subtitle: 'Heritage Splendor · Curated Dining · Royal Comfort' },
    { url: '/dining-banner.png', tag: 'CULINARY ARTISTRY', title: 'FINE DINING', subtitle: 'Authentic Flavors and Exquisite Gastronomy' },
    { url: '/bnk2.png', tag: 'MAJESTIC CELEBRATIONS', title: 'ROYAL BANQUETS', subtitle: 'Crafting Weddings and Events of Distinction' },
    { url: '/abt2.png', tag: 'A HAVEN OF SPLENDOR', title: 'SUITES & CHAMBERS', subtitle: 'Unrivaled Comfort and Timeless Hospitality' }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto slide-show rotation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Auto-open QR scanner if requested in query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scan') === 'true') {
      setScannerOpen(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load kitchens & featured menu for the dining overlay
  const {
    data: kitchens,
    isLoading: isLoadingKitchens,
    isError: isErrorKitchens,
    refetch: refetchKitchens,
  } = useQuery({
    queryKey: ['public-kitchens'],
    queryFn: async () =>
      (await api.get<{ data: { kitchens: PublicKitchen[] } }>('/kitchens/public')).data.data.kitchens,
  });
  const featuredKitchen = kitchens?.[0];
  const {
    data: menu,
    isLoading: isLoadingMenu,
    isError: isErrorMenu,
    refetch: refetchMenu,
  } = useQuery({
    queryKey: ['public-menu', featuredKitchen?.id],
    enabled: !!featuredKitchen,
    queryFn: async () =>
      (await api.get<{ data: PublicMenu }>(`/menu/public/${featuredKitchen!.id}`)).data.data,
  });
  const featured = (menu?.categories.flatMap((c) => c.items) ?? [])
    .filter((i) => i.isFeatured)
    .slice(0, 8);
  const fullMenuHref = featuredKitchen ? `/k/${featuredKitchen.id}` : '/';

  const processDecoded = useCallback(
    (data: string) => {
      let token = data.trim();
      if (token.includes('/r/')) {
        const parts = token.split('/r/');
        token = parts[parts.length - 1].split(/[?#]/)[0];
      }
      if (!token) {
        setError('Invalid QR code. Please scan a valid room/table QR code.');
        setScannerOpen(false);
        return;
      }
      router.push(`/r/${encodeURIComponent(token)}`);
    },
    [router],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            setError('Could not initialize the image reader.');
            setProcessing(false);
            return;
          }
          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0, img.width, img.height);

          const imageData = context.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            processDecoded(code.data);
          } else {
            setError('No valid QR code found in this image. Please make sure the QR code is clear.');
            setProcessing(false);
          }
        } catch {
          setError('Failed to process the image. Please try again.');
          setProcessing(false);
        }
      };
      img.onerror = () => {
        setError('Failed to load image file.');
        setProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setProcessing(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleScrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] text-zinc-800 font-sans selection:bg-[#D4AF37]/20 selection:text-[#AE963C]">
      {/* Import Premium Serif Font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Outfit:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      {/* ── Navbar Layout ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10 transition-all duration-300">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          {/* Left Side: Logo and Brand Title */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 transition-all duration-300 group-hover:bg-white/25">
              <NextImage
                src="/logo.png"
                alt="The Page Logo"
                width={40}
                height={40}
                className="h-full w-full object-contain p-1.5"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold tracking-[0.25em] text-[#D4AF37] font-serif uppercase leading-none">
                THE PAGE
              </span>
              <span className="text-[7px] font-semibold tracking-[0.3em] text-white/60 uppercase mt-1">
                LUXURY HOTEL
              </span>
            </div>
          </Link>

          {/* Center: Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">
              Home
            </button>
            <button onClick={() => router.push('/rooms')} className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">
              Rooms
            </button>
            <button onClick={() => router.push('/banquets')} className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">
              Banquet
            </button>
            <button onClick={() => router.push('/restaurant/waitlist')} className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">
              Restaurant
            </button>
            <button onClick={() => handleScrollToSection('amenities')} className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">
              Amenities
            </button>
            <button onClick={() => router.push('/about')} className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">
              About
            </button>
          </nav>

          {/* Right Side: Scan QR & Login */}
          <nav className="hidden lg:flex items-center gap-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
            <button onClick={() => setScannerOpen(true)} className="hover:text-[#D4AF37] transition-colors text-[#D4AF37] border border-[#D4AF37] px-4 py-2 rounded-full hover:bg-[#D4AF37]/15 transition-all">
              Scan QR
            </button>
            <Link href="/login" className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">
              Login
            </Link>
          </nav>

          {/* Mobile Menu Action */}
          <div className="lg:hidden flex items-center gap-4">
            <button
              onClick={() => setScannerOpen(true)}
              className="text-[#D4AF37] border border-[#D4AF37] text-[10px] font-extrabold tracking-wider uppercase px-3 py-1.5 rounded-full"
            >
              Scan QR
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-[#D4AF37] transition-colors p-1"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-zinc-950 border-b border-white/10 px-6 py-6 space-y-4 flex flex-col text-[11px] font-extrabold uppercase tracking-[0.2em]"
            >
              <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMobileMenuOpen(false); }} className="text-white hover:text-[#D4AF37] text-left">
                Home
              </button>
              <button onClick={() => { router.push('/rooms'); setMobileMenuOpen(false); }} className="text-white hover:text-[#D4AF37] text-left">
                Rooms
              </button>
              <button onClick={() => { router.push('/banquets'); setMobileMenuOpen(false); }} className="text-white hover:text-[#D4AF37] text-left">
                Banquet
              </button>
              <button onClick={() => { router.push('/restaurant/waitlist'); setMobileMenuOpen(false); }} className="text-white hover:text-[#D4AF37] text-left">
                Restaurant
              </button>
              <button onClick={() => { handleScrollToSection('amenities'); setMobileMenuOpen(false); }} className="text-white hover:text-[#D4AF37] text-left">
                Amenities
              </button>
              <button onClick={() => { router.push('/about'); setMobileMenuOpen(false); }} className="text-white hover:text-[#D4AF37] text-left">
                About
              </button>
              <Link href="/login" className="text-white hover:text-[#D4AF37] text-left">
                Login
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Main Layout Sections ── */}
      <main className="flex-1">
        <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0 w-full h-full"
            >
              <NextImage
                src={HERO_IMAGES[currentSlide].url}
                alt={HERO_IMAGES[currentSlide].title}
                fill
                priority
                className="object-cover brightness-[0.5]"
              />
            </motion.div>
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/50 pointer-events-none" />

          {/* Left & Right Interactive Arrows */}
          <button
            onClick={() => setCurrentSlide((prev) => (prev - 1 + HERO_IMAGES.length) % HERO_IMAGES.length)}
            className="absolute left-2 md:left-6 z-20 flex h-9 w-9 md:h-12 md:w-12 items-center justify-center border border-white/20 bg-black/30 hover:bg-[#D4AF37] hover:border-[#D4AF37] text-white backdrop-blur-md transition-all duration-300 active:scale-95"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="h-4 w-4 md:h-6 md:w-6" />
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length)}
            className="absolute right-2 md:right-6 z-20 flex h-9 w-9 md:h-12 md:w-12 items-center justify-center border border-white/20 bg-black/30 hover:bg-[#D4AF37] hover:border-[#D4AF37] text-white backdrop-blur-md transition-all duration-300 active:scale-95"
            aria-label="Next Slide"
          >
            <ChevronRight className="h-4 w-4 md:h-6 md:w-6" />
          </button>
 
          {/* Hero Content Overlay */}
          <div className="relative z-10 max-w-4xl px-8 text-center space-y-6 text-white mt-12">
            <motion.span
              key={`tag-${currentSlide}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-block text-[9px] md:text-xs font-bold uppercase tracking-[0.3em] text-[#D4AF37] border-b border-[#D4AF37]/30 pb-2"
            >
              {HERO_IMAGES[currentSlide].tag}
            </motion.span>
            <motion.h1
              key={`title-${currentSlide}`}
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-3xl sm:text-5xl md:text-8xl font-serif tracking-[0.05em] leading-tight uppercase font-medium text-white"
            >
              {HERO_IMAGES[currentSlide].title}
            </motion.h1>
            <motion.p
              key={`sub-${currentSlide}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="max-w-xl mx-auto text-xs md:text-sm font-light tracking-[0.2em] uppercase text-zinc-300"
            >
              {HERO_IMAGES[currentSlide].subtitle}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="pt-4"
            >
              <button
                onClick={() => handleScrollToSection('about')}
                className="border border-[#D4AF37]/50 bg-black/40 hover:bg-[#D4AF37]/10 backdrop-blur-sm px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-[#D4AF37] transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                Discover the Legacy
              </button>
            </motion.div>
          </div>

          {/* Indicator Dot Navigation */}
          <div className="absolute bottom-24 left-0 right-0 z-20 flex justify-center gap-2">
            {HERO_IMAGES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 transition-all duration-300 ${currentSlide === idx ? 'w-8 bg-[#D4AF37]' : 'w-2 bg-white/40'}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Luxury Floating Concierge Link */}
          <div className="absolute bottom-8 left-0 right-0 z-10 flex flex-col items-center justify-center text-center text-white/90">
            <span className="text-[9px] font-extrabold tracking-[0.3em] uppercase mb-1 animate-bounce">
              Scroll Down to Explore
            </span>
            <div className="h-6 w-[1px] bg-white/20" />
          </div>
        </section>

        {/* Section 2: Heritage Introduction Banner */}
        <section id="about" className="bg-[#FAF9F6] py-20 px-6 border-b border-zinc-200">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.8, ease: "easeOut", staggerChildren: 0.15 }
              }
            }}
            className="max-w-4xl mx-auto text-center space-y-6"
          >
            <motion.h2 variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="text-4xl md:text-6xl font-serif text-[#111111] leading-tight">
              A Symphony of Regal Grandeur<br />
              <span className="font-serif italic text-[#D4AF37]">&amp; Timeless Elegance</span>
            </motion.h2>

            <motion.p variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="max-w-2xl mx-auto text-sm md:text-base leading-relaxed text-[#666666] font-light">
              Welcome to The Page — a world where regal grandeur, timeless elegance, and warm Indian hospitality converge to create an experience beyond imagination. Nestled in the heart of heritage, our palace stands as a magnificent testament to royal architecture, cultural richness, and the art of refined living.
            </motion.p>

            <motion.p variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="max-w-2xl mx-auto text-xs md:text-sm text-[#666666]/80 font-medium">
              Every corridor whispers tales of kings and queens. Every courtyard celebrates art and tradition. Every chamber embodies grace, glory, and the promise of memories that last a lifetime.
            </motion.p>

            <motion.div variants={{ hidden: { opacity: 0, y: 25 }, visible: { opacity: 1, y: 0 } }} className="pt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
              <button
                onClick={() => router.push('/rooms')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#AE963C] transition-all hover:scale-[1.03] active:scale-[0.98]"
              >
                Reserve Your Royal Suite <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleScrollToSection('rooms')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37] bg-white px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-[#D4AF37] hover:bg-[#FAF8F0] transition-all hover:scale-[1.03] active:scale-[0.98]"
              >
                Discover Our Legacy
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* Section 3: Signature Experiences */}
        <section id="rooms" className="bg-white py-24 px-6 border-b border-zinc-200">
          <div className="max-w-7xl mx-auto space-y-16">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
              }}
              className="text-center space-y-3"
            >
              <span className="text-[10px] md:text-xs font-bold text-[#D4AF37] uppercase tracking-[0.25em]">
                CURATED FOR ROYALTY
              </span>
              <h2 className="text-3xl md:text-5xl font-serif text-[#111111]">
                Signature Experiences
              </h2>
              <p className="max-w-lg mx-auto text-xs md:text-sm text-[#666666] font-light">
                Immerse yourself in a world where every detail is crafted to perfection, every moment designed to create lasting memories of unparalleled luxury.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  id: 1,
                  tag: "ACCOMMODATION",
                  title: "Royal Suites & Chambers",
                  desc: "From intimate heritage rooms to sprawling royal suites, each space tells a story of tradition, craftsmanship, and uncompromising comfort.",
                  img: "/abt1.png",
                  actionText: "View Chambers →",
                  onClick: () => router.push('/rooms')
                },
                {
                  id: 2,
                  tag: "WEDDINGS & EVENTS",
                  title: "Majestic Celebrations",
                  desc: "Choose from grand ballrooms, heritage courtyards, and palace gardens. Each venue transforms your special moments into legendary celebrations.",
                  img: "/bnk2.png",
                  actionText: "Explore Venues →",
                  onClick: () => router.push('/banquets')
                },
                {
                  id: 3,
                  tag: "FINE DINING",
                  title: "Culinary Excellence",
                  desc: "Our master chefs present a symphony of flavors—from royal Awadhi cuisine to contemporary international gastronomy.",
                  img: "/dining-banner.png",
                  actionText: "Reserve Table →",
                  onClick: () => router.push('/restaurant/waitlist')
                }
              ].map((card, idx) => (
                <motion.div
                  key={card.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  custom={idx}
                  variants={{
                    hidden: { opacity: 0, y: 40 },
                    visible: (customIndex: number) => ({
                      opacity: 1,
                      y: 0,
                      transition: { delay: customIndex * 0.15, duration: 0.8, ease: "easeOut" }
                    })
                  }}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-[#FAF9F6] shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <NextImage
                      src={card.img}
                      alt={card.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-700 brightness-[0.9]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-5 text-left">
                      <span className="text-[9px] font-bold text-[#D4AF37] uppercase tracking-[0.25em]">
                        {card.tag}
                      </span>
                      <h3 className="text-lg font-serif text-white font-semibold">
                        {card.title}
                      </h3>
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between text-left space-y-4">
                    <p className="text-xs md:text-sm text-[#666666] font-light leading-relaxed">
                      {card.desc}
                    </p>
                    <button
                      onClick={card.onClick}
                      className="text-xs font-bold text-[#D4AF37] hover:text-[#AE963C] flex items-center gap-1 group-hover:translate-x-1.5 transition-transform self-start"
                    >
                      {card.actionText}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Palace Amenities */}
        <section id="amenities" className="relative py-28 px-6 overflow-hidden bg-zinc-950 text-white border-t border-b border-white/5">
          {/* Subtle Background Parallax Image with Dark Overlay */}
          <div className="absolute inset-0 z-0">
            <NextImage
              src="/abt2.png"
              alt="Amenities background pool"
              fill
              className="object-cover brightness-[0.22] scale-105"
            />
            {/* Top and Bottom Vignette to blend the white ceiling of the photo into the dark background */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/40 to-zinc-950" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto space-y-16">
            {/* Title Section */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0, y: 25 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
              }}
              className="text-center space-y-3"
            >
              <span className="text-[10px] md:text-xs font-bold text-[#D4AF37] uppercase tracking-[0.25em]">
                WORLD-CLASS OFFERINGS
              </span>
              <h2 className="text-3xl md:text-5xl font-serif text-white">
                Palace Amenities
              </h2>
              <p className="max-w-lg mx-auto text-xs md:text-sm text-zinc-400 font-light leading-relaxed">
                Indulge in an extraordinary range of premium services and facilities, crafted to ensure your stay exceeds imperial expectations.
              </p>
            </motion.div>

            {/* Grid of Amenities */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Royal Wellness Spa",
                  desc: "Rejuvenate your body and mind with authentic Ayurvedic therapies, steam rooms, and restorative body treatments.",
                  icon: <Sparkles className="h-5 w-5 text-[#D4AF37]" />,
                  badge: "SPA & SALON"
                },
                {
                  title: "Azure Pool Cabanas",
                  desc: "Relax by our temperature-controlled pool, complete with private luxury cabanas and poolside refreshments.",
                  icon: <Compass className="h-5 w-5 text-[#D4AF37]" />,
                  badge: "RECREATION"
                },
                {
                  title: "Imperial Boardrooms",
                  desc: "Conduct distinguished business meetings in high-tech corporate spaces with private butler services.",
                  icon: <Award className="h-5 w-5 text-[#D4AF37]" />,
                  badge: "CONFERENCES"
                },
                {
                  title: "Secure Valet & Guard",
                  desc: "Enjoy complete peace of mind with 24/7 security surveillance and round-the-clock secure valet parking.",
                  icon: <Shield className="h-5 w-5 text-[#D4AF37]" />,
                  badge: "SERVICES"
                }
              ].map((amenity, idx) => (
                <motion.div
                  key={amenity.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  custom={idx}
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: (customIndex: number) => ({
                      opacity: 1,
                      y: 0,
                      transition: { delay: customIndex * 0.1, duration: 0.7, ease: "easeOut" }
                    })
                  }}
                  className="group flex flex-col justify-between rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-md p-6 space-y-4 hover:border-[#D4AF37]/30 hover:bg-zinc-900/60 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(212,175,55,0.08)] transition-all duration-300 text-left"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/40 border border-white/10 group-hover:border-[#D4AF37]/30 transition-colors">
                        {amenity.icon}
                      </div>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest bg-black/20 border border-white/5 px-2 py-0.5 rounded-full">
                        {amenity.badge}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-serif font-semibold text-white tracking-wide group-hover:text-[#D4AF37] transition-colors">
                        {amenity.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-zinc-400 font-light">
                        {amenity.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Grand Banqueting Section */}
        <section id="banquet" className="relative py-32 px-6 overflow-hidden flex items-center">
          <NextImage
            src="/bnk2.png"
            alt="Grand Banqueting ballroom"
            fill
            className="object-cover brightness-[0.75]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 max-w-xl text-left space-y-6 text-white pl-4 md:pl-16"
          >
            <span className="p-3 border border-[#D4AF37]/50 rounded-full bg-black/40 inline-block">
              <Award className="h-6 w-6 text-[#D4AF37]" />
            </span>
            <span className="block text-[10px] md:text-xs font-bold text-[#D4AF37] uppercase tracking-[0.25em]">
              CELEBRATIONS FIT FOR ROYALTY
            </span>
            <h2 className="text-4xl md:text-6xl font-serif text-white leading-tight">
              Grand Banqueting<br />
              <span className="font-serif italic text-[#D4AF37]">&amp; Majestic Events</span>
            </h2>
            <p className="text-xs md:text-sm leading-relaxed text-zinc-300 font-light">
              Choose from majestic courtyards, grand ballrooms, and heritage-inspired banquet halls. Each space is designed with regal architecture, intricate detailing, and luxurious interiors that echo the splendor of a bygone era.
            </p>
            <div className="pt-4 flex flex-wrap gap-4">
              <button
                onClick={() => router.push('/banquets')}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#AE963C] transition-all hover:scale-[1.03] active:scale-[0.98]"
              >
                Explore Venues
              </button>
            </div>
          </motion.div>
        </section>

        {/* Section 6: Digital Dining Showcase */}
        <section id="dining" className="bg-[#FAF9F6] py-24 px-6 border-t border-zinc-200">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-3">
              <span className="text-[10px] md:text-xs font-bold text-[#D4AF37] uppercase tracking-[0.25em]">
                ROYAL DINING AT ROOMS
              </span>
              <h2 className="text-3xl md:text-5xl font-serif text-[#111111]">
                Chef&apos;s Recommendations
              </h2>
              <p className="max-w-lg mx-auto text-xs md:text-sm text-[#666666] font-light">
                Browse our featured gourmet recipes curated by award-winning palace chefs, ready to be delivered straight to your suite or table.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {isLoadingKitchens || (featuredKitchen && isLoadingMenu) ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"
                >
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <ProductCardSkeleton key={idx} />
                  ))}
                </motion.div>
              ) : isErrorKitchens || isErrorMenu ? (
                <motion.div key="error" className="py-8">
                  <ProductError
                    onRetry={() => {
                      if (isErrorKitchens) void refetchKitchens();
                      else void refetchMenu();
                    }}
                  />
                </motion.div>
              ) : featured.length === 0 ? (
                <motion.div key="empty" className="py-8">
                  <ProductEmptyState
                    title="No recommendations currently"
                    description="This kitchen has no featured recommendations logged."
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="products"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.1 }
                    }
                  }}
                  className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"
                >
                  {featured.map((item) => (
                    <motion.div
                      key={item.id}
                      onClick={() => {
                        if (featuredKitchen) {
                          router.push(`/k/${featuredKitchen.id}`);
                        } else {
                          setScannerOpen(true);
                        }
                      }}
                      variants={{
                        hidden: { opacity: 0, y: 25 },
                        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
                      }}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#FAF9F6]">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt={item.name}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[#ECECEC]">
                            <UtensilsCrossed className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-center gap-2">
                          <FoodLabel label={item.foodLabel} />
                          <span className="line-clamp-1 text-sm font-semibold text-zinc-900">
                            {item.name}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-[#666666]">
                          {item.description ?? ''}
                        </p>
                        <span className="mt-auto pt-3 text-sm font-bold text-[#D4AF37]">
                          {formatINR(item.price)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {featuredKitchen && featured.length > 0 && (
              <div className="text-center space-y-4 pt-4">
                <button
                  onClick={() => router.push(`/k/${featuredKitchen.id}`)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37] bg-white px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-[#D4AF37] hover:bg-[#D4AF37] hover:text-white transition-all"
                >
                  <UtensilsCrossed className="h-4 w-4" /> Browse Menu Catalog
                </button>
                <p className="text-[10px] text-[#666666]">
                  * Requires in-room or table QR scan.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Section 7: Quick Concierge Digital Services (Valet retrieval integration) */}
        <section className="bg-zinc-900 py-24 px-6 text-white border-t border-zinc-800">
          <div className="max-w-5xl mx-auto text-center space-y-12">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] border border-[#D4AF37]/30">
                Instant retrieval &amp; requests
              </span>
              <h2 className="text-3xl md:text-5xl font-serif text-white">
                Digital Guest Concierge
              </h2>
              <p className="max-w-md mx-auto text-xs md:text-sm text-zinc-400 font-light">
                Request room check-in validation, order gourmet food delivery, or request your valet vehicle retrieval with one touch.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
              <div
                onClick={() => setScannerOpen(true)}
                className="p-8 border border-white/5 hover:border-[#D4AF37]/50 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer space-y-4"
              >
                <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <h3 className="font-semibold text-sm">Verify Stay QR</h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Scan the dynamic code placed inside your suite or table to authenticate and start room billing.
                </p>
              </div>

              <div
                onClick={() => router.push('/valet-tracking')}
                className="p-8 border border-white/5 hover:border-[#D4AF37]/50 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer space-y-4"
              >
                <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
                  <Car className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <h3 className="font-semibold text-sm">Valet Car Request</h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Provide your vehicle parking token code to request instant retrieval by our valet staff.
                </p>
              </div>

              <div
                onClick={() => router.push('/services')}
                className="p-8 border border-white/5 hover:border-[#D4AF37]/50 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer space-y-4"
              >
                <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <h3 className="font-semibold text-sm">Staff Assistance</h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Call room maintenance, report issues, or demand towels/room cleaning quickly via our ticket panel.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-zinc-950 text-white py-16 px-6 border-t border-white/5 font-sans">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-left">
          <div className="space-y-4">
            <h3 className="text-lg font-serif font-semibold tracking-wider text-[#D4AF37] uppercase">THE PAGE</h3>
            <p className="text-xs text-zinc-400 font-light leading-relaxed">
              Experience the pinnacle of hospitality, heritage grandeur, and Awadhi culinary elegance in the Delhi NCR region.
            </p>
            <div className="flex gap-4 text-[#D4AF37]">
              <span className="text-sm">✦</span>
              <span className="text-sm">✦</span>
              <span className="text-sm">✦</span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Quick Links</h4>
            <div className="flex flex-col gap-2.5 text-xs text-zinc-400 font-light">
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-white transition-colors text-left">Home</button>
              <button onClick={() => router.push('/rooms')} className="hover:text-white transition-colors text-left">Accommodation</button>
              <button onClick={() => router.push('/banquets')} className="hover:text-white transition-colors text-left">Banquets</button>
              <button onClick={() => router.push('/restaurant/waitlist')} className="hover:text-white transition-colors text-left">Dining</button>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Palace Address</h4>
            <div className="space-y-3 text-xs text-zinc-400 font-light">
              <p className="flex items-start gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#D4AF37]" /> Delhi NCR Road, Sector 15, Near Crown Landmark, India</p>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-[#D4AF37]" /> +91 98765 43210</p>
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-[#D4AF37]" /> contact@thepagerohtak.com</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Check-In / Access</h4>
            <p className="text-xs text-zinc-400 font-light leading-relaxed">
              Guests can scan their in-room QR codes to directly access dining ordering and tickets tracking without login.
            </p>
            <button
              onClick={() => setScannerOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] py-3 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#AE963C] transition-all"
            >
              Open Scan Utility
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-white/5 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-500 font-light">
          <p>© {new Date().getFullYear()} The Page. All Rights Reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <Link href="/login?next=/valet" className="hover:text-white transition-colors">Staff Access</Link>
            <span className="text-zinc-700">|</span>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>

      {/* ── Luxury QR Scan Modal / Dialog ── */}
      {scannerOpen && (
        <Dialog open onClose={() => setScannerOpen(false)} title="Palace Digital Access Desk" widthClass="max-w-md">
          <div className="space-y-5 text-center font-sans">
            <p className="text-xs text-zinc-500 font-light leading-relaxed">
              Scan the dynamic QR code in your room or table to authenticate, browse the food menu, request valet service, or report housekeeping logs.
            </p>

            {/* Live Camera Scanner Option */}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setScannerOpen(true);
              }}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-950 px-5 py-4 text-xs font-bold uppercase tracking-wider text-white shadow transition-all focus:outline-none"
            >
              <Camera className="h-5 w-5 text-[#D4AF37]" />
              Start Live Camera Scan
            </button>

            <div className="relative flex items-center justify-center py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200" />
              </div>
              <span className="relative bg-white px-3 text-[10px] uppercase tracking-widest text-zinc-400">or</span>
            </div>

            {/* Upload QR Image Option */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-zinc-800 transition-all hover:bg-zinc-100 disabled:opacity-60 focus:outline-none"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  Reading code...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 text-zinc-500" />
                  Upload Image from Device
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={processing}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3.5 text-xs text-red-700 text-left"
              >
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </div>
        </Dialog>
      )}

      {/* Actual QrScanner Trigger Component */}
      {scannerOpen && (
        <QrScanner
          onDetected={processDecoded}
          onClose={() => setScannerOpen(false)}
          onUploadInstead={() => {
            setScannerOpen(false);
            fileInputRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
