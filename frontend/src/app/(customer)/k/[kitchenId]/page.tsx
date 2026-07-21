'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { useMenu } from '@/hooks/useMenu';
import { useCart } from '@/stores/cart';
import { useAuth } from '@/hooks/useAuth';
import { MenuItemRow } from '@/components/menu/MenuItemRow';
import { CartSheet } from '@/components/cart/CartSheet';
import { CenteredSpinner, EmptyState, FoodLabel } from '@/components/ui/primitives';
import { ProductRowSkeleton, ProductError, ProductEmptyState } from '@/components/ui/ProductSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';


function KitchenMenuInner() {
  const router = useRouter();
  const { kitchenId } = useParams<{ kitchenId: string }>();
  const search = useSearchParams();
  const roomId = search.get('room') ?? undefined;
  const roomNumber = search.get('rno') ?? undefined;

  const { data: menu, isLoading, isError, refetch } = useMenu(kitchenId);
  const { data: bannersRes } = useQuery<{ data: { banners: any[] } }>({
    queryKey: ['active-banners', kitchenId],
    queryFn: () => api.get(`/banners/active?kitchenId=${kitchenId}`).then((r) => r.data),
  });
  const banners = bannersRes?.data?.banners ?? [];

  const setContext = useCart((s) => s.setContext);
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const totals = useCart((s) => s.totals)();
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);

  const { user, status, logout } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');

  // Pin the cart to this kitchen + room once the menu (with settings) loads.
  useEffect(() => {
    if (menu && roomId && roomNumber) {
      setContext({
        kitchenId: menu.kitchen.id,
        kitchenName: menu.kitchen.name,
        roomId,
        roomNumber,
        serviceChargePercent: menu.kitchen.settings?.serviceChargePercent ?? 0,
      });
    }
  }, [menu, roomId, roomNumber, setContext]);

  const categories = useMemo(() => menu?.categories ?? [], [menu]);

  // The chips filter the menu: "All" shows every section, otherwise only the
  // selected category's section is rendered.
  const visibleCategories = useMemo(
    () => (activeCategory ? categories.filter((c) => c.id === activeCategory) : categories),
    [categories, activeCategory],
  );

  const filteredCategories = useMemo(() => {
    return visibleCategories
      .map((c) => {
        const filteredItems = c.items.filter((item) => {
          if (dietaryFilter === 'ALL') return true;
          if (dietaryFilter === 'VEG') {
            return item.foodLabel === 'VEG' || item.foodLabel === 'JAIN';
          }
          if (dietaryFilter === 'NON_VEG') {
            return item.foodLabel === 'NON_VEG';
          }
          return true;
        });
        return { ...c, items: filteredItems };
      })
      .filter((c) => c.items.length > 0);
  }, [visibleCategories, dietaryFilter]);

  return (
    <div className="relative min-h-screen pb-24 lg:pb-12 pt-20 lg:pt-24 bg-zinc-50/50">
      {/* Header */}
      <header className="sticky top-[72px] lg:top-[88px] z-30 border-b bg-white/95 backdrop-blur shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{menu ? menu.kitchen.name : 'Loading...'}</h1>
            {roomNumber ? (
              <p className="text-xs text-zinc-500 mt-0.5">Delivering to Room {roomNumber}</p>
            ) : null}
          </div>

          {/* Login / Signup navbar options */}
          <div className="flex items-center gap-4">
            {status === 'authenticated' && user ? (
              <div className="flex items-center gap-3">
                <Link href="/orders" className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 transition-colors hover:underline">
                  My Orders
                </Link>
                <span className="text-zinc-200 text-sm">|</span>
                <button
                  onClick={() => void logout()}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors hover:underline"
                >
                  Sign out
                </button>
              </div>
            ) : status === 'unauthenticated' ? (
              <div className="flex items-center gap-3">
                <Link
                  href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '')}`}
                  className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 transition-colors hover:underline"
                >
                  Login
                </Link>
                <span className="text-zinc-200 text-sm">|</span>
                <Link
                  href={`/register?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '')}`}
                  className="text-xs font-semibold text-brand hover:text-brand-700 transition-colors hover:underline"
                >
                  Sign up
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {roomNumber && roomId && (
        <div className="lg:hidden bg-brand/5 border-b px-4 py-2.5 flex justify-between items-center text-xs">
          <span className="font-semibold text-brand">Room {roomNumber} Services:</span>
          <div className="flex gap-3">
            <Link
              href={`/services?room=${roomId}&rno=${encodeURIComponent(roomNumber)}`}
              className="font-bold text-brand hover:underline"
            >
              Service Desk
            </Link>
            <span className="text-zinc-300">|</span>
            <Link
              href={`/feedback?room=${encodeURIComponent(roomNumber)}`}
              className="font-bold text-zinc-700 hover:underline"
            >
              Give Feedback
            </Link>
          </div>
        </div>
      )}

      {/* Layout Grid */}
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Menu list */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="h-6 w-32 bg-zinc-200 rounded animate-pulse mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <ProductRowSkeleton key={idx} />
                  ))}
                </div>
              </motion.div>
            ) : isError || !menu ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6"
              >
                <ProductError onRetry={() => void refetch()} />
              </motion.div>
            ) : categories.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6"
              >
                <ProductEmptyState
                  title="No items available"
                  description="Check back during serving hours."
                />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Promotional Banners Slider */}
                {banners.length > 0 && (
                  <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2 scroll-smooth">
                    {banners.map((banner: any) => (
                      <div
                        key={banner._id}
                        onClick={() => {
                          if (banner.linkUrl) {
                            router.push(banner.linkUrl);
                          }
                        }}
                        className={`relative h-36 w-72 shrink-0 rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md cursor-pointer ${
                          banner.linkUrl ? 'hover:scale-[1.01]' : 'cursor-default'
                        }`}
                      >
                        <img
                          src={banner.imageUrl}
                          alt={banner.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 flex flex-col justify-end p-3.5">
                          <h4 className="text-sm font-bold text-white font-sans">{banner.title}</h4>
                          {banner.subtitle && (
                            <p className="text-[10px] text-zinc-200 font-sans mt-0.5">{banner.subtitle}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Category chips & Dietary filter */}
                <div className="sticky top-[68px] z-20 flex flex-col gap-3 border bg-white/95 p-3 rounded-xl shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <nav className="no-scrollbar flex gap-2 overflow-x-auto flex-1">
                    <button
                      onClick={() => setActiveCategory(null)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        activeCategory === null
                          ? 'bg-brand text-white'
                          : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveCategory(c.id)}
                        className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          activeCategory === c.id
                            ? 'bg-brand text-white'
                            : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </nav>

                  {/* Dietary filters */}
                  <div className="flex gap-1.5 shrink-0 border-t pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-4">
                    <button
                      onClick={() => setDietaryFilter('ALL')}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                        dietaryFilter === 'ALL'
                          ? 'bg-zinc-950 text-white border-zinc-955 shadow-sm'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      All Food
                    </button>
                    <button
                      onClick={() => setDietaryFilter('VEG')}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                        dietaryFilter === 'VEG'
                          ? 'bg-green-600 text-white border-green-700 shadow-sm'
                          : 'bg-white text-green-700 border-zinc-200 hover:bg-green-50'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Veg
                    </button>
                    <button
                      onClick={() => setDietaryFilter('NON_VEG')}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                        dietaryFilter === 'NON_VEG'
                      ? 'bg-red-600 text-white border-red-700 shadow-sm'
                      : 'bg-white text-red-700 border-zinc-200 hover:bg-red-50'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Non-Veg
                </button>
              </div>
            </div>

            {/* Sections list */}
            {filteredCategories.length === 0 ? (
              <ProductEmptyState
                title="No items found"
                description={
                  dietaryFilter !== 'ALL'
                    ? `There are no ${dietaryFilter === 'VEG' ? 'vegetarian' : 'non-vegetarian'} options available under this selection.`
                    : "Check back during serving hours."
                }
              />
            ) : (
              <div className="space-y-8">
                {filteredCategories.map((c) => (
                  <section key={c.id} className="scroll-mt-28">
                    <h2 className="text-base font-bold text-zinc-900 border-b pb-2 mb-4">{c.name}</h2>
                    {c.description ? <p className="text-xs text-zinc-500 mb-4">{c.description}</p> : null}
                    <div className="divide-y md:divide-y-0 md:grid md:grid-cols-2 md:gap-4">
                      {c.items.map((item) => (
                        <MenuItemRow key={item.id} item={item} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

        {/* Right Column: Sticky Cart Sidebar for Desktop */}
        <aside className="hidden lg:block lg:col-span-4 space-y-4">
          {roomId && (
            <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Room Services</h3>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/services?room=${roomId}&rno=${encodeURIComponent(roomNumber || '')}`}
                  className="flex flex-col items-center justify-center rounded-xl bg-brand/5 hover:bg-brand/10 border border-brand/10 p-3 text-center transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold text-brand">Service Desk</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Raise request</span>
                </Link>
                <Link
                  href={`/feedback?room=${encodeURIComponent(roomNumber || '')}`}
                  className="flex flex-col items-center justify-center rounded-xl bg-zinc-50 hover:bg-zinc-100 border p-3 text-center transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold text-zinc-700">Feedback</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Rate stay</span>
                </Link>
              </div>
            </div>
          )}
          <div className="sticky top-[88px] rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 border-b pb-3 mb-4">Your order</h2>
            
            {lines.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingBag className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                <p className="text-xs text-zinc-500">Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="max-h-[50vh] overflow-y-auto pr-1">
                  {lines.map((l) => (
                    <div key={l.menuItem} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                      <FoodLabel label={l.foodLabel} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-zinc-900">{l.name}</p>
                        <p className="text-xs text-zinc-500">{formatINR(l.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border px-1.5 py-0.5 bg-white">
                        <button onClick={() => setQty(l.menuItem, l.quantity - 1)} aria-label="Decrease">
                          <Minus className="h-3 w-3 text-brand" />
                        </button>
                        <span className="w-4 text-center text-xs font-bold text-zinc-700">{l.quantity}</span>
                        <button onClick={() => setQty(l.menuItem, l.quantity + 1)} aria-label="Increase">
                          <Plus className="h-3 w-3 text-brand" />
                        </button>
                      </div>
                      <button onClick={() => remove(l.menuItem)} aria-label="Remove">
                        <Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-500 transition-colors" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 space-y-2 border-t pt-4">
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>Subtotal</span>
                    <span>{formatINR(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>Taxes</span>
                    <span>{formatINR(totals.tax)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>Service charge</span>
                    <span>{formatINR(totals.serviceCharge)}</span>
                  </div>
                  <div className="flex justify-between pt-1 text-sm font-bold text-zinc-900">
                    <span>Total</span>
                    <span>{formatINR(totals.total)}</span>
                  </div>
                  <Button
                    className="mt-3 w-full"
                    onClick={() => router.push('/checkout')}
                  >
                    Proceed to checkout · {formatINR(totals.total)}
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Floating Sticky cart bar for mobile */}
      {count > 0 ? (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-0 bottom-6 z-30 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center justify-between rounded-xl bg-brand px-5 py-4 text-white shadow-lg lg:hidden"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingBag className="h-5 w-5" />
            {count} item{count > 1 ? 's' : ''}
          </span>
          <span className="font-bold">View cart · {formatINR(totals.total)}</span>
        </button>
      ) : null}

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

export default function KitchenMenuPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">Loading...</div>}>
      <KitchenMenuInner />
    </Suspense>
  );
}
