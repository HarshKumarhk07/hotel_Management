'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

export interface AdminKitchen {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  contactEmail?: string;
  owner?: { _id: string; name: string; email: string; isActive: boolean };
  settings: {
    serviceChargePercent: number;
    taxPercent: number;
    acceptsCOD: boolean;
    acceptsRoomBilling: boolean;
  };
}

export interface CreateKitchenInput {
  name: string;
  description?: string;
  contactEmail?: string;
  settings?: {
    serviceChargePercent?: number;
    taxPercent?: number;
    acceptsCOD?: boolean;
    acceptsRoomBilling?: boolean;
  };
  owner?: { name: string; email: string; password: string };
}

export function useAdminKitchens() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: ['admin-kitchens'],
    queryFn: async () => {
      const res = await api.get<{ data: { kitchens: AdminKitchen[] } }>('/kitchens?limit=100');
      return res.data.data.kitchens;
    },
    enabled: status === 'authenticated',
  });
}

export function useKitchenMutations() {
  const qc = useQueryClient();
  // Invalidate every view that reads a kitchen so a save is reflected everywhere
  // immediately — the admin list, the owner's own kitchen (settings / operating
  // hours), and the owner dashboard. Without this, the 30s query cache showed
  // stale data on return and made saves look like they were lost.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-kitchens'] });
    qc.invalidateQueries({ queryKey: ['kitchen-self'] });
    qc.invalidateQueries({ queryKey: ['kitchen-dashboard'] });
  };

  const create = useMutation({
    mutationFn: (input: CreateKitchenInput) => api.post('/kitchens', input),
    onSuccess: invalidate,
  });
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/kitchens/${id}/${active ? 'activate' : 'deactivate'}`),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: any }) => api.patch(`/kitchens/${id}`, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/kitchens/${id}`),
    onSuccess: invalidate,
  });

  return { create, setActive, update, remove };
}
