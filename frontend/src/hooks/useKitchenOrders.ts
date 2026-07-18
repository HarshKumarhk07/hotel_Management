'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { playNewOrderChime } from '@/lib/sound';
import { useAuthStore } from '@/stores/auth';
import type { Order } from './useOrders';

/** Statuses that belong on the active kitchen board (terminal ones drop off). */
const ACTIVE = ['NEW_ORDER', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

export function useKitchenOrders() {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const knownIds = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ['kitchen-orders'],
    enabled: status === 'authenticated',
    refetchInterval: 15_000,
    queryFn: async () => {
      // Pull recent orders; the board filters to the active statuses.
      const res = await api.get<{ data: { orders: Order[] } }>('/orders?limit=100');
      return res.data.data.orders;
    },
  });

  // Seed the "known orders" set so we only chime for genuinely new ones.
  useEffect(() => {
    if (query.data) {
      for (const o of query.data) knownIds.current.add(o._id);
    }
  }, [query.data]);

  // Live: a new order chimes + refetches; updates just refetch.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const socket = getSocket();
    const onNew = (payload: { orderId: string }) => {
      if (!knownIds.current.has(payload.orderId)) {
        knownIds.current.add(payload.orderId);
        playNewOrderChime();
      }
      void queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    };
    const onUpdate = () => queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    socket.on('order:new', onNew);
    socket.on('order:updated', onUpdate);
    socket.on('order:cancelled', onUpdate);
    return () => {
      socket.off('order:new', onNew);
      socket.off('order:updated', onUpdate);
      socket.off('order:cancelled', onUpdate);
    };
  }, [status, queryClient]);

  const active = (query.data ?? []).filter((o) => ACTIVE.includes(o.status));
  return { ...query, active };
}

export function useOrderActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });

  const setStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch(`/orders/${id}/status`, { status, note }),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/orders/${id}/cancel`, { reason }),
    onSuccess: invalidate,
  });

  return { setStatus, cancel };
}
