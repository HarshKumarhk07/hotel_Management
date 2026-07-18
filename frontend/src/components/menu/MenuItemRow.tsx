'use client';

import Image from 'next/image';
import { Minus, Plus } from 'lucide-react';
import { Badge, FoodLabel } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useCart } from '@/stores/cart';
import { cn, formatINR } from '@/lib/utils';
import type { PublicMenuItem } from '@/lib/types';

export function MenuItemRow({ item }: { item: PublicMenuItem }) {
  const line = useCart((s) => s.lines.find((l) => l.menuItem === item.id));
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const qty = line?.quantity ?? 0;

  return (
    <div className="flex gap-3 py-4 md:border md:border-zinc-200/80 md:bg-white md:rounded-xl md:p-4 md:shadow-sm md:hover:shadow-md transition-all">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <FoodLabel label={item.foodLabel} />
          {item.isRecommended ? (
            <Badge className="bg-amber-100 text-amber-700">Recommended</Badge>
          ) : null}
          {item.isFeatured ? (
            <Badge className="bg-brand-100 text-brand-700">Featured</Badge>
          ) : null}
        </div>
        <h3 className="truncate font-semibold text-zinc-900">{item.name}</h3>
        <p className="mt-0.5 text-sm font-medium text-zinc-700">{formatINR(item.price)}</p>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{item.description}</p>
        ) : null}
      </div>

      <div className="relative w-28 shrink-0">
        {item.image ? (
          <div className="relative h-24 w-28 overflow-hidden rounded-lg bg-zinc-100">
            <Image src={item.image} alt={item.name} fill className="object-cover" sizes="112px" />
          </div>
        ) : (
          <div className="h-24 w-28 rounded-lg bg-zinc-100" />
        )}

        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
          {qty === 0 ? (
            <Button size="sm" className="shadow-md" onClick={() => add(item)}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-brand bg-white px-2 py-1 shadow-md">
              <button onClick={() => setQty(item.id, qty - 1)} aria-label="Decrease">
                <Minus className="h-4 w-4 text-brand" />
              </button>
              <span className={cn('w-4 text-center text-sm font-bold text-brand')}>{qty}</span>
              <button onClick={() => setQty(item.id, qty + 1)} aria-label="Increase">
                <Plus className="h-4 w-4 text-brand" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
