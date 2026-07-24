'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Plus, Power, QrCode, RefreshCw, Ban, ArrowLeftRight, Calendar, User, Phone, Mail, DollarSign, Printer, FileText } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner, EmptyState, Spinner } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAdminKitchens } from '@/hooks/useAdminKitchens';
import {
  useAdminRooms,
  useRoomMutations,
  useAdminBookings,
  useBookingMutations,
  useTransferOptions,
  type AdminRoom,
  type RoomBookingInfo,
} from '@/hooks/useAdminRooms';
import { api, apiErrorMessage } from '@/lib/api';
import { downloadAuthed } from '@/lib/download';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

// ── Create room ──
const createSchema = z.object({
  roomNumber: z.string().min(1, 'Room number is required'),
  floor: z.coerce.number().int(),
  kitchen: z.string().optional(),
  // A room can only exist against a real Room Category.
  roomType: z.string().min(1, 'Select a room category'),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateRoomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useRoomMutations();
  const { data: kitchens } = useQuery({
    queryKey: ['public-kitchens-list'],
    queryFn: async () => {
      const res = await api.get<{ data: { kitchens: { id: string; name: string }[] } }>('/kitchens/public');
      return res.data.data.kitchens;
    },
  });
  const { data: categories } = useQuery({
    queryKey: ['admin-room-categories-list'],
    queryFn: async () => {
      const res = await api.get<{ data: { categories: { _id: string; roomType: string; displayName: string }[] } }>('/rooms/categories');
      return res.data.data.categories;
    },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const onSubmit = async (values: CreateForm) => {
    setServerError(null);
    try {
      await create.mutateAsync({
        roomNumber: values.roomNumber,
        floor: values.floor,
        kitchen: values.kitchen || undefined,
        roomType: values.roomType,
      });
      reset();
      onClose();
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Could not create room'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New room">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Room number" error={errors.roomNumber?.message}>
            <Input placeholder="101" {...register('roomNumber')} />
          </Field>
          <Field label="Floor" error={errors.floor?.message}>
            <Input type="number" placeholder="1" {...register('floor')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Room Category" error={errors.roomType?.message}>
            <select
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              {...register('roomType')}
            >
              <option value="">— Select Category —</option>
              {categories?.map((c) => (
                <option key={c.roomType} value={c.roomType}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Serving kitchen">
            <select
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              {...register('kitchen')}
            >
              <option value="">— None —</option>
              {kitchens?.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {serverError ? <FieldError message={serverError} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting} className="bg-[#D4AF37] hover:bg-[#AE963C] text-white">
            Create room
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── QR management ──
function QrDialog({
  room,
  rooms,
  onClose,
}: {
  room: AdminRoom;
  rooms: AdminRoom[];
  onClose: () => void;
}) {
  const { regenerateQr, disableQr, reassignQr } = useRoomMutations();
  const [target, setTarget] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['qr-preview', room._id, room.qr.version, room.qr.token],
    queryFn: async () => {
      const res = await api.get<{ data: { dataUrl: string; scanUrl: string } }>(
        `/rooms/${room._id}/qr/download?format=dataurl`,
      );
      return res.data.data;
    },
  });

  return (
    <Dialog open onClose={onClose} title={`Room ${room.roomNumber} · QR`}>
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2">
          {isLoading || !data ? (
            <div className="grid h-48 w-48 place-items-center">
              <Spinner />
            </div>
          ) : (
            <Image src={data.dataUrl} alt="QR" width={192} height={192} className="rounded-lg border" unoptimized />
          )}
          <Badge className={room.qr.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
            {room.qr.isActive ? 'Active' : 'Disabled'} · v{room.qr.version}
          </Badge>
          {data?.scanUrl && (
            <a
              href={data.scanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs text-brand hover:underline font-semibold"
            >
              Open Customer Menu link
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => downloadAuthed(`/rooms/${room._id}/qr/download?format=png`, `room-${room.roomNumber}-qr.png`)}>
            <Download className="h-4 w-4" /> PNG
          </Button>
          <Button variant="outline" onClick={() => downloadAuthed(`/rooms/${room._id}/qr/download?format=svg`, `room-${room.roomNumber}-qr.svg`)}>
            <Download className="h-4 w-4" /> SVG
          </Button>
          <Button variant="outline" onClick={() => regenerateQr.mutate(room._id)} disabled={regenerateQr.isPending}>
            <RefreshCw className="h-4 w-4" /> Regenerate
          </Button>
          <Button variant="outline" onClick={() => disableQr.mutate(room._id)} disabled={!room.qr.isActive || disableQr.isPending}>
            <Ban className="h-4 w-4" /> Disable
          </Button>
        </div>

        <div className="rounded-lg border bg-zinc-50 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-800">
            <ArrowLeftRight className="h-4 w-4" /> Reassign QR (swap with another room)
          </p>
          <div className="flex gap-2">
            <select
              className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Select room…</option>
              {rooms
                .filter((r) => r._id !== room._id)
                .map((r) => (
                  <option key={r._id} value={r._id}>
                    Room {r.roomNumber}
                  </option>
                ))}
            </select>
            <Button
              variant="outline"
              disabled={!target || reassignQr.isPending}
              onClick={() => reassignQr.mutate({ id: room._id, targetRoomId: target }, { onSuccess: onClose })}
            >
              Swap
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

const TRANSFER_TYPE_LABEL: Record<string, string> = {
  NORMAL: 'Same category',
  UPGRADE: 'Upgrade',
  DOWNGRADE: 'Downgrade',
};

/**
 * Transfer dialog. Targets come from the backend already classified as a
 * same-category move, an upgrade (guest owes the differential) or a downgrade
 * (hotel owes a refund), so the admin sees the billing consequence up front.
 */
function TransferDialog({
  booking,
  onClose,
}: {
  booking: RoomBookingInfo;
  onClose: () => void;
}) {
  const { data: options, isLoading } = useTransferOptions(booking._id);
  const { transfer } = useBookingMutations();
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [scope, setScope] = useState<'SAME' | 'ALL'>('SAME');
  const [error, setError] = useState<string | null>(null);

  const allOptions = options?.options ?? [];
  // Rule 2: a plain transfer stays inside the same category. Cross-category
  // moves are opt-in and always route through the upgrade/downgrade billing.
  const visibleOptions =
    scope === 'SAME' ? allOptions.filter((o) => o.transferType === 'NORMAL') : allOptions;

  const selected = allOptions.find((o) => o._id === selectedRoomId) ?? null;

  const handleTransfer = async () => {
    if (!selectedRoomId) return;
    setError(null);
    try {
      const result = await transfer.mutateAsync({ id: booking._id, newRoomId: selectedRoomId });
      if (result?.type === 'UPGRADE') {
        toast.success(
          `Upgrade requested. ₹${result.amountDue} is due from the guest — confirm payment to complete the move.`,
        );
      } else if (result?.type === 'DOWNGRADE') {
        toast.success(`Room changed. Refund of ₹${result.refundAmount} recorded for the guest.`);
      } else {
        toast.success('Room transferred. The guest has been emailed the new room details.');
      }
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to transfer room.'));
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Transfer Booking · ${booking.guestName}`}>
      <div className="space-y-4">
        {isLoading || !options ? (
          <CenteredSpinner label="Checking available rooms…" />
        ) : options.pendingTransfer ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
            <p className="font-bold">Upgrade already awaiting payment</p>
            <p>
              Room {options.pendingTransfer.fromRoomNumber} → Room {options.pendingTransfer.toRoomNumber} ·
              ₹{options.pendingTransfer.amountDue} due. Confirm or cancel that upgrade before starting
              another transfer.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-zinc-50 p-3 text-xs text-zinc-600 space-y-1">
              <p>
                Current room:{' '}
                <b className="text-zinc-900">
                  Room {options.currentRoom.roomNumber} · {options.currentRoom.roomType} · Floor{' '}
                  {options.currentRoom.floor}
                </b>
              </p>
              <p>
                {options.nights} night{options.nights === 1 ? '' : 's'} at ₹
                {options.currentRoom.pricePerNight}/night
              </p>
            </div>

            <div className="flex gap-1.5">
              {(['SAME', 'ALL'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setScope(s);
                    setSelectedRoomId('');
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    scope === s ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {s === 'SAME' ? 'Same category' : 'Upgrade / Downgrade'}
                </button>
              ))}
            </div>

            <Field label="Select New Available Room">
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              >
                <option value="">— Choose a Room —</option>
                {visibleOptions.map((r) => (
                  <option key={r._id} value={r._id}>
                    Room {r.roomNumber} ({r.roomType} · Floor {r.floor}) —{' '}
                    {TRANSFER_TYPE_LABEL[r.transferType]}
                    {r.transferType === 'UPGRADE' ? ` +₹${r.amountDue}` : ''}
                    {r.transferType === 'DOWNGRADE' ? ` −₹${r.refundAmount}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            {visibleOptions.length === 0 && (
              <p className="text-xs text-zinc-500">
                {scope === 'SAME'
                  ? 'No free rooms in the same category for these dates. Switch to Upgrade / Downgrade to see other classes.'
                  : 'No rooms are free for these dates.'}
              </p>
            )}

            {selected && selected.transferType === 'UPGRADE' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <p className="font-bold">Upgrade — ₹{selected.amountDue} due from the guest</p>
                <p className="mt-1">
                  The guest is emailed a payment request and stays in Room {options.currentRoom.roomNumber}{' '}
                  until you confirm the payment was collected.
                </p>
              </div>
            )}

            {selected && selected.transferType === 'DOWNGRADE' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-bold">Downgrade — ₹{selected.refundAmount} refund owed</p>
                <p className="mt-1">
                  The move takes effect immediately, the booking total is reduced and the refund is recorded
                  as pending for the finance team.
                </p>
              </div>
            )}

            {selected && selected.transferType === 'NORMAL' && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                Same category move — no billing change. The guest is emailed the new room and QR details.
              </div>
            )}
          </>
        )}

        {error && <FieldError message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedRoomId || transfer.isPending || !!options?.pendingTransfer}
            className="bg-[#D4AF37] hover:bg-[#AE963C] text-white"
          >
            {transfer.isPending
              ? 'Transferring…'
              : selected?.transferType === 'UPGRADE'
              ? 'Request Upgrade'
              : 'Transfer Room'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function BookingsList({ onViewInvoice }: { onViewInvoice: (id: string) => void }) {
  const { data: bookings, isLoading } = useAdminBookings();
  const {
    updateStatus,
    recordPayment,
    confirmTransferPayment,
    cancelTransfer,
    markRefundProcessed,
  } = useBookingMutations();
  const [transferBooking, setTransferBooking] = useState<RoomBookingInfo | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  if (isLoading) return <CenteredSpinner />;
  if (!bookings || bookings.length === 0) {
    return <EmptyState title="No room bookings" description="Guest bookings will show up here." />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case 'CONFIRMED':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Confirmed</Badge>;
      case 'CHECKED_IN':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Checked In</Badge>;
      case 'CHECKED_OUT':
        return <Badge className="bg-zinc-100 text-zinc-800 border-zinc-200">Checked Out</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  /** Payment state is tracked independently of the booking status. */
  const getPaymentBadge = (booking: RoomBookingInfo) => {
    if (booking.status === 'CANCELLED') return null;
    if (booking.paymentStatus === 'PAID') {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
    }
    const payAtHotel = (booking.payment?.method || '').toUpperCase() === 'CASH';
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
        {payAtHotel ? 'Pending Payment · Pay at Hotel' : 'Pending Payment'}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {bookings.map((booking) => {
        const pendingRefund = booking.transfers?.find(
          (t) => t.type === 'DOWNGRADE' && t.refundStatus === 'PENDING',
        );
        return (
        <Card key={booking._id} className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-zinc-900">Room {booking.room?.roomNumber || 'Unknown'}</span>
                {getStatusBadge(booking.status)}
                {getPaymentBadge(booking)}
              </div>

              {booking.pendingTransfer && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <b>Upgrade awaiting payment:</b> Room {booking.pendingTransfer.fromRoomNumber} →{' '}
                  Room {booking.pendingTransfer.toRoomNumber} ({booking.pendingTransfer.toRoomType}) · ₹
                  {booking.pendingTransfer.amountDue} due
                </div>
              )}

              {pendingRefund && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  <b>Downgrade refund pending:</b> ₹{pendingRefund.refundAmount} owed to the guest
                  (Room {pendingRefund.fromRoomNumber} → Room {pendingRefund.toRoomNumber})
                </div>
              )}
              <div className="grid gap-x-6 gap-y-1 text-sm text-zinc-600 sm:grid-cols-2">
                <p className="flex items-center gap-2">
                  <User className="h-4 w-4 text-zinc-400" /> {booking.guestName}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-zinc-400" /> {booking.phone}
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-zinc-400" /> {booking.email}
                </p>
                <p className="flex items-center gap-2 font-semibold text-zinc-900">
                  <DollarSign className="h-4 w-4 text-[#D4AF37]" /> ₹{booking.totalPrice}
                </p>
                {booking.idProofUrl && (
                  <p className="flex items-center gap-2 text-xs">
                    <FileText className="h-4 w-4 text-zinc-400" /> 
                    <a href={booking.idProofUrl} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline font-bold">
                      View {booking.idProofType || 'ID Proof'}
                    </a>
                  </p>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Check-in: <span className="font-semibold text-zinc-700">{formatDate(booking.checkInDate)}</span> | Check-out: <span className="font-semibold text-zinc-700">{formatDate(booking.checkOutDate)}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Settlement is always an explicit action — never implied by check-in. */}
              {booking.status !== 'CANCELLED' && booking.paymentStatus !== 'PAID' && (
                <Button
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800"
                  onClick={() => {
                    setConfirmDialog({
                      title: 'Confirm Payment',
                      description: `Record ₹${booking.totalPrice} as received from ${booking.guestName}?`,
                      confirmText: 'Record Payment',
                      onConfirm: () => {
                        recordPayment.mutate(
                          { id: booking._id, status: 'PAID' },
                          {
                            onSuccess: () => toast.success('Payment recorded. Revenue and guest email updated.'),
                            onError: (err) => toast.error(apiErrorMessage(err, 'Failed to record payment')),
                          },
                        );
                      }
                    });
                  }}
                  disabled={recordPayment.isPending}
                >
                  Mark Payment Received
                </Button>
              )}

              {booking.pendingTransfer && (
                <>
                  <Button
                    size="sm"
                    className="bg-indigo-700 hover:bg-indigo-800"
                    onClick={() => {
                      setConfirmDialog({
                        title: 'Confirm Upgrade Payment',
                        description: `Confirm ₹${booking.pendingTransfer?.amountDue} upgrade payment and move the guest?`,
                        confirmText: 'Confirm Upgrade',
                        onConfirm: () => {
                          confirmTransferPayment.mutate(booking._id, {
                            onSuccess: () => toast.success('Upgrade completed. The guest has been emailed.'),
                            onError: (err) => toast.error(apiErrorMessage(err, 'Failed to confirm upgrade')),
                          });
                        }
                      });
                    }}
                    disabled={confirmTransferPayment.isPending}
                  >
                    Confirm Upgrade Payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      cancelTransfer.mutate(booking._id, {
                        onSuccess: () => toast.success('Upgrade cancelled and the held room released.'),
                        onError: (err) => toast.error(apiErrorMessage(err, 'Failed to cancel upgrade')),
                      })
                    }
                    disabled={cancelTransfer.isPending}
                  >
                    Cancel Upgrade
                  </Button>
                </>
              )}

              {pendingRefund && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    markRefundProcessed.mutate(booking._id, {
                      onSuccess: () => toast.success('Refund marked as processed.'),
                      onError: (err) => toast.error(apiErrorMessage(err, 'Failed to update refund')),
                    })
                  }
                  disabled={markRefundProcessed.isPending}
                >
                  Mark Refund Processed
                </Button>
              )}

              {booking.status === 'PENDING' && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-700 hover:bg-green-800"
                    onClick={() => updateStatus.mutate({ id: booking._id, status: 'CONFIRMED' })}
                    disabled={updateStatus.isPending}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50 border-red-200"
                    onClick={() => updateStatus.mutate({ id: booking._id, status: 'CANCELLED' })}
                    disabled={updateStatus.isPending}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {booking.status === 'CONFIRMED' && (
                <>
                  <Button
                    size="sm"
                    className="bg-blue-700 hover:bg-blue-800"
                    onClick={() => updateStatus.mutate({ id: booking._id, status: 'CHECKED_IN' })}
                    disabled={updateStatus.isPending}
                  >
                    Check In
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTransferBooking(booking)}
                  >
                    Transfer Room
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50 border-red-200"
                    onClick={() => updateStatus.mutate({ id: booking._id, status: 'CANCELLED' })}
                    disabled={updateStatus.isPending}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {booking.status === 'CHECKED_IN' && (
                <>
                  <Button
                    size="sm"
                    className="bg-zinc-800 hover:bg-zinc-900"
                    onClick={() => updateStatus.mutate({ id: booking._id, status: 'CHECKED_OUT' })}
                    disabled={updateStatus.isPending}
                  >
                    Check Out
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTransferBooking(booking)}
                  >
                    Transfer Room
                  </Button>
                </>
              )}
              {(booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewInvoice(booking._id)}
                >
                  Invoice
                </Button>
              )}
            </div>
          </div>
        </Card>
        );
      })}

      {transferBooking && (
        <TransferDialog
          booking={transferBooking}
          onClose={() => setTransferBooking(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          open={!!confirmDialog}
          onClose={() => setConfirmDialog(null)}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText={confirmDialog.confirmText}
          onConfirm={confirmDialog.onConfirm}
        />
      )}
    </div>
  );
}

function RoomsInner() {
  const { data: rooms, isLoading } = useAdminRooms();
  const { setActive, setStatus, disableQr, regenerateQr } = useRoomMutations();
  const [createOpen, setCreateOpen] = useState(false);
  const [qrRoomId, setQrRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rooms' | 'bookings'>('rooms');
  const [invoiceBookingId, setInvoiceBookingId] = useState<string | null>(null);

  // Resolve from the live list so the QR dialog reflects regenerate/reassign.
  const qrRoom = rooms?.find((r) => r._id === qrRoomId) ?? null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'OCCUPIED':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'CLEANING':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'MAINTENANCE':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Room Management</h1>
          <p className="text-sm text-zinc-500">Configure guest rooms, QR codes, check-in/out, and online bookings.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New room
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-zinc-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`pb-3 text-sm font-semibold transition-all ${
              activeTab === 'rooms' ? 'border-b-2 border-[#D4AF37] text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Rooms & QR Codes
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-3 text-sm font-semibold transition-all ${
              activeTab === 'bookings' ? 'border-b-2 border-[#D4AF37] text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Online Bookings
          </button>
        </div>
      </div>

      {activeTab === 'rooms' ? (
        isLoading ? (
          <CenteredSpinner />
        ) : !rooms || rooms.length === 0 ? (
          <EmptyState title="No rooms yet" description="Add rooms — each gets a unique QR automatically." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => {
              const statusBorderColor =
                r.status === 'OCCUPIED' ? 'border-l-amber-400' :
                r.status === 'CLEANING' ? 'border-l-blue-400' :
                r.status === 'MAINTENANCE' ? 'border-l-red-400' :
                'border-l-emerald-400';
              return (
                <Card key={r._id} className={`p-0 flex flex-col border-l-4 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 ${statusBorderColor}`}>
                  {/* Card Header */}
                  <div className="flex items-start justify-between px-5 pt-5 pb-3">
                    <div>
                      <p className="text-xl font-bold text-zinc-900 tracking-tight">Room {r.roomNumber}</p>
                      <p className="text-xs text-zinc-400 font-medium mt-0.5">Floor {r.floor} · {typeof r.kitchen === 'object' && r.kitchen !== null ? (r.kitchen as { name: string }).name : 'No kitchen linked'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge className={r.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge className={getStatusColor(r.status || 'AVAILABLE')}>
                        {r.status || 'AVAILABLE'}
                      </Badge>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="mx-5 border-t border-zinc-100" />

                  {/* Housekeeping Row */}
                  <div className="px-5 py-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Housekeeping</span>
                    <select
                      value={r.status || 'AVAILABLE'}
                      onChange={(e) => setStatus.mutate({ id: r._id, status: e.target.value })}
                      className="text-xs font-bold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 cursor-pointer"
                      disabled={setStatus.isPending}
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="RESERVED">Reserved</option>
                      <option value="OCCUPIED">Occupied</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="BLOCKED">Blocked</option>
                      <option value="OUT_OF_SERVICE">Out of Service</option>
                      <option value="VIP_RESERVED">VIP Reserved</option>
                    </select>
                  </div>

                  {/* QR Status */}
                  <div className="px-5 pb-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 ${r.qr.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.qr.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                      QR {r.qr.isActive ? 'Active' : 'Disabled'} · v{r.qr.version}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto bg-zinc-50 border-t border-zinc-100 px-4 py-3 flex gap-2">
                    {r.qr.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-red-600 hover:bg-red-50 border-red-200 font-semibold text-xs"
                        onClick={() => {
                          if (confirm(`Check-out Room ${r.roomNumber}? This will disable the current ordering QR code.`)) {
                            disableQr.mutate(r._id);
                            setStatus.mutate({ id: r._id, status: 'CLEANING' });
                          }
                        }}
                        disabled={disableQr.isPending}
                      >
                        Check-out
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-green-700 hover:bg-green-50 border-green-200 font-semibold text-xs"
                        onClick={() => {
                          if (confirm(`Check-in Room ${r.roomNumber}? This will generate a fresh ordering QR code.`)) {
                            regenerateQr.mutate(r._id);
                            setStatus.mutate({ id: r._id, status: 'OCCUPIED' });
                          }
                        }}
                        disabled={regenerateQr.isPending}
                      >
                        Check-in
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setQrRoomId(r._id)} title="QR Details">
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setActive.mutate({ id: r._id, active: !r.isActive })} title={r.isActive ? 'Deactivate room' : 'Activate room'}>
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <BookingsList onViewInvoice={setInvoiceBookingId} />
      )}

      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {qrRoom ? <QrDialog room={qrRoom} rooms={rooms ?? []} onClose={() => setQrRoomId(null)} /> : null}
      {invoiceBookingId && (
        <InvoiceModal bookingId={invoiceBookingId} onClose={() => setInvoiceBookingId(null)} />
      )}
    </div>
  );
}

export default function AdminRoomsPage() {
  return (
    <AdminShell>
      <RoomsInner />
    </AdminShell>
  );
}

function InvoiceModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { data: res, isLoading } = useQuery({
    queryKey: ['booking-invoice', bookingId],
    queryFn: () => api.get(`/rooms/bookings/${bookingId}/invoice`).then((r) => r.data),
  });

  const invoice = res?.data?.invoice;

  const handleDownload = async () => {
    try {
      const res = await api.get(`/rooms/bookings/${bookingId}/invoice/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-room-${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice PDF. Please try again.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open onClose={onClose} title="Consolidated Bill / Tax Invoice" widthClass="max-w-2xl">
      {isLoading || !invoice ? (
        <CenteredSpinner label="Loading billing statements..." />
      ) : (
        <div className="space-y-6 font-sans text-zinc-800">
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <h3 className="font-extrabold text-zinc-900 text-lg">THE PAGE HOTEL</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">GSTIN: 27AAAAA1111A1Z1</p>
            </div>
            <div className="text-right text-xs text-zinc-500 space-y-0.5">
              <p className="font-bold text-zinc-900">TAX INVOICE</p>
              <p>Invoice: INV-RM-{invoice.booking._id.toString().substring(18).toUpperCase()}</p>
              <p>Room: Room {invoice.booking.room?.roomNumber}</p>
              <p>Nights: {invoice.nights} Nights</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider">Billed To</span>
              <p className="font-bold mt-1 text-zinc-900">{invoice.booking.guestName}</p>
              <p>{invoice.booking.phone}</p>
              <p>{invoice.booking.email}</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider">Stay Period</span>
              <p className="mt-1">In: {formatDate(invoice.booking.checkInDate)}</p>
              <p>Out: {formatDate(invoice.booking.checkOutDate || new Date().toISOString())}</p>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 border-b">
                  <th className="p-3 font-bold text-zinc-500 uppercase tracking-wider">Description</th>
                  <th className="p-3 font-bold text-zinc-500 uppercase tracking-wider text-center">Qty</th>
                  <th className="p-3 font-bold text-zinc-500 uppercase tracking-wider text-right">Tax (Rs)</th>
                  <th className="p-3 font-bold text-zinc-500 uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* Stay charges */}
                <tr>
                  <td className="p-3 font-medium">Room stay (Room {invoice.booking.room?.roomNumber})</td>
                  <td className="p-3 text-center">{invoice.nights}</td>
                  <td className="p-3 text-right">₹{invoice.stayGst.toFixed(2)}</td>
                  <td className="p-3 text-right font-semibold">₹{invoice.stayCost.toFixed(2)}</td>
                </tr>

                {/* Orders */}
                {invoice.orders.length > 0 && (
                  <>
                    <tr className="bg-zinc-50/50">
                      <td colSpan={4} className="px-3 py-1.5 font-bold text-zinc-500 text-[10px] uppercase tracking-wider">
                        In-Room Dining
                      </td>
                    </tr>
                    {invoice.orders.map((o: any) => (
                      <tr key={o.orderNumber}>
                        <td className="p-3 pl-6 text-zinc-600">Order #{o.orderNumber} (via {o.paymentMethod})</td>
                        <td className="p-3 text-center">1</td>
                        <td className="p-3 text-right">₹{o.tax.toFixed(2)}</td>
                        <td className="p-3 text-right">₹{o.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </>
                )}

                {/* Banquets */}
                {invoice.banquets.length > 0 && (
                  <>
                    <tr className="bg-zinc-50/50">
                      <td colSpan={4} className="px-3 py-1.5 font-bold text-zinc-500 text-[10px] uppercase tracking-wider">
                        Banquets
                      </td>
                    </tr>
                    {invoice.banquets.map((b: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-3 pl-6 text-zinc-600">{b.hallName} event ({formatDate(b.eventDate)})</td>
                        <td className="p-3 text-center">1</td>
                        <td className="p-3 text-right">₹{(b.totalPrice - (b.totalPrice / 1.18)).toFixed(2)}</td>
                        <td className="p-3 text-right">₹{b.totalPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </>
                )}

                {/* Valet */}
                {invoice.valet.length > 0 && (
                  <>
                    <tr className="bg-zinc-50/50">
                      <td colSpan={4} className="px-3 py-1.5 font-bold text-zinc-500 text-[10px] uppercase tracking-wider">
                        Valet Services
                      </td>
                    </tr>
                    {invoice.valet.map((v: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-3 pl-6 text-zinc-500">Vehicle: {v.brand} {v.model} ({v.carNumber})</td>
                        <td className="p-3 text-center">-</td>
                        <td className="p-3 text-right">₹0.00</td>
                        <td className="p-3 text-right text-green-600 font-bold uppercase text-[10px]">FREE</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pricing breakdown */}
          <div className="flex flex-col md:flex-row md:justify-between items-start gap-4 pt-2 border-t">
            <div className="text-xs text-zinc-500 space-y-1">
              <p>Base Subtotal: ₹{invoice.pricing.subtotal.toFixed(2)}</p>
              <p>Taxes (GST): ₹{invoice.pricing.taxTotal.toFixed(2)}</p>
              {invoice.pricing.serviceChargeTotal > 0 && (
                <p>Service Charges: ₹{invoice.pricing.serviceChargeTotal.toFixed(2)}</p>
              )}
            </div>

            <div className="text-right space-y-1.5 self-end">
              <p className="text-xs font-semibold">Grand Total: ₹{invoice.pricing.grandTotal.toFixed(2)}</p>
              <p className="text-xs font-bold text-green-600">Already Paid: ₹{invoice.pricing.alreadyPaidTotal.toFixed(2)}</p>
              <p className="text-sm font-extrabold text-red-600">Balance Due: ₹{invoice.pricing.balanceDue.toFixed(2)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end border-t pt-4">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
            <Button size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1.5" /> Download PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
