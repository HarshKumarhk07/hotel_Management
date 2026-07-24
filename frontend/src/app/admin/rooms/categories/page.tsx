'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import { api, apiErrorMessage } from '@/lib/api';
import { Plus, Edit2, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { formatINR } from '@/lib/utils';

interface RoomCategory {
  _id: string;
  /** Free-form: categories are configurable, so this is not a closed union. */
  roomType: string;
  displayName: string;
  pricePerNight: number;
  capacity: number;
  amenities: string[];
  images: string[];
  description: string;
}

interface CategoryAudit {
  categories: { _id: string; roomType: string; displayName: string; pricePerNight: number; roomCount: number }[];
  totalRooms: number;
  orphanCount: number;
  orphanGroups: { roomType: string; count: number; rooms: { _id: string; roomNumber: string; floor: number }[] }[];
  isConsistent: boolean;
}

/**
 * Surfaces rooms pointing at a category that no longer exists (the "EXECUTIVE
 * rooms with only Standard/Deluxe categories" case) and offers a one-click
 * migration onto a real category.
 */
function CategoryConsistencyPanel({ categories }: { categories: RoomCategory[] }) {
  const qc = useQueryClient();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: audit, isLoading } = useQuery({
    queryKey: ['room-category-audit'],
    queryFn: async () => {
      const res = await api.get<{ data: { audit: CategoryAudit } }>('/rooms/categories-audit');
      return res.data.data.audit;
    },
  });

  const migrate = useMutation({
    mutationFn: ({ fromRoomType, toRoomType }: { fromRoomType: string; toRoomType: string }) =>
      api.post('/rooms/categories-migrate', { fromRoomType, toRoomType }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['room-category-audit'] });
      qc.invalidateQueries({ queryKey: ['admin-rooms'] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'Failed to migrate rooms')),
  });

  if (isLoading || !audit) return null;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            {audit.isConsistent ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            )}
            Category Consistency
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {audit.isConsistent
              ? `All ${audit.totalRooms} rooms reference an existing category.`
              : `${audit.orphanCount} of ${audit.totalRooms} rooms reference a category that no longer exists. These rooms cannot be filtered or booked correctly until migrated.`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {audit.categories.map((c) => (
          <span
            key={c._id}
            className="text-[11px] bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-md font-semibold"
          >
            {c.displayName} · {c.roomCount} room{c.roomCount === 1 ? '' : 's'}
          </span>
        ))}
      </div>

      {error && <FieldError message={error} />}

      {!audit.isConsistent && (
        <div className="space-y-3 border-t pt-4">
          {audit.orphanGroups.map((g) => (
            <div
              key={g.roomType}
              className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-xs text-amber-900">
                <b>{g.roomType}</b> — {g.count} room{g.count === 1 ? '' : 's'} (
                {g.rooms.slice(0, 5).map((r) => r.roomNumber).join(', ')}
                {g.rooms.length > 5 ? `, +${g.rooms.length - 5} more` : ''})
              </div>
              <div className="flex gap-2">
                <select
                  value={targets[g.roomType] ?? ''}
                  onChange={(e) => setTargets((p) => ({ ...p, [g.roomType]: e.target.value }))}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-xs"
                >
                  <option value="">— Migrate to —</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c.roomType}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!targets[g.roomType] || migrate.isPending}
                  onClick={() =>
                    migrate.mutate({ fromRoomType: g.roomType, toRoomType: targets[g.roomType] })
                  }
                  className="bg-[#D4AF37] hover:bg-[#AE963C] text-white text-xs"
                >
                  Migrate
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function RoomCategoriesPage() {
  const qc = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<RoomCategory | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-room-categories'],
    queryFn: async () => {
      const res = await api.get<{ data: { categories: RoomCategory[] } }>('/rooms/categories');
      return res.data.data.categories;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rooms/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-room-categories'] });
      qc.invalidateQueries({ queryKey: ['room-category-audit'] });
    },
    onError: (err) => {
      setError(apiErrorMessage(err, 'Failed to delete category'));
    }
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the category "${name}"? This action cannot be undone.`)) {
      setError(null);
      deleteMutation.mutate(id);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Room Categories</h1>
            <p className="text-sm text-zinc-500 mt-1">Manage room types, pricing, and amenities.</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="bg-[#D4AF37] hover:bg-[#AE963C] text-white">
            <Plus className="h-4 w-4 mr-2" /> New Category
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" /> {error}
          </div>
        )}

        {categories && categories.length > 0 && <CategoryConsistencyPanel categories={categories} />}

        {isLoading ? (
          <CenteredSpinner />
        ) : !categories || categories.length === 0 ? (
          <EmptyState 
            title="No Room Categories" 
            description="Create your first room category to start managing inventory." 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <Card key={cat._id} className="p-0 overflow-hidden bg-white border-zinc-200 shadow-sm flex flex-col">
                {cat.images && cat.images.length > 0 ? (
                  <div className="h-48 bg-zinc-100 relative">
                    <img src={cat.images[0]} alt={cat.displayName} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-48 bg-zinc-100 flex items-center justify-center text-zinc-400 text-sm font-semibold uppercase tracking-widest">
                    No Image
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-lg font-bold text-zinc-900">{cat.displayName}</h2>
                    <span className="font-bold text-[#D4AF37]">{formatINR(cat.pricePerNight)}<span className="text-xs text-zinc-400 font-normal">/night</span></span>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{cat.description}</p>
                  
                  <div className="flex flex-wrap gap-1 mt-auto mb-4">
                    <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md font-semibold">
                      Up to {cat.capacity} Guests
                    </span>
                    {cat.amenities?.slice(0, 2).map((amenity, i) => (
                      <span key={i} className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md font-semibold">
                        {amenity}
                      </span>
                    ))}
                    {cat.amenities && cat.amenities.length > 2 && (
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md font-semibold">
                        +{cat.amenities.length - 2} more
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="outline" size="sm" onClick={() => setEditingCategory(cat)} className="text-zinc-700">
                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() => handleDelete(cat._id, cat.displayName)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {(isCreateModalOpen || editingCategory) && (
        <CategoryModal 
          category={editingCategory} 
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingCategory(null);
          }} 
        />
      )}
    </AdminShell>
  );
}

function CategoryModal({ category, onClose }: { category: RoomCategory | null, onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: any) => {
      if (category) {
        return api.patch(`/rooms/categories/${category._id}`, values);
      } else {
        const payload = {
          ...values,
          roomType: values.displayName.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
        };
        return api.post('/rooms/categories', payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-room-categories'] });
      qc.invalidateQueries({ queryKey: ['room-category-audit'] });
      onClose();
    },
    onError: (err) => {
      setError(apiErrorMessage(err, 'Failed to save category'));
    }
  });

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm({
    defaultValues: category || {
      displayName: '',
      description: '',
      pricePerNight: 0,
      capacity: 2,
      amenities: ['Wi-Fi', 'AC'],
      images: [''],
    }
  });

  const { fields: amenityFields, append: appendAmenity, remove: removeAmenity } = useFieldArray({ control, name: 'amenities' as never });
  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({ control, name: 'images' as never });
  const currentImages = watch('images') || [];
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await api.post<{ data: { url: string } }>('/rooms/categories/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      appendImage(res.data.data.url as never);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to upload image'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <Dialog open onClose={onClose} title={category ? 'Edit Category' : 'New Category'} widthClass="max-w-2xl">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
        {error && <FieldError message={error} />}
        
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Category Name *">
            <Input {...register('displayName', { required: 'Name is required' })} placeholder="e.g. Deluxe Suite" />
            {errors.displayName && <FieldError message={errors.displayName.message as string} />}
          </Field>
          
          <Field label="Base Price (INR) *">
            <Input type="number" {...register('pricePerNight', { valueAsNumber: true, required: 'Price is required' })} />
            {errors.pricePerNight && <FieldError message={errors.pricePerNight.message as string} />}
          </Field>
          
          <Field label="Max Capacity (Guests) *">
            <Input type="number" {...register('capacity', { valueAsNumber: true })} />
          </Field>
        </div>
        
        <Field label="Description">
          <textarea 
            {...register('description')} 
            rows={3}
            className="w-full text-sm rounded-xl border border-zinc-200 p-3 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
          />
        </Field>

        <div>
          <label className="text-sm font-bold text-zinc-700 mb-2 block">Amenities</label>
          <div className="space-y-2">
            {amenityFields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Input {...register(`amenities.${index}` as const)} placeholder="e.g. Free Wi-Fi" />
                <Button type="button" variant="outline" onClick={() => removeAmenity(index)}>Remove</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendAmenity('')}>
              + Add Amenity
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-zinc-700 mb-2 block">Images</label>
          <div className="space-y-4">
            {imageFields.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {imageFields.map((field, index) => (
                  <div key={field.id} className="relative group rounded-xl overflow-hidden border border-zinc-200 aspect-video bg-zinc-100">
                    <input type="hidden" {...register(`images.${index}` as const)} />
                    {currentImages[index] ? (
                      <img src={currentImages[index]} alt="Room image" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">No Image</div>
                    )}
                    <button 
                      type="button" 
                      onClick={() => removeImage(index)}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <input type="file" id="category-image-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('category-image-upload')?.click()} isLoading={isUploading}>
                Upload Image
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={mutation.isPending} className="bg-[#D4AF37] hover:bg-[#AE963C] text-white">
            Save Category
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
