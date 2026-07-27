'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw, CheckCircle, Ban, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState, FoodLabel } from '@/components/ui/primitives';
import { useCategories, useMenuItems } from '@/hooks/useAdminMenu';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

interface StockUpdate {
  id: string;
  inStock: boolean;
  stockQuantity: number | null;
}

/** Role-neutral stock management surface scoped to a single (authorized) kitchen. */
export function StockManager({ kitchenId }: { kitchenId: string }) {
  const [activeCat, setActiveCat] = useState('');
  const [localUpdates, setLocalUpdates] = useState<Record<string, { inStock: boolean; stockQuantity: string }>>({});
  const [dirty, setDirty] = useState(false);
  const queryClient = useQueryClient();

  useUnsavedChanges(dirty);

  const { data: categories } = useCategories(kitchenId);
  const { data: items, isLoading: itemsLoading } = useMenuItems(kitchenId, activeCat || undefined);

  // Seed local edit state from the server, but MERGE rather than replace: only
  // items we haven't seen yet are seeded. This preserves in-progress (unsaved)
  // edits when the user switches category tabs and comes back — previously the
  // whole draft was clobbered on every refetch, so a "Reset All Unlimited"
  // silently reverted to the server values.
  useEffect(() => {
    if (!items) return;
    setLocalUpdates((prev) => {
      const next = { ...prev };
      for (const it of items) {
        if (!(it._id in next)) {
          next[it._id] = {
            inStock: it.inStock,
            stockQuantity: it.stockQuantity === null ? '' : String(it.stockQuantity),
          };
        }
      }
      return next;
    });
  }, [items]);

  const { mutate: saveBulkStock, isPending: saving } = useMutation({
    mutationFn: async (updates: StockUpdate[]) => api.patch('/menu/items/bulk-stock', { updates }),
    onSuccess: () => {
      // Drop the local draft so the refetched server values (incl. auto in/out
      // derived from quantity) re-seed cleanly.
      setLocalUpdates({});
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items', kitchenId] });
      toast.success('Stock updated successfully!');
    },
    onError: () => {
      toast.error('Could not update stock settings.');
    },
  });

  const setQty = (id: string, val: string) => {
    if (val === '' || /^\d+$/.test(val)) {
      setLocalUpdates((prev) => ({ ...prev, [id]: { ...prev[id], stockQuantity: val } }));
      setDirty(true);
    }
  };

  const step = (id: string, delta: number) => {
    const cur = Number(localUpdates[id]?.stockQuantity || '0');
    setQty(id, String(Math.max(0, cur + delta)));
  };

  const handleInStockToggle = (id: string) => {
    setLocalUpdates((prev) => {
      const current = prev[id] || { inStock: true, stockQuantity: '' };
      const nextInStock = !current.inStock;
      let nextQty = current.stockQuantity;
      if (nextInStock && nextQty === '0') nextQty = '';
      if (!nextInStock) nextQty = '0';
      return { ...prev, [id]: { inStock: nextInStock, stockQuantity: nextQty } };
    });
    setDirty(true);
  };

  const setAllInStock = () => {
    if (!items) return;
    setLocalUpdates((prev) => {
      const next = { ...prev };
      for (const it of items) {
        next[it._id] = {
          inStock: true,
          stockQuantity: prev[it._id]?.stockQuantity === '0' ? '' : prev[it._id]?.stockQuantity || '',
        };
      }
      return next;
    });
    setDirty(true);
  };

  const setAllUnlimited = () => {
    if (!items) return;
    setLocalUpdates((prev) => {
      const next = { ...prev };
      for (const it of items) next[it._id] = { inStock: true, stockQuantity: '' };
      return next;
    });
    setDirty(true);
  };

  const handleSubmit = () => {
    const updatesList: StockUpdate[] = [];
    for (const id in localUpdates) {
      const u = localUpdates[id];
      const orig = items?.find((it) => it._id === id);
      const parsedQty = u.stockQuantity === '' ? null : Number(u.stockQuantity);
      if (orig && (orig.inStock !== u.inStock || orig.stockQuantity !== parsedQty)) {
        updatesList.push({ id, inStock: u.inStock, stockQuantity: parsedQty });
      }
    }
    if (updatesList.length === 0) {
      toast.info('No changes to save.');
      return;
    }
    saveBulkStock(updatesList);
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setActiveCat('')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCat === '' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All categories
          </button>
          {categories?.map((c) => (
            <button
              key={c._id}
              onClick={() => setActiveCat(c._id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCat === c._id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              Unsaved changes
            </span>
          )}
          <Button variant="outline" size="sm" onClick={setAllInStock}>
            Set All In Stock
          </Button>
          <Button variant="outline" size="sm" onClick={setAllUnlimited}>
            Reset All Unlimited
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <p className="px-1 text-xs text-zinc-400">
        Most dishes are made to order — keep them <span className="font-semibold text-zinc-500">Unlimited</span> and just
        toggle <span className="font-semibold text-zinc-500">In / Out of stock</span>. Set a quantity only when you want
        to cap how many can be ordered (it auto-marks the dish out when it hits 0).
      </p>

      {/* Stock Table */}
      {itemsLoading ? (
        <CenteredSpinner label="Loading items list…" />
      ) : !items || items.length === 0 ? (
        <EmptyState title="No items found" description="Create a category and menu items first." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-zinc-50 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <th className="px-6 py-3">Menu Item</th>
                  <th className="px-6 py-3">Price</th>
                  <th className="px-6 py-3">Daily Limit</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Quick Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {items.map((it) => {
                  const u = localUpdates[it._id] || { inStock: it.inStock, stockQuantity: '' };
                  const isUnlimited = u.stockQuantity === '';
                  return (
                    <tr key={it._id} className="hover:bg-zinc-50/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FoodLabel label={it.foodLabel} />
                          <div>
                            <p className="font-semibold text-zinc-900">{it.name}</p>
                            <p className="text-xs text-zinc-500">
                              {typeof it.category === 'object' ? it.category.name : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-zinc-700">
                        {formatINR(it.price)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {isUnlimited ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                              Unlimited
                            </span>
                            <button
                              type="button"
                              onClick={() => setQty(it._id, '10')}
                              className="text-xs font-medium text-brand hover:underline"
                            >
                              Set limit
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => step(it._id, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                              aria-label="Decrease"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={u.stockQuantity}
                              onChange={(e) => setQty(it._id, e.target.value)}
                              className="w-14 rounded-lg border border-zinc-300 px-1 py-1 text-center text-sm font-medium text-zinc-800 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                            />
                            <button
                              type="button"
                              onClick={() => step(it._id, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                              aria-label="Increase"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setQty(it._id, '')}
                              className="ml-1 text-[11px] font-medium text-zinc-400 hover:text-brand"
                              title="Remove the limit (always available)"
                            >
                              Unlimited
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.inStock ? (
                            <>
                              <CheckCircle className="h-3 w-3" /> In Stock
                            </>
                          ) : (
                            <>
                              <Ban className="h-3 w-3" /> Out of Stock
                            </>
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <button
                          onClick={() => handleInStockToggle(it._id)}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                            u.inStock
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {u.inStock ? 'Mark Out' : 'Mark In'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
