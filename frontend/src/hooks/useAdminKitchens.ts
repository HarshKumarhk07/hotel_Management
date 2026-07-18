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
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-kitchens'] });

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

  return { create, setActive, update };
}
