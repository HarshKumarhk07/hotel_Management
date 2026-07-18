'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { KitchenSelect } from '@/components/admin/KitchenSelect';
import { ItemFormDialog, type ItemFormValues } from '@/components/admin/ItemFormDialog';
import { Button } from '@/components/ui/button';
import { Badge, Card, CenteredSpinner, EmptyState, FoodLabel } from '@/components/ui/primitives';
import {
  useCategories,
  useMenuItems,
  useMenuMutations,
  type MenuItem,
} from '@/hooks/useAdminMenu';
import { formatINR } from '@/lib/utils';

function ImageUploadButton({ itemId, kitchenId }: { itemId: string; kitchenId: string }) {
  const { uploadImage } = useMenuMutations(kitchenId);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadImage.mutate({ id: itemId, file });
        }}
      />
      <Button variant="ghost" size="sm" onClick={() => ref.current?.click()} disabled={uploadImage.isPending}>
        <ImagePlus className="h-4 w-4" />
      </Button>
    </>
  );
}

function MenuManager() {
  const [kitchenId, setKitchenId] = useState('');
  const [activeCat, setActiveCat] = useState<string>('');
  const [newCat, setNewCat] = useState('');
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: MenuItem }>({ open: false });

  const { data: categories, isLoading: catLoading } = useCategories(kitchenId);
  const { data: items, isLoading: itemsLoading } = useMenuItems(kitchenId, activeCat || undefined);
  const m = useMenuMutations(kitchenId);

  const saveItem = async (values: ItemFormValues) => {
    const input = {
      name: values.name,
      description: values.description,
      price: values.price,
      taxPercent: values.taxPercent,
      prepTimeMinutes: values.prepTimeMinutes,
      foodLabel: values.foodLabel,
      category: values.category,
      isFeatured: values.isFeatured,
      isRecommended: values.isRecommended,
      availability: values.availability,
    };
    if (itemDialog.item) {
      await m.updateItem.mutateAsync({ id: itemDialog.item._id, input });
      if (values.imageFile) {
        await m.uploadImage.mutateAsync({ id: itemDialog.item._id, file: values.imageFile });
      }
    } else {
      const res = await m.createItem.mutateAsync(input);
      const createdItem = res.data.data.item;
      if (values.imageFile) {
        await m.uploadImage.mutateAsync({ id: createdItem._id, file: values.imageFile });
      }
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Menu</h1>
        <KitchenSelect value={kitchenId} onChange={(id) => { setKitchenId(id); setActiveCat(''); }} />
      </div>

      {!kitchenId ? (
        <EmptyState title="Select a kitchen" description="Choose a kitchen to manage its menu." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Categories */}
          <div className="overflow-hidden">
            <h2 className="mb-2 text-sm font-bold uppercase text-zinc-500">Categories</h2>
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 scrollbar-none">
              <button
                onClick={() => setActiveCat('')}
                className={`rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap shrink-0 lg:w-full ${activeCat === '' ? 'bg-brand text-white' : 'bg-white lg:bg-transparent hover:bg-zinc-100 border lg:border-0'}`}
              >
                All items
              </button>
              {catLoading ? (
                <Spinner />
              ) : (
                categories?.map((c) => (
                  <div key={c._id} className="group flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setActiveCat(c._id)}
                      className={`rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap lg:flex-1 ${activeCat === c._id ? 'bg-brand text-white' : 'bg-white lg:bg-transparent hover:bg-zinc-100 border lg:border-0'}`}
                    >
                      {c.name}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete category "${c.name}"?`)) m.deleteCategory.mutate(c._id);
                      }}
                      className="px-1 text-zinc-300 hover:text-red-500 bg-white lg:bg-transparent rounded-lg border lg:border-0 h-9 w-9 flex items-center justify-center lg:h-auto lg:w-auto"
                      aria-label="Delete category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="New category"
                className="h-9 flex-1 rounded-lg border border-zinc-300 px-2 text-sm"
              />
              <Button
                size="sm"
                disabled={!newCat.trim() || m.createCategory.isPending}
                onClick={() => m.createCategory.mutate({ name: newCat.trim() }, { onSuccess: () => setNewCat('') })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase text-zinc-500">Items</h2>
              <Button size="sm" disabled={!categories?.length} onClick={() => setItemDialog({ open: true })}>
                <Plus className="h-4 w-4" /> New item
              </Button>
            </div>
            {itemsLoading ? (
              <CenteredSpinner />
            ) : !items || items.length === 0 ? (
              <EmptyState title="No items" description={categories?.length ? 'Add your first item.' : 'Create a category first.'} />
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <Card key={it._id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                      {it.image?.url ? (
                        <Image src={it.image.url} alt={it.name} width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="h-14 w-14 shrink-0 rounded-lg bg-zinc-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FoodLabel label={it.foodLabel} />
                          <p className="truncate text-sm font-semibold text-zinc-900">{it.name}</p>
                          {it.isFeatured ? <Badge className="bg-brand-100 text-brand-700">Featured</Badge> : null}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{formatINR(it.price)} · {it.prepTimeMinutes}m</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 border-t pt-2 sm:border-t-0 sm:pt-0 w-full sm:w-auto">
                      <button
                        onClick={() => m.setStock.mutate({ id: it._id, inStock: !it.inStock })}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${it.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {it.inStock ? 'In stock' : 'Out'}
                      </button>
                      <div className="flex items-center gap-1">
                        <ImageUploadButton itemId={it._id} kitchenId={kitchenId} />
                        <Button variant="ghost" size="sm" onClick={() => setItemDialog({ open: true, item: it })} aria-label="Edit item">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirm(`Delete "${it.name}"?`) && m.deleteItem.mutate(it._id)}
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-4 w-4 text-zinc-400" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {itemDialog.open ? (
        <ItemFormDialog
          open
          onClose={() => setItemDialog({ open: false })}
          categories={categories ?? []}
          initial={itemDialog.item}
          onSubmit={saveItem}
        />
      ) : null}
    </div>
  );
}

function Spinner() {
  return <div className="py-4"><CenteredSpinner /></div>;
}

export default function AdminMenuPage() {
  return (
    <AdminShell>
      <MenuManager />
    </AdminShell>
  );
}
