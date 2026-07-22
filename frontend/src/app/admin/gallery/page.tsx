'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Card, CenteredSpinner } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Image as ImageIcon, Plus, Trash2, Edit2, UploadCloud } from 'lucide-react';
import Image from 'next/image';

interface GalleryImage {
  _id: string;
  url: string;
  title: string;
  description?: string;
  category?: string;
  order: number;
  isActive: boolean;
}

export default function AdminGalleryPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<GalleryImage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { status } = useAuthStore();

  const { data: imagesData, isLoading } = useQuery<{ data: { images: GalleryImage[] } }>({
    queryKey: ['admin-gallery'],
    queryFn: () => api.get('/gallery/admin').then(res => res.data),
    enabled: status === 'authenticated',
  });

  const images = imagesData?.data?.images || [];

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      title: '',
      description: '',
      category: 'General',
      url: '',
      isActive: true,
      order: 0,
    }
  });

  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit } = useForm<GalleryImage>();

  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/gallery/admin', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gallery'] });
      setShowCreate(false);
      reset();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GalleryImage> }) => api.patch(`/gallery/admin/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gallery'] });
      setEditTarget(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gallery/admin/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gallery'] });
      setDeleteTarget(null);
    }
  });

  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);
      setUploadError(null);
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setValue('url', res.data.data.url);
    } catch (err) {
      setUploadError(apiErrorMessage(err, 'Failed to upload image'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 font-sans">Gallery Management</h1>
            <p className="text-sm text-zinc-500 mt-1 font-sans">Manage images displayed on the public gallery page.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-[#D4AF37] hover:bg-[#AE963C] text-white flex gap-2">
            <Plus className="w-4 h-4" /> Add Image
          </Button>
        </div>

        {isLoading ? (
          <CenteredSpinner />
        ) : images.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-300">
            <ImageIcon className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900">No images yet</h3>
            <p className="text-sm text-zinc-500 mt-1">Upload photos to showcase your hotel.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map(img => (
              <Card key={img._id} className="overflow-hidden bg-white border rounded-2xl group flex flex-col">
                <div className="relative h-48 w-full bg-zinc-100">
                  <Image src={img.url} alt={img.title} fill className={`object-cover ${!img.isActive ? 'grayscale opacity-50' : ''}`} />
                  {!img.isActive && (
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase">
                      Hidden
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex-1">
                    <h3 className="font-bold text-zinc-900 text-sm truncate">{img.title}</h3>
                    <p className="text-xs text-[#D4AF37] font-semibold mt-0.5">{img.category}</p>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="flex-1 h-8 text-xs font-semibold"
                      onClick={() => {
                        setEditTarget(img);
                        resetEdit(img);
                      }}
                    >
                      <Edit2 className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                      onClick={() => setDeleteTarget(img._id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} title="Upload Gallery Image" widthClass="max-w-md">
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4 font-sans">
            <Field label="Image File *">
              {!watch('url') ? (
                <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${uploading ? 'bg-zinc-50 border-zinc-200 cursor-not-allowed' : 'hover:bg-zinc-50 border-zinc-300'}`}>
                  {uploading ? <CenteredSpinner /> : <UploadCloud className="w-8 h-8 text-zinc-400 mb-2" />}
                  <span className="text-sm font-semibold text-zinc-600">{uploading ? 'Uploading...' : 'Click to select image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    disabled={uploading}
                  />
                </label>
              ) : (
                <div className="relative h-40 rounded-xl overflow-hidden border">
                  <Image src={watch('url')} alt="Preview" fill className="object-cover" />
                  <button type="button" onClick={() => setValue('url', '')} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              {uploadError && <p className="text-red-500 text-xs mt-1">{uploadError}</p>}
            </Field>

            <Field label="Title *">
              <Input {...register('title', { required: true })} placeholder="e.g. Presidential Suite" />
            </Field>
            
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select {...register('category')} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]">
                  <option value="Rooms">Rooms</option>
                  <option value="Dining">Dining</option>
                  <option value="Amenities">Amenities</option>
                  <option value="Exterior">Exterior</option>
                  <option value="General">General</option>
                </select>
              </Field>
              <Field label="Sort Order">
                <Input type="number" {...register('order', { valueAsNumber: true })} />
              </Field>
            </div>

            <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#AE963C] text-white" disabled={createMutation.isPending || uploading || !watch('url')}>
              {createMutation.isPending ? 'Saving...' : 'Upload Image'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Dialog open onClose={() => setEditTarget(null)} title="Edit Image Details" widthClass="max-w-md">
          <form onSubmit={handleEdit(d => updateMutation.mutate({ id: editTarget._id, data: d }))} className="space-y-4 font-sans">
            <div className="relative h-40 rounded-xl overflow-hidden border mb-4">
              <Image src={editTarget.url} alt={editTarget.title} fill className="object-cover" />
            </div>

            <Field label="Title *">
              <Input {...regEdit('title', { required: true })} />
            </Field>
            
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select {...regEdit('category')} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]">
                  <option value="Rooms">Rooms</option>
                  <option value="Dining">Dining</option>
                  <option value="Amenities">Amenities</option>
                  <option value="Exterior">Exterior</option>
                  <option value="General">General</option>
                </select>
              </Field>
              <Field label="Sort Order">
                <Input type="number" {...regEdit('order', { valueAsNumber: true })} />
              </Field>
            </div>

            <Field label="Visibility">
              <select {...regEdit('isActive', {
                  setValueAs: v => v === 'true' || v === true
                })} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]">
                <option value="true">Active (Visible)</option>
                <option value="false">Hidden</option>
              </select>
            </Field>

            <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#AE963C] text-white" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)} title="Delete Image" widthClass="max-w-sm">
          <div className="space-y-4 font-sans text-center">
            <Trash2 className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-zinc-600 text-sm">Are you sure you want to delete this image? It will be removed from the gallery immediately.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteMutation.mutate(deleteTarget)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </AdminShell>
  );
}
