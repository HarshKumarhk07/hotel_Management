'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Category {
  _id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AvailabilityWindow {
  days?: number[];
  start: string;
  end: string;
}

export interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  price: number;
  taxPercent: number;
  prepTimeMinutes: number;
  foodLabel: 'VEG' | 'NON_VEG' | 'JAIN';
  image?: { url: string };
  inStock: boolean;
  stockQuantity: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isRecommended: boolean;
  category: { _id: string; name: string } | string;
  availability: { scheduled: boolean; timezone: string; windows: AvailabilityWindow[] };
}

export function useCategories(kitchenId: string) {
  return useQuery({
    queryKey: ['admin-categories', kitchenId],
    enabled: Boolean(kitchenId),
    queryFn: async () => {
      const res = await api.get<{ data: { categories: Category[] } }>(
        `/menu/categories?kitchen=${kitchenId}`,
      );
      return res.data.data.categories;
    },
  });
}

export function useMenuItems(kitchenId: string, categoryId?: string) {
  return useQuery({
    queryKey: ['admin-menu-items', kitchenId, categoryId ?? 'all'],
    enabled: Boolean(kitchenId),
    queryFn: async () => {
      const params = new URLSearchParams({ kitchen: kitchenId, limit: '200' });
      if (categoryId) params.set('category', categoryId);
      const res = await api.get<{ data: { items: MenuItem[] } }>(`/menu/items?${params}`);
      return res.data.data.items;
    },
  });
}

export function useMenuMutations(kitchenId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-categories', kitchenId] });
    qc.invalidateQueries({ queryKey: ['admin-menu-items', kitchenId] });
  };

  const createCategory = useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      api.post('/menu/categories', { ...input, kitchen: kitchenId }),
    onSuccess: invalidate,
  });
  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/categories/${id}`),
    onSuccess: invalidate,
  });

  const createItem = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post('/menu/items', { ...input, kitchen: kitchenId }),
    onSuccess: invalidate,
  });
  const updateItem = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      api.patch(`/menu/items/${id}`, input),
    onSuccess: invalidate,
  });
  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/items/${id}`),
    onSuccess: invalidate,
  });
  const setStock = useMutation({
    mutationFn: ({ id, inStock }: { id: string; inStock: boolean }) =>
      api.patch(`/menu/items/${id}/stock`, { inStock }),
    onSuccess: invalidate,
  });
  const uploadImage = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('image', file);
      return api.post(`/menu/items/${id}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: invalidate,
  });

  return {
    createCategory,
    deleteCategory,
    createItem,
    updateItem,
    deleteItem,
    setStock,
    uploadImage,
  };
}
