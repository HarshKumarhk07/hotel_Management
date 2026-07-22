'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, Save, RefreshCw, CheckCircle, Ban } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { KitchenSelect } from '@/components/admin/KitchenSelect';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState, FoodLabel } from '@/components/ui/primitives';
import { useCategories, useMenuItems, type MenuItem } from '@/hooks/useAdminMenu';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

interface StockUpdate {
  id: string;
  inStock: boolean;
  stockQuantity: number | null;
}

export default function StockManagementPage() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'KITCHEN_OWNER';
  
  const [kitchenId, setKitchenId] = useState('');
  const [activeCat, setActiveCat] = useState('');
  const [localUpdates, setLocalUpdates] = useState<Record<string, { inStock: boolean; stockQuantity: string }>>({});
  
  const queryClient = useQueryClient();

  // If kitchen owner, automatically set their kitchen ID
  useEffect(() => {
    if (isOwner && user?.kitchenId) {
      setKitchenId(user.kitchenId);
    }
  }, [isOwner, user]);

  const { data: categories, isLoading: catLoading } = useCategories(kitchenId);
  const { data: items, isLoading: itemsLoading } = useMenuItems(kitchenId, activeCat || undefined);

  // Initialize local updates state when items load
  useEffect(() => {
    if (items) {
      const updates: Record<string, { inStock: boolean; stockQuantity: string }> = {};
      for (const it of items) {
        updates[it._id] = {
          inStock: it.inStock,
          stockQuantity: it.stockQuantity === null ? '' : String(it.stockQuantity),
        };
      }
      setLocalUpdates(updates);
    }
  }, [items]);

  const { mutate: saveBulkStock, isPending: saving } = useMutation({
    mutationFn: async (updates: StockUpdate[]) => {
      return api.patch('/menu/items/bulk-stock', { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items', kitchenId] });
      toast.success('Stock updated successfully!');
    },
    onError: () => {
      toast.error('Could not update stock settings.');
    }
  });

  const handleQtyChange = (id: string, val: string) => {
    // Only allow positive integers or empty (for unlimited)
    if (val === '' || /^\d+$/.test(val)) {
      setLocalUpdates((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          stockQuantity: val,
        },
      }));
    }
  };

  const handleInStockToggle = (id: string) => {
    setLocalUpdates((prev) => {
      const current = prev[id] || { inStock: true, stockQuantity: '' };
      const nextInStock = !current.inStock;
      
      // If toggling back to in-stock, and quantity was 0, set quantity to empty (unlimited)
      let nextQty = current.stockQuantity;
      if (nextInStock && nextQty === '0') {
        nextQty = '';
      }
      // If toggled to out-of-stock, set quantity to 0
      if (!nextInStock) {
        nextQty = '0';
      }

      return {
        ...prev,
        [id]: {
          inStock: nextInStock,
          stockQuantity: nextQty,
        },
      };
    });
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
  };

  const setAllUnlimited = () => {
    if (!items) return;
    setLocalUpdates((prev) => {
      const next = { ...prev };
      for (const it of items) {
        next[it._id] = {
          inStock: true,
          stockQuantity: '',
        };
      }
      return next;
    });
  };

  const handleSubmit = () => {
    const updatesList: StockUpdate[] = [];
    for (const id in localUpdates) {
      const u = localUpdates[id];
      const orig = items?.find((it) => it._id === id);
      const parsedQty = u.stockQuantity === '' ? null : Number(u.stockQuantity);

      // Only include if changed
      if (orig && (orig.inStock !== u.inStock || orig.stockQuantity !== parsedQty)) {
        updatesList.push({
          id,
          inStock: u.inStock,
          stockQuantity: parsedQty,
        });
      }
    }

    if (updatesList.length === 0) {
      toast.info('No changes to save.');
      return;
    }

    saveBulkStock(updatesList);
  };

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-brand" /> Stock Management
          </h1>
          <p className="text-sm text-zinc-500">Manage item stock status and track kitchen inventory</p>
        </div>
        {!isOwner && (
          <KitchenSelect value={kitchenId} onChange={(id) => { setKitchenId(id); setActiveCat(''); }} />
        )}
      </div>

      {!kitchenId ? (
        <EmptyState title="Select a kitchen" description="Choose a kitchen to manage its stock." />
      ) : (
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
              <Button variant="outline" size="sm" onClick={setAllInStock}>
                Set All In Stock
              </Button>
              <Button variant="outline" size="sm" onClick={setAllUnlimited}>
                Reset All Unlimited
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5">
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </div>

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
                      <th className="px-6 py-3">Stock Quantity</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-right">Quick Toggle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {items.map((it) => {
                      const u = localUpdates[it._id] || { inStock: it.inStock, stockQuantity: '' };
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
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={u.stockQuantity}
                                onChange={(e) => handleQtyChange(it._id, e.target.value)}
                                placeholder="Unlimited"
                                className="w-24 rounded-lg border border-zinc-300 px-2.5 py-1 text-center text-sm font-medium text-zinc-800 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                              />
                              <span className="text-xs text-zinc-400">
                                {u.stockQuantity === '' ? '(Unlimited)' : ''}
                              </span>
                            </div>
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
      )}
    </AdminShell>
  );
}
