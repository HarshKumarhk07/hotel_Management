'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Image as ImageIcon, Link as LinkIcon, Calendar } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useAdminKitchens } from '@/hooks/useAdminKitchens';

// ── Validation schemas ─────────────────────────────────────────────────────────

const bannerSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  subtitle: z.string().trim().max(250).optional(),
  imageUrl: z.string().url('Invalid image URL format'),
  linkUrl: z.string().trim().optional(),
  isActive: z.boolean().default(true),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  kitchenId: z.string().optional().or(z.literal('')),
});

type BannerForm = z.infer<typeof bannerSchema>;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Banner {
  _id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  kitchen?: string;
}

// ── Main Page Component ────────────────────────────────────────────────────────

export default function BannerManagementPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const status = useAuthStore(s => s.status);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Banner | null>(null);
  const [kitchenIdFilter, setKitchenIdFilter] = useState('');
  const [error, setError] = useState('');

  // Fetch kitchens (for selection when creating banners)
  const { data: kitchens } = useAdminKitchens();

  // Fetch all banners
  const { data: bannersData, isLoading } = useQuery<{ data: { banners: Banner[] } }>({
    queryKey: ['admin-banners', kitchenIdFilter],
    queryFn: () => {
      const q = kitchenIdFilter ? `?kitchenId=${kitchenIdFilter}` : '';
      return api.get(`/banners${q}`).then(r => r.data);
    },
    enabled: status === 'authenticated',
  });
  const banners = bannersData?.data?.banners ?? [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (d: BannerForm) => api.post('/banners', { ...d, kitchenId: d.kitchenId || kitchenIdFilter || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-banners'] }); setShowCreate(false); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<BannerForm> }) => api.patch(`/banners/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-banners'] }); setEditTarget(null); },
    onError: e => setError(apiErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/banners/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
    onError: e => setError(apiErrorMessage(e)),
  });

  // Forms
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<BannerForm>({
    resolver: zodResolver(bannerSchema),
  });

  const { register: regEdit, handleSubmit: handleEdit, formState: { errors: editErrors }, reset: resetEdit, setValue: setEditValue, watch: watchEdit } = useForm<BannerForm>({
    resolver: zodResolver(bannerSchema),
  });

  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (file: File, isEdit: boolean) => {
    if (!file) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.post<{ data: { url: string } }>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.data.url;
      if (isEdit) {
        setEditValue('imageUrl', url);
      } else {
        setValue('imageUrl', url);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to upload image'));
    } finally {
      setUploading(false);
    }
  };

  const imageUrl = watch('imageUrl');
  const editImageUrl = watchEdit('imageUrl');

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 font-sans">Banners & Promotions</h1>
            <p className="text-sm text-zinc-500 mt-0.5 font-sans">Manage customer-facing banners and restaurant promotions</p>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === 'SUPER_ADMIN' && (
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
                value={kitchenIdFilter}
                onChange={e => setKitchenIdFilter(e.target.value)}
              >
                <option value="">All Kitchens</option>
                {kitchens?.map(k => (
                  <option key={k._id} value={k._id}>{k.name}</option>
                ))}
              </select>
            )}
            <Button size="sm" onClick={() => { reset(); setShowCreate(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Banner
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between font-sans">
            {error}
            <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <CenteredSpinner />
        ) : banners.length === 0 ? (
          <Card className="py-16 text-center">
            <ImageIcon className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
            <p className="text-zinc-500 font-medium font-sans">No banners found</p>
            <p className="text-sm text-zinc-400 mt-1 font-sans">Create banners to advertise discount codes and special items.</p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {banners.map(banner => (
              <Card key={banner._id} className="overflow-hidden hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  {/* Image container */}
                  <div className="relative h-40 bg-zinc-100 overflow-hidden flex items-center justify-center">
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    <Badge className={`absolute top-3 right-3 ${
                      banner.isActive
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                    }`}>
                      {banner.isActive ? 'Active' : 'Draft'}
                    </Badge>
                  </div>

                  {/* Banner Content */}
                  <div className="p-4 space-y-2">
                    <h3 className="font-bold text-zinc-900 text-base font-sans">{banner.title}</h3>
                    {banner.subtitle && (
                      <p className="text-xs text-zinc-500 font-sans">{banner.subtitle}</p>
                    )}

                    <div className="pt-2 text-xs text-zinc-500 space-y-1.5 font-sans">
                      {banner.linkUrl && (
                        <p className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5 text-zinc-400" /> Link: <strong className="truncate">{banner.linkUrl}</strong></p>
                      )}
                      {(banner.startDate || banner.endDate) && (
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                          <span>
                            {banner.startDate ? new Date(banner.startDate).toLocaleDateString() : 'Now'} - {banner.endDate ? new Date(banner.endDate).toLocaleDateString() : 'Forever'}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 font-sans"
                    onClick={() => {
                      resetEdit({
                        title: banner.title,
                        subtitle: banner.subtitle || '',
                        imageUrl: banner.imageUrl,
                        linkUrl: banner.linkUrl || '',
                        isActive: banner.isActive,
                        startDate: banner.startDate ? new Date(banner.startDate).toISOString().slice(0, 16) : '',
                        endDate: banner.endDate ? new Date(banner.endDate).toISOString().slice(0, 16) : '',
                        kitchenId: banner.kitchen || '',
                      });
                      setEditTarget(banner);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 border-red-200 font-sans"
                    onClick={() => {
                      if (confirm(`Delete banner "${banner.title}"?`)) {
                        deleteMutation.mutate(banner._id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Banner Modal */}
      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} title="Add Banner" widthClass="max-w-md">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <Field label="Banner Title *">
              <Input {...register('title')} placeholder="Special 20% Discount" />
              <FieldError message={errors.title?.message} />
            </Field>
            <Field label="Subtitle / Description">
              <Input {...register('subtitle')} placeholder="Applies on dining orders this weekend" />
            </Field>
            <Field label="Banner Image *">
              <div className="space-y-2">
                {imageUrl && (
                  <div className="relative h-28 w-full rounded-lg border overflow-hidden bg-zinc-50 flex items-center justify-center">
                    <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors shadow-sm font-sans">
                    {uploading ? 'Uploading…' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, false);
                      }}
                      disabled={uploading}
                    />
                  </label>
                  <span className="text-xs text-zinc-400 truncate max-w-[200px] font-sans">
                    {imageUrl || 'No image uploaded'}
                  </span>
                </div>
                <input type="hidden" {...register('imageUrl')} />
                <FieldError message={errors.imageUrl?.message} />
              </div>
            </Field>
            <Field label="Target Link URL">
              <Input {...register('linkUrl')} placeholder="/menu?category=special" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date">
                <Input type="datetime-local" {...register('startDate')} />
              </Field>
              <Field label="End Date">
                <Input type="datetime-local" {...register('endDate')} />
              </Field>
            </div>

            {user?.role === 'SUPER_ADMIN' && (
              <Field label="Scope Kitchen">
                <select
                  {...register('kitchenId')}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
                >
                  <option value="">Global / All Kitchens</option>
                  {kitchens?.map(k => (
                    <option key={k._id} value={k._id}>{k.name}</option>
                  ))}
                </select>
              </Field>
            )}

            <Button type="submit" className="w-full font-sans" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Create Banner'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Edit Banner Modal */}
      {editTarget && (
        <Dialog open onClose={() => setEditTarget(null)} title="Edit Banner" widthClass="max-w-md">
          <form onSubmit={handleEdit(d => updateMutation.mutate({ id: editTarget._id, d }))} className="space-y-4">
            <Field label="Banner Title *">
              <Input {...regEdit('title')} />
              <FieldError message={editErrors.title?.message} />
            </Field>
            <Field label="Subtitle / Description">
              <Input {...regEdit('subtitle')} />
            </Field>
            <Field label="Banner Image *">
              <div className="space-y-2">
                {editImageUrl && (
                  <div className="relative h-28 w-full rounded-lg border overflow-hidden bg-zinc-50 flex items-center justify-center">
                    <img src={editImageUrl} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors shadow-sm font-sans">
                    {uploading ? 'Uploading…' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, true);
                      }}
                      disabled={uploading}
                    />
                  </label>
                  <span className="text-xs text-zinc-400 truncate max-w-[200px] font-sans">
                    {editImageUrl || 'No image uploaded'}
                  </span>
                </div>
                <input type="hidden" {...regEdit('imageUrl')} />
                <FieldError message={editErrors.imageUrl?.message} />
              </div>
            </Field>
            <Field label="Target Link URL">
              <Input {...regEdit('linkUrl')} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date">
                <Input type="datetime-local" {...regEdit('startDate')} />
              </Field>
              <Field label="End Date">
                <Input type="datetime-local" {...regEdit('endDate')} />
              </Field>
            </div>

            <Field label="Active Banner State">
              <select
                {...regEdit('isActive')}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-sans"
                value={editTarget.isActive ? 'true' : 'false'}
                onChange={e => setEditTarget({ ...editTarget, isActive: e.target.value === 'true' })}
              >
                <option value="true">Active (Visible)</option>
                <option value="false">Draft (Hidden)</option>
              </select>
            </Field>

            <Button type="submit" className="w-full font-sans" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </Dialog>
      )}
    </AdminShell>
  );
}
