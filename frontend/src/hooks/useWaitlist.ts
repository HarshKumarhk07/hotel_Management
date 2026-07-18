'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface WaitlistEntry {
  _id: string;
  guestName: string;
  phone: string;
  email: string;
  guestsCount: number;
  position: number;
  status: 'PENDING' | 'SEATED' | 'CANCELLED';
  assignedTable?: { _id: string; number: string; capacity: number } | string;
  createdAt: string;
}

export function useWaitlistQueue(status?: 'PENDING' | 'SEATED' | 'CANCELLED') {
  return useQuery({
    queryKey: ['restaurant-waitlist', status],
    queryFn: async () => {
      const res = await api.get<{ data: { waitlist: WaitlistEntry[] } }>('/restaurant/waitlist', {
        params: { status },
      });
      return res.data.data.waitlist;
    },
  });
}

export function useGuestWaitlistStatus(emailOrPhone: string, enabled = false) {
  return useQuery({
    queryKey: ['guest-waitlist-status', emailOrPhone],
    enabled: enabled && !!emailOrPhone,
    queryFn: async () => {
      const isEmail = emailOrPhone.includes('@');
      const params = isEmail ? { email: emailOrPhone } : { phone: emailOrPhone };
      const res = await api.get<{
        data: {
          status: 'PENDING' | 'SEATED' | 'CANCELLED';
          position: number;
          estimatedWaitMinutes: number;
          guestName: string;
          guestsCount: number;
        };
      }>('/restaurant/waitlist/status', { params });
      return res.data.data;
    },
  });
}

export function useWaitlistMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['restaurant-waitlist'] });
    qc.invalidateQueries({ queryKey: ['admin-tables'] }); // also refresh tables floor plan
  };

  const join = useMutation({
    mutationFn: (input: { guestName: string; phone: string; email: string; guestsCount: number }) =>
      api.post<{ data: { waitlist: WaitlistEntry } }>('/restaurant/waitlist', input),
    onSuccess: invalidate,
  });

  const seat = useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: string }) =>
      api.patch(`/restaurant/waitlist/${id}/seat`, { tableId }),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.patch(`/restaurant/waitlist/${id}/cancel`),
    onSuccess: invalidate,
  });

  const autoAssign = useMutation({
    mutationFn: () => api.post('/restaurant/waitlist/auto-assign'),
    onSuccess: invalidate,
  });

  return { join, seat, cancel, autoAssign };
}
