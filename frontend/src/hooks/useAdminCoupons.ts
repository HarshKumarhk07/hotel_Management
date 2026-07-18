'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Coupon {
  _id: string;
  code: string;
  description?: string;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  maxDiscount?: number;
  minOrderValue: number;
  usageLimit?: number;
  perUserLimit: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
}

export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  maxDiscount?: number;
  minOrderValue?: number;
  usageLimit?: number;
  perUserLimit?: number;
  expiresAt?: string;
}

export function useAdminCoupons() {
  return useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const res = await api.get<{ data: { coupons: Coupon[] } }>('/coupons?limit=100');
      return res.data.data.coupons;
    },
  });
}

export function useCouponMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-coupons'] });

  const create = useMutation({
    mutationFn: (input: CreateCouponInput) => api.post('/coupons', input),
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/coupons/${id}`, { isActive }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: invalidate,
  });

  return { create, toggle, remove };
}
