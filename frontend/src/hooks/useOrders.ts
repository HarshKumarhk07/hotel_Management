'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';

export interface OrderItem {
  menuItem: string;
  name: string;
  foodLabel: string;
  unitPrice: number;
  quantity: number;
  cancelledQuantity: number;
  lineTotal: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  roomSnapshot?: { roomNumber: string; floor: number };
  tableSnapshot?: { number: string; section?: string };
  items: OrderItem[];
  pricing: { subtotal: number; taxTotal: number; serviceCharge: number; discount: number; total: number };
  payment: { method: string; status: string; amount: number };
  refund: { status: string; amount: number };
  statusHistory: { status: string; at: string; note?: string }[];
  estimatedPrepMinutes: number;
  createdAt: string;
}

export function useMyOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await api.get<{ data: { orders: Order[] } }>('/orders/my?limit=50');
      return res.data.data.orders;
    },
  });
}

export function useOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);

  const query = useQuery({
    queryKey: ['order', orderId],
    enabled: Boolean(orderId) && status === 'authenticated',
    queryFn: async () => {
      const res = await api.get<{ data: { order: Order } }>(`/orders/my/${orderId}`);
      return res.data.data.order;
    },
    refetchInterval: 20_000, // polling fallback if the socket drops
  });

  // Live updates: refetch this order when the backend emits an order/payment event.
  useEffect(() => {
    if (!orderId || status !== 'authenticated') return;
    const socket = getSocket();
    const refetch = () => {
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    };
    socket.on('order:updated', refetch);
    socket.on('order:cancelled', refetch);
    socket.on('payment:updated', refetch);
    socket.on('refund:updated', refetch);
    return () => {
      socket.off('order:updated', refetch);
      socket.off('order:cancelled', refetch);
      socket.off('payment:updated', refetch);
      socket.off('refund:updated', refetch);
    };
  }, [orderId, status, queryClient]);

  return query;
}
