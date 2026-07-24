'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AdminRoom {
  _id: string;
  roomNumber: string;
  floor: number;
  isActive: boolean;
  status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';
  kitchen?: { _id: string; name: string } | string;
  qr: { token: string; isActive: boolean; version: number };
  roomType?: string;
}

export type TransferKind = 'NORMAL' | 'UPGRADE' | 'DOWNGRADE';

export interface RoomTransfer {
  type: TransferKind;
  state: 'PENDING_PAYMENT' | 'COMPLETED' | 'CANCELLED';
  fromRoomNumber: string;
  toRoomNumber: string;
  fromRoomType: string;
  toRoomType: string;
  fromFloor: number;
  toFloor: number;
  nights: number;
  amountDue: number;
  refundAmount: number;
  refundStatus?: 'PENDING' | 'PROCESSED';
  requestedAt: string;
  completedAt?: string;
}

export interface TransferOption {
  _id: string;
  roomNumber: string;
  floor: number;
  roomType: string;
  pricePerNight: number;
  transferType: TransferKind;
  amountDue: number;
  refundAmount: number;
}

export interface TransferOptionsResponse {
  nights: number;
  currentRoom: {
    _id: string;
    roomNumber: string;
    floor: number;
    roomType: string;
    pricePerNight: number;
  };
  pendingTransfer: RoomTransfer | null;
  options: TransferOption[];
}

export interface RoomBookingInfo {
  _id: string;
  room: { _id: string; roomNumber: string; floor: number; roomType?: string };
  guestName: string;
  phone: string;
  email: string;
  idProofUrl?: string;
  idProofType?: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID';
  payment?: { method?: string; status?: string; paidAt?: string };
  transfers?: RoomTransfer[];
  pendingTransfer?: RoomTransfer | null;
  createdAt: string;
}

export function useAdminRooms() {
  return useQuery({
    queryKey: ['admin-rooms'],
    queryFn: async () => {
      const res = await api.get<{ data: { rooms: AdminRoom[] } }>('/rooms?limit=200');
      return res.data.data.rooms;
    },
  });
}

export function useRoomMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-rooms'] });

  const create = useMutation({
    mutationFn: (input: { roomNumber: string; floor: number; kitchen?: string; roomType?: string; category?: string }) =>
      api.post('/rooms', input),
    onSuccess: invalidate,
  });
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/rooms/${id}/${active ? 'activate' : 'deactivate'}`),
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/rooms/${id}/status`, { status }),
    onSuccess: invalidate,
  });
  const regenerateQr = useMutation({
    mutationFn: (id: string) => api.post(`/rooms/${id}/qr/generate`),
    onSuccess: invalidate,
  });
  const disableQr = useMutation({
    mutationFn: (id: string) => api.patch(`/rooms/${id}/qr/disable`),
    onSuccess: invalidate,
  });
  const reassignQr = useMutation({
    mutationFn: ({ id, targetRoomId }: { id: string; targetRoomId: string }) =>
      api.post(`/rooms/${id}/qr/reassign`, { targetRoomId }),
    onSuccess: invalidate,
  });

  return { create, setActive, setStatus, regenerateQr, disableQr, reassignQr };
}

export function useAdminBookings() {
  return useQuery({
    queryKey: ['admin-room-bookings'],
    queryFn: async () => {
      const res = await api.get<{ data: { bookings: RoomBookingInfo[] } }>('/rooms/admin/bookings?limit=100');
      return res.data.data.bookings;
    },
  });
}

export function useBookingMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-room-bookings'] });
    qc.invalidateQueries({ queryKey: ['admin-rooms'] });
  };

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/rooms/bookings/${id}/status`, { status }),
    onSuccess: invalidate,
  });

  const transfer = useMutation({
    mutationFn: ({ id, newRoomId }: { id: string; newRoomId: string }) =>
      api
        .post<{ data: { transfer: RoomTransfer } }>(`/rooms/bookings/${id}/transfer`, { newRoomId })
        .then((r) => r.data.data.transfer),
    onSuccess: invalidate,
  });

  const confirmTransferPayment = useMutation({
    mutationFn: (id: string) => api.post(`/rooms/bookings/${id}/transfer/confirm-payment`),
    onSuccess: invalidate,
  });

  const cancelTransfer = useMutation({
    mutationFn: (id: string) => api.post(`/rooms/bookings/${id}/transfer/cancel`),
    onSuccess: invalidate,
  });

  const markRefundProcessed = useMutation({
    mutationFn: (id: string) => api.post(`/rooms/bookings/${id}/transfer/refund-processed`),
    onSuccess: invalidate,
  });

  const recordPayment = useMutation({
    mutationFn: ({ id, status, method }: { id: string; status: 'PAID' | 'PENDING'; method?: string }) =>
      api.patch(`/rooms/bookings/${id}/payment`, { status, method }),
    onSuccess: invalidate,
  });

  return {
    updateStatus,
    transfer,
    confirmTransferPayment,
    cancelTransfer,
    markRefundProcessed,
    recordPayment,
  };
}

/** Legal transfer targets for a booking, annotated with the billing consequence. */
export function useTransferOptions(bookingId: string | null) {
  return useQuery({
    queryKey: ['booking-transfer-options', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const res = await api.get<{ data: TransferOptionsResponse }>(
        `/rooms/bookings/${bookingId}/transfer-options`,
      );
      return res.data.data;
    },
  });
}
