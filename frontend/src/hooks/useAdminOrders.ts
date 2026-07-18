'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AdminOrderItem {
  menuItem: string;
  name: string;
  foodLabel: string;
  quantity: number;
  cancelledQuantity: number;
  lineTotal: number;
}

export interface AdminOrder {
  _id: string;
  orderNumber: string;
  status: string;
  roomSnapshot?: { roomNumber: string; floor: number };
  tableSnapshot?: { number: string; section?: string };
  items: AdminOrderItem[];
  pricing: { subtotal: number; taxTotal: number; serviceCharge: number; discount: number; total: number };
  payment: { method: string; status: string; amount: number };
  refund: { status: string; amount: number; reason?: string };
  statusHistory: { status: string; at: string; note?: string }[];
  internalNotes?: { note: string; at: string }[];
  createdAt: string;
}

export function useAdminOrders(filters: { status?: string; kitchen?: string }) {
  return useQuery({
    queryKey: ['admin-orders', filters.status ?? '', filters.kitchen ?? ''],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filters.status) params.set('status', filters.status);
      if (filters.kitchen) params.set('kitchen', filters.kitchen);
      const res = await api.get<{ data: { orders: AdminOrder[] } }>(`/orders?${params}`);
      return res.data.data.orders;
    },
  });
}

export function useAdminOrder(orderId: string | null) {
  return useQuery({
    queryKey: ['admin-order', orderId],
    enabled: Boolean(orderId),
    queryFn: async () => {
      const res = await api.get<{ data: { order: AdminOrder } }>(`/orders/${orderId}`);
      return res.data.data.order;
    },
  });
}

export function useOrderAdminMutations(orderId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
    qc.invalidateQueries({ queryKey: ['admin-order', orderId] });
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/orders/${id}/cancel`, { reason }),
    onSuccess: invalidate,
  });
  const addNote = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/orders/${id}/notes`, { note }),
    onSuccess: invalidate,
  });
  const refund = useMutation({
    mutationFn: ({ id }: { id: string }) => api.post(`/payments/orders/${id}/refund`, {}),
    onSuccess: invalidate,
  });

  return { setStatus, cancel, addNote, refund };
}
