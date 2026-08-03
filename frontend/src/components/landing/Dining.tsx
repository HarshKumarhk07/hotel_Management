'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp } from '@/lib/motion/fadeUp';
import { staggerContainer } from '@/lib/motion/stagger';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useQrStore } from '@/stores/qr';
import { useRouter } from 'next/navigation';
import { ProductCardSkeleton, ProductError, ProductEmptyState } from '@/components/ui/ProductSkeleton';
import { FoodLabel } from '@/components/ui/primitives';
import { formatINR } from '@/lib/utils';
import type { PublicMenu } from '@/lib/types';
import NextImage from 'next/image';
import { UtensilsCrossed } from 'lucide-react';

interface PublicKitchen {
  id: string;
  name: string;
  slug: string;
}

export function Dining() {
  const router = useRouter();
  const openScanner = useQrStore((s) => s.openScanner);

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
    .slice(0, 4); // Keep to 4 for editorial layout

  return (
    <section id="dining" className="bg-page-ivory py-32 md:py-48 px-6">
      <div className="max-w-7xl mx-auto space-y-32">
        {/* Editorial Layout for Dining Intro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-32 items-center">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="order-2 md:order-1 flex flex-col items-start"
          >
            <motion.span variants={fadeUp} className="text-[10px] md:text-xs font-bold text-page-gold uppercase tracking-[0.25em]">
              ROYAL DINING AT ROOMS
            </motion.span>
            <motion.h2 variants={fadeUp} className="mt-6 text-4xl md:text-5xl font-serif text-page-black leading-tight">
              Chef&apos;s Recommendations
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-8 text-sm text-page-black/60 font-light leading-relaxed max-w-md">
              Experience the pinnacle of Awadhi and international gastronomy, curated by award-winning palace chefs and delivered directly to your suite.
            </motion.p>
            {featuredKitchen && (
              <motion.div variants={fadeUp} className="mt-12">
                <button
                  onClick={() => router.push(`/k/${featuredKitchen.id}`)}
                  className="group px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-page-black border border-page-black/20 hover:border-page-black hover:-translate-y-[2px] hover:shadow-luxury-hover transition-all duration-300 flex items-center gap-3 will-change-transform"
                >
                  <UtensilsCrossed className="h-3 w-3" /> Browse Menu Catalog
                </button>
                <p className="mt-4 text-[9px] text-page-black/40 uppercase tracking-widest">
                  * Requires in-room or table QR scan.
                </p>
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="order-1 md:order-2 relative aspect-[3/4] w-full shadow-luxury"
          >
            <NextImage
              src="/dining-banner.png"
              alt="Dining Experience"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </motion.div>
        </div>

        {/* Featured Items Grid */}
        <div className="pt-16 border-t border-page-black/5">
          <AnimatePresence mode="wait">
            {isLoadingKitchens || (featuredKitchen && isLoadingMenu) ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-4 sm:gap-10">
                {Array.from({ length: 4 }).map((_, idx) => <ProductCardSkeleton key={idx} />)}
              </motion.div>
            ) : isErrorKitchens || isErrorMenu ? (
              <motion.div key="error" className="py-8">
                <ProductError onRetry={() => { if (isErrorKitchens) void refetchKitchens(); else void refetchMenu(); }} />
              </motion.div>
            ) : featured.length === 0 ? (
              <motion.div key="empty" className="py-8">
                <ProductEmptyState title="No recommendations currently" description="This kitchen has no featured recommendations logged." />
              </motion.div>
            ) : (
              <motion.div
                key="products"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.1 }}
                className="grid grid-cols-2 gap-4 sm:gap-10"
              >
                {featured.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={fadeUp}
                    onClick={() => {
                      if (featuredKitchen) {
                        router.push(`/k/${featuredKitchen.id}`);
                      } else {
                        openScanner();
                      }
                    }}
                    className="group flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-[2px] will-change-transform"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-page-cream mb-4 sm:mb-8">
                      {item.image ? (
                        <NextImage
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="(max-width: 768px) 100vw, 25vw"
                          className="object-cover transition-transform duration-1000 ease-[0.25,0.1,0.25,1] group-hover:scale-105 will-change-transform"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-page-black/10">
                          <UtensilsCrossed className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-start text-left space-y-4">
                      <div className="flex items-center gap-3">
                        <FoodLabel label={item.foodLabel} />
                        <h4 className="text-sm md:text-base font-serif font-medium text-page-black tracking-wide group-hover:text-page-gold transition-colors duration-300">
                          {item.name}
                        </h4>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-page-black/50 font-light">
                        {item.description ?? ''}
                      </p>
                      <span className="text-sm font-semibold text-page-gold pt-2">
                        {formatINR(item.price)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
