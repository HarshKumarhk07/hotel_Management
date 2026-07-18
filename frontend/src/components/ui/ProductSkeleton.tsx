'use client';

import { AlertCircle, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Pulse anim for skeletons */
const pulse = 'animate-pulse bg-zinc-200';

/** Skeleton loader representing a single product card (Featured style) */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-sm">
      <div className={`relative aspect-[4/3] w-full ${pulse}`} />
      <div className="flex flex-1 flex-col p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className={`h-4 w-4 rounded-sm ${pulse}`} />
          <div className={`h-4 w-28 rounded ${pulse}`} />
        </div>
        <div className={`h-3 w-full rounded ${pulse}`} />
        <div className={`h-3 w-5/6 rounded ${pulse}`} />
        <div className={`h-5 w-16 rounded mt-auto pt-2 ${pulse}`} />
      </div>
    </div>
  );
}

/** Skeleton loader representing a single product row/card (Menu style) */
export function ProductRowSkeleton() {
  return (
    <div className="flex gap-3 py-4 md:border md:border-zinc-200/80 md:bg-white md:rounded-xl md:p-4 md:shadow-sm">
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className={`h-4 w-4 rounded-sm ${pulse}`} />
          <div className={`h-4 w-24 rounded ${pulse}`} />
        </div>
        <div className={`h-5 w-2/3 rounded ${pulse}`} />
        <div className={`h-4 w-16 rounded ${pulse}`} />
        <div className={`h-3 w-full rounded ${pulse}`} />
        <div className={`h-3 w-3/4 rounded ${pulse}`} />
      </div>
      <div className={`relative h-24 w-28 shrink-0 rounded-lg ${pulse}`} />
    </div>
  );
}

/** Reusable Error component for product loading failure with a retry option */
export function ProductError({ 
  message = 'Please check your connection and try again.', 
  onRetry 
}: { 
  message?: string; 
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center border border-dashed border-zinc-300 bg-white rounded-2xl shadow-sm max-w-sm mx-auto">
      <AlertCircle className="h-10 w-10 text-red-500 animate-pulse" />
      <div className="space-y-1">
        <p className="font-semibold text-zinc-900 text-sm">Failed to load products</p>
        <p className="text-xs text-zinc-500">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
        Retry
      </Button>
    </div>
  );
}

/** Reusable Empty State component for product listing sections */
export function ProductEmptyState({ 
  title = 'No products found', 
  description = 'Check back later or adjust your filters.' 
}: { 
  title?: string; 
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center border border-dashed border-zinc-200 bg-white rounded-2xl shadow-sm max-w-sm mx-auto">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-400">
        <UtensilsCrossed className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-zinc-900 text-sm">{title}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
    </div>
  );
}
