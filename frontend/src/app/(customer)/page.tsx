'use client';

import { useCallback, useRef, useState } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Camera, Image as ImageIcon, Loader2, AlertCircle, UtensilsCrossed, Star, Car, QrCode, Bell, Sparkles, Shield, Zap, Clock, User, ChevronDown } from 'lucide-react';
import jsQR from 'jsqr';
import { QrScanner } from '@/components/qr/QrScanner';
import { SiteNav } from '@/components/site/SiteNav';
import { SiteFooter } from '@/components/site/SiteFooter';
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

/** Landing screen shown when the app is opened without a scanned QR. */
export default function HomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Showcase the kitchen's featured dishes on the landing page.
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

  /** Extract the room token from a decoded QR (handles full /r/<token> URLs). */
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
    // Allow re-selecting the same file later.
    e.target.value = '';
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6]">
      <SiteNav fullMenuHref={fullMenuHref} />

      <main className="flex-1">
        {/* ═══════════════════════════════════════════════════════════════════
            HERO SECTION (MAJOR REDESIGN) — TWO COLUMN LUXURY LAYOUT
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,#FAF8F0_0%,transparent_60%)] pointer-events-none" />
          <div className="absolute -right-20 top-20 h-[500px] w-[500px] rounded-full bg-[#D4AF37]/[0.04] blur-3xl pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-8 py-10 sm:py-16">
            <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
              {/* LEFT SIDE */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7 }}
                className="space-y-8 text-left"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-[#FAF8F0] px-5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[#D4AF37] ring-1 ring-[#D4AF37]/20 shadow-sm">
                  <span className="flex h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse" />
                  Premium Hotel Valet
                </div>
                <h1 className="text-5xl font-bold tracking-tight text-[#111111] sm:text-6xl lg:text-[64px] lg:leading-[1.1]">
                  Effortless Parking,<br />
                  <span className="text-[#D4AF37]">Just a Tap Away.</span>
                </h1>
                <p className="max-w-lg text-lg leading-relaxed text-[#666666]">
                  Experience ultimate convenience with our digital valet service. No phone calls, paper slips, or waiting at the lobby desk. Request your vehicle instantly from your room.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link href="/valet-tracking">
                    <button
                      type="button"
                      className="group w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl bg-[#D4AF37] px-8 py-4 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-[#AE963C] hover:shadow-xl active:scale-[0.98] focus:outline-none"
                    >
                      <Car className="h-5 w-5 transition-transform duration-300 group-hover:-translate-x-0.5" />
                      Track & Request Vehicle
                    </button>
                  </Link>
                  <Link href="/valet/login">
                    <button
                      type="button"
                      className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl border-2 border-[#ECECEC] bg-white px-8 py-4 text-sm font-semibold text-[#111111] transition-all duration-300 hover:border-[#D4AF37] hover:shadow-md"
                    >
                      Valet Staff Login
                    </button>
                  </Link>
                </div>
              </motion.div>

              {/* RIGHT SIDE */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="relative"
              >
                {/* Decorative gold glow behind image */}
                <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[#D4AF37]/10 via-transparent to-[#D4AF37]/5 blur-2xl pointer-events-none" />
                <div className="relative overflow-hidden rounded-3xl border border-[#ECECEC] bg-white p-2 shadow-2xl">
                  <div className="relative aspect-square w-full overflow-hidden rounded-[20px]">
                    <NextImage
                      src="/hotel1.png"
                      alt="Premium Valet Parking Service"
                      fill
                      className="object-cover transition-transform duration-700 hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            IN-ROOM DINING QR SCAN SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden border-t border-[#ECECEC] bg-[#FAF9F6] py-16 sm:py-24">
          <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#ECECEC]"
            >
              <NextImage
                src="/logo.png"
                alt="In-Room Dining logo"
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="max-w-lg space-y-4"
            >
              <h2 className="text-4xl font-bold tracking-tight text-[#111111] sm:text-5xl">
                In-Room Dining
              </h2>
              <p className="mx-auto max-w-md text-sm text-[#666666]">
                Scan the QR code in your room to browse our digital menu and order fresh food directly to your door.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-sm space-y-5 rounded-3xl border border-[#ECECEC] bg-white p-8 shadow-lg"
            >
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[#D4AF37]">
                Scan Room QR
              </h3>

              {/* Primary action — open the live camera scanner. */}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setScannerOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#111111] px-5 py-4 text-base font-semibold text-white shadow-md transition-all duration-300 hover:bg-[#222222] hover:shadow-xl active:scale-[0.98] focus:outline-none"
              >
                <Camera className="h-5 w-5" aria-hidden="true" />
                Scan QR Code
              </button>

              <div className="relative flex items-center justify-center py-1">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <span className="w-full border-t border-[#ECECEC]" />
                </div>
                <span className="relative bg-white px-3 text-xs uppercase tracking-wider text-[#666666]">or</span>
              </div>

              {/* Secondary action — upload a QR image from the gallery. */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#ECECEC] bg-[#FAF9F6] px-5 py-3.5 text-sm font-semibold text-[#111111] transition-all duration-300 hover:bg-white hover:shadow-md active:scale-[0.98] disabled:opacity-60 focus:outline-none"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#666666]" aria-hidden="true" />
                    Reading image…
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4 text-[#666666]" aria-hidden="true" />
                    Upload QR Image
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Upload a QR code image"
                onChange={handleFileChange}
                disabled={processing}
              />
            </motion.div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="flex max-w-sm items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-left text-sm text-red-600"
              >
                <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </motion.div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FEATURED MENU SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="featured-heading" className="mx-auto max-w-7xl px-6 pb-12 pt-16">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="featured-heading"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#D4AF37]"
            >
              <Star className="h-4 w-4" />
              Featured{featuredKitchen ? ` at ${featuredKitchen.name}` : ' Items'}
            </h2>
            {featuredKitchen && (
              <Link href={fullMenuHref} className="text-sm font-semibold text-[#D4AF37] transition-colors hover:text-[#AE963C]">
                View full menu →
              </Link>
            )}
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
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8"
              >
                <ProductError
                  onRetry={() => {
                    if (isErrorKitchens) void refetchKitchens();
                    else void refetchMenu();
                  }}
                />
              </motion.div>
            ) : featured.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8"
              >
                <ProductEmptyState
                  title="No featured items found"
                  description="This kitchen currently has no featured recommendations."
                />
              </motion.div>
            ) : (
              <motion.div
                key="products"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"
              >
                {featured.map((item) => (
                  <Link
                    key={item.id}
                    href={fullMenuHref}
                    className="group flex flex-col overflow-hidden rounded-3xl border border-[#ECECEC] bg-white text-left shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#FAF9F6]">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt={item.name}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
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
                        <span className="line-clamp-1 text-sm font-semibold text-[#111111]">
                          {item.name}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-[#666666]">
                        {item.description ?? ''}
                      </p>
                      <span className="mt-auto pt-3 text-lg font-bold text-[#111111]">
                        {formatINR(item.price)}
                      </span>
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {featuredKitchen && featured.length > 0 && (
            <>
              <div className="mt-10 flex justify-center">
                <Link href={fullMenuHref}>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2.5 rounded-2xl border-2 border-[#D4AF37] bg-white px-8 py-3.5 text-sm font-semibold text-[#D4AF37] transition-all duration-300 hover:bg-[#D4AF37] hover:text-white focus:outline-none"
                  >
                    <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                    View Full Menu
                  </button>
                </Link>
              </div>
              <p className="mt-4 text-center text-xs text-[#666666]">
                Scan your room QR to place an order.
              </p>
            </>
          )}
        </section>

        <p className="pb-16 text-center text-sm text-[#666666]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#D4AF37] transition-colors hover:text-[#AE963C]">
            Sign in
          </Link>
        </p>

        {/* ═══════════════════════════════════════════════════════════════════
            FEATURE HIGHLIGHTS
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-[#FAF9F6] py-16 border-t border-[#ECECEC]">
          <div className="mx-auto max-w-7xl px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-2 gap-5 md:grid-cols-4"
            >
              {[
                {
                  title: 'Secure & Insured',
                  desc: 'Your vehicle is in safe hands with 24/7 security',
                  icon: <Shield className="h-5 w-5 text-[#D4AF37]" />,
                },
                {
                  title: 'Real-time Updates',
                  desc: 'Live status notifications at every step',
                  icon: <Zap className="h-5 w-5 text-[#D4AF37]" />,
                },
                {
                  title: 'Photo Verified',
                  desc: '5-angle inspection on every check-in',
                  icon: <ImageIcon className="h-5 w-5 text-[#D4AF37]" />,
                },
                {
                  title: 'Fast Retrieval',
                  desc: 'Vehicle ready in minutes, not hours',
                  icon: <Clock className="h-5 w-5 text-[#D4AF37]" />,
                },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className="group flex flex-col items-center gap-4 rounded-3xl border border-[#ECECEC] bg-white p-8 text-center shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FAF8F0] ring-1 ring-[#D4AF37]/20 transition-all duration-300 group-hover:bg-[#D4AF37] group-hover:ring-transparent group-hover:shadow-lg">
                    <div className="transition-colors duration-300 group-hover:[&>svg]:text-white">
                      {item.icon}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-[#111111]">{item.title}</h4>
                    <p className="text-xs leading-relaxed text-[#666666]">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            HOW IT WORKS SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white py-20 sm:py-28 border-y border-[#ECECEC]">
          <div className="mx-auto max-w-7xl px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-[#FAF8F0] px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] ring-1 ring-[#D4AF37]/20 shadow-sm">
                Simple, Smart & Secure
              </span>
              <h3 className="mt-6 text-4xl font-bold tracking-tight text-[#111111] sm:text-5xl">
                How Our Digital Valet Works
              </h3>

              {/* Decorative divider */}
              <div className="flex items-center justify-center gap-4 py-2">
                <span className="h-px w-16 bg-[#D4AF37]/30" />
                <span className="text-[#D4AF37] text-sm">✦</span>
                <span className="h-px w-16 bg-[#D4AF37]/30" />
              </div>

              <p className="mx-auto max-w-xl text-base leading-relaxed text-[#666666]">
                A seamless, photo-inspected check-in and instantaneous real-time request process designed for modern hotels.
              </p>
            </motion.div>

            {/* Step Cards */}
            <div className="mt-20 grid gap-8 sm:grid-cols-2 md:grid-cols-3">
              {[
                {
                  num: '1',
                  title: 'Guest Arrives',
                  desc: 'Hand over keys at the entrance. Our valet manager starts the digital parking file.',
                  icon: <Car className="h-6 w-6 text-[#D4AF37]" />,
                  time: '< 30 sec',
                },
                {
                  num: '2',
                  title: 'Register Guest',
                  desc: 'Valet manager manually inputs guest details (name, room, phone, and email) to initiate registration.',
                  icon: <User className="h-6 w-6 text-[#D4AF37]" />,
                  time: '< 15 sec',
                },
                {
                  num: '3',
                  title: 'Vehicle Inspection',
                  desc: 'We capture 5 mandatory photos and log pre-existing damages to ensure complete liability coverage.',
                  icon: <Camera className="h-6 w-6 text-[#D4AF37]" />,
                  time: '< 1 min',
                },
                {
                  num: '4',
                  title: 'Parked Securely',
                  desc: 'System maps your vehicle to a free slot. You get a confirmation email with a secure tracking link.',
                  icon: <span className="font-extrabold text-lg text-[#D4AF37] font-mono">P</span>,
                  time: 'Instant',
                },
                {
                  num: '5',
                  title: 'One-Click Request',
                  desc: 'Request your vehicle retrieval via the secure link. The valet team is alerted in real time.',
                  icon: <Bell className="h-6 w-6 text-[#D4AF37]" />,
                  time: 'Instant',
                },
                {
                  num: '6',
                  title: 'Delivery & Handover',
                  desc: 'We bring your car to the lobby and hand over the keys, freeing up the parking slot automatically.',
                  icon: <Sparkles className="h-6 w-6 text-[#D4AF37]" />,
                  time: '2-5 mins',
                },
              ].map((step) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Number(step.num) * 0.08, duration: 0.5 }}
                  className="group relative flex min-h-[280px] flex-col items-center justify-between rounded-3xl border border-[#ECECEC] bg-white p-8 pt-14 text-center shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
                >
                  {/* Step number badge */}
                  <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF8F0] text-xs font-bold text-[#D4AF37] ring-1 ring-[#D4AF37]/20 shadow-sm">
                    {step.num}
                  </div>

                  {/* Floating circular icon */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex h-16 w-16 items-center justify-center rounded-full bg-[#111111] shadow-xl ring-2 ring-[#D4AF37]/30 transition-all duration-300 group-hover:ring-[#D4AF37] group-hover:shadow-2xl">
                    {step.icon}
                  </div>

                  <div className="mt-4 space-y-3">
                    <h4 className="text-lg font-bold text-[#111111]">{step.title}</h4>
                    <p className="mx-auto max-w-[240px] text-sm leading-relaxed text-[#666666]">
                      {step.desc}
                    </p>
                  </div>

                  {/* Time badge */}
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FAF8F0] px-4 py-1.5 text-xs font-bold text-[#D4AF37] ring-1 ring-[#D4AF37]/10 shadow-sm">
                    <Clock className="h-3 w-3" />
                    {step.time}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            TRACKING PREVIEW SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-[#FAF9F6] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-8">
            <div className="grid gap-10 lg:grid-cols-2">
              {/* Vehicle Tracking Preview */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="flex flex-col justify-between rounded-3xl border border-[#ECECEC] bg-white p-10 shadow-lg transition-all duration-300 hover:shadow-xl"
              >
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-[#111111] px-4 py-1.5 text-[10px] font-bold text-white uppercase tracking-[0.15em]">
                      Preview Board
                    </span>
                    <h4 className="text-xl font-bold text-[#111111]">Vehicle Tracking Screen</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-[#666666]">
                    See exactly how guests monitor their vehicle. A live view detailing car registration, key information, and parking assignments.
                  </p>

                  {/* Mockup Card */}
                  <div className="rounded-2xl border border-[#ECECEC] bg-[#FAF9F6] p-6 space-y-5 text-left">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#666666]">Car Plate</span>
                        <div className="text-xl font-bold text-[#111111]">KA-03-MR-9821</div>
                        <div className="text-sm text-[#666666]">Mercedes-Benz C-Class (Silver)</div>
                      </div>
                      <div className="rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-100 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Parked
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5 border-t border-[#ECECEC] pt-4">
                      <div>
                        <span className="text-[#666666] block uppercase tracking-[0.15em] text-[9px] font-bold">Key Tag</span>
                        <span className="font-semibold text-[#111111]">#K-104</span>
                      </div>
                      <div>
                        <span className="text-[#666666] block uppercase tracking-[0.15em] text-[9px] font-bold">Assigned Slot</span>
                        <span className="font-semibold text-[#111111]">P-24</span>
                      </div>
                      <div>
                        <span className="text-[#666666] block uppercase tracking-[0.15em] text-[9px] font-bold">Check-In</span>
                        <span className="font-semibold text-[#111111]">10:45 AM (Today)</span>
                      </div>
                      <div>
                        <span className="text-[#666666] block uppercase tracking-[0.15em] text-[9px] font-bold">Fuel Level</span>
                        <span className="font-semibold text-[#111111]">Half Tank</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-[#ECECEC]">
                  <span className="text-sm text-[#666666] italic">Guests can view this interface securely by searching their plate number.</span>
                </div>
              </motion.div>

              {/* Request Vehicle Preview */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="flex flex-col justify-between rounded-3xl border border-[#ECECEC] bg-white p-10 shadow-lg transition-all duration-300 hover:shadow-xl"
              >
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-[#D4AF37] px-4 py-1.5 text-[10px] font-bold text-white uppercase tracking-[0.15em]">
                      Request flow
                    </span>
                    <h4 className="text-xl font-bold text-[#111111]">Real-Time Stepper Progress</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-[#666666]">
                    {"Watch the vehicle status progress live on the guest's tracking screen as the valet team retrieves and delivers the car."}
                  </p>

                  {/* Live Stepper Mockup */}
                  <div className="rounded-2xl border border-[#ECECEC] bg-[#FAF9F6] p-6 space-y-4 text-left">
                    <div className="space-y-4">
                      {[
                        { label: 'Vehicle Requested', active: true, time: '11:10 AM' },
                        { label: 'Valet Assigned (Rohan M.)', active: true, time: '11:11 AM' },
                        { label: 'Vehicle Being Brought', active: true, time: '11:12 AM' },
                        { label: 'Ready Outside (Lobby Entrance)', active: false, time: '--' },
                        { label: 'Delivered', active: false, time: '--' },
                      ].map((step, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                              step.active
                                ? 'bg-[#D4AF37] text-white shadow-md'
                                : 'border-2 border-[#ECECEC] bg-white text-[#666666]'
                            }`}>
                              {idx + 1}
                            </div>
                            <span className={step.active ? 'font-semibold text-[#111111]' : 'text-[#666666]'}>
                              {step.label}
                            </span>
                          </div>
                          <span className="text-xs text-[#666666] font-mono">{step.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-[#ECECEC]">
                  <span className="text-sm text-[#666666] italic">Driven dynamically by WebSocket events (Socket.io) with zero polling delay.</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FAQ SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white py-20 sm:py-28 border-t border-[#ECECEC]">
          <div className="mx-auto max-w-3xl px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16 space-y-3"
            >
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">FAQ</span>
              <h3 className="text-4xl font-bold tracking-tight text-[#111111]">
                Frequently Asked Questions
              </h3>
              <div className="flex items-center justify-center gap-4 pt-1">
                <span className="h-px w-16 bg-[#D4AF37]/30" />
                <span className="text-[#D4AF37] text-sm">✦</span>
                <span className="h-px w-16 bg-[#D4AF37]/30" />
              </div>
            </motion.div>

            <div className="space-y-4">
              {[
                {
                  q: 'Is my vehicle safe in the valet parking lot?',
                  a: 'Absolutely. The valet parking facility is under 24/7 security surveillance and gated protection. Our valet managers perform full vehicle condition photo inspections during check-in to log pre-existing conditions and ensure total security.',
                },
                {
                  q: 'How long does it take to retrieve my car?',
                  a: 'Typically, it takes between 5 to 8 minutes from the moment you click "Request Vehicle" in the app until the car is parked ready outside the main entrance. You can track this process step-by-step.',
                },
                {
                  q: 'Do I need a paper ticket or slip?',
                  a: 'No. Our valet parking system is 100% digital. We log your vehicle plate number, room number, and key tag electronically. You only need to input your car plate number in the app to track or request your car.',
                },
                {
                  q: 'How do I authenticate as a Valet Manager?',
                  a: 'Valet Managers receive dedicated staff credentials (email & password) from the hotel administration. You can sign in via the Valet Staff Login link to access the queue board and scan guest codes.',
                },
              ].map((faq, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05, duration: 0.4 }}
                  className="rounded-3xl border border-[#ECECEC] bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="flex w-full items-center justify-between px-8 py-6 text-left transition-colors hover:bg-[#FAF9F6]"
                  >
                    <h4 className="text-base font-semibold text-[#111111] pr-4">{faq.q}</h4>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-[#D4AF37] transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="px-8 pb-6 text-sm leading-[1.8] text-[#666666]">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FINAL CTA
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-[#FAF9F6] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative overflow-hidden rounded-3xl bg-[#111111] px-10 py-20 text-center text-white shadow-2xl"
            >
              {/* Decorative gradient overlays */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#D4AF37_0%,transparent_50%)] opacity-10 pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,#D4AF37_0%,transparent_40%)] opacity-5 pointer-events-none" />

              <div className="relative mx-auto max-w-xl space-y-8">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37] ring-1 ring-[#D4AF37]/30">
                  Instant Retrieval
                </span>
                <h3 className="text-4xl font-bold tracking-tight sm:text-5xl">Ready to depart?</h3>
                <p className="text-base leading-relaxed text-zinc-300 sm:text-lg">
                  Request your vehicle from the comfort of your hotel room, and it will be waiting for you outside by the lobby when you arrive.
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-2">
                  <Link href="/valet-tracking">
                    <button
                      type="button"
                      className="rounded-2xl bg-[#D4AF37] px-8 py-4 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-[#AE963C] hover:shadow-xl active:scale-[0.98]"
                    >
                      Request Your Car Now
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />

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
