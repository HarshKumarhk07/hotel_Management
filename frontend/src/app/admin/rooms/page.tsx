'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Plus, Power, QrCode, RefreshCw, Ban, ArrowLeftRight, Calendar, User, Phone, Mail, DollarSign } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, FieldError } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner, EmptyState, Spinner } from '@/components/ui/primitives';
import { useAdminKitchens } from '@/hooks/useAdminKitchens';
import { useAdminRooms, useRoomMutations, useAdminBookings, useBookingMutations, type AdminRoom } from '@/hooks/useAdminRooms';
import { api, apiErrorMessage } from '@/lib/api';
import { downloadAuthed } from '@/lib/download';
import { formatDate } from '@/lib/utils';

// ── Create room ──
const createSchema = z.object({
  roomNumber: z.string().min(1, 'Room number is required'),
  floor: z.coerce.number().int(),
  kitchen: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateRoomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useRoomMutations();
  const { data: kitchens } = useAdminKitchens();
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
        <Field label="Serving kitchen">
          <select
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
            {...register('kitchen')}
          >
            <option value="">— None —</option>
            {kitchens?.map((k) => (
              <option key={k._id} value={k._id}>
                {k.name}
              </option>
            ))}
          </select>
        </Field>
        {serverError ? <FieldError message={serverError} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create room'}
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

function BookingsList() {
  const { data: bookings, isLoading } = useAdminBookings();
  const { updateStatus } = useBookingMutations();

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

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <Card key={booking._id} className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-zinc-900">Room {booking.room?.roomNumber || 'Unknown'}</span>
                {getStatusBadge(booking.status)}
              </div>
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
              </div>
              <p className="text-xs text-zinc-400">
                Check-in: <span className="font-semibold text-zinc-700">{formatDate(booking.checkInDate)}</span> | Check-out: <span className="font-semibold text-zinc-700">{formatDate(booking.checkOutDate)}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
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
                    className="text-red-600 hover:bg-red-50 border-red-200"
                    onClick={() => updateStatus.mutate({ id: booking._id, status: 'CANCELLED' })}
                    disabled={updateStatus.isPending}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {booking.status === 'CHECKED_IN' && (
                <Button
                  size="sm"
                  className="bg-zinc-800 hover:bg-zinc-900"
                  onClick={() => updateStatus.mutate({ id: booking._id, status: 'CHECKED_OUT' })}
                  disabled={updateStatus.isPending}
                >
                  Check Out
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function RoomsInner() {
  const { data: rooms, isLoading } = useAdminRooms();
  const { setActive, setStatus, disableQr, regenerateQr } = useRoomMutations();
  const [createOpen, setCreateOpen] = useState(false);
  const [qrRoomId, setQrRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rooms' | 'bookings'>('rooms');

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
            {rooms.map((r) => (
              <Card key={r._id} className="p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-bold text-zinc-900">Room {r.roomNumber}</p>
                      <p className="text-xs text-zinc-500">Floor {r.floor}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge className={r.isActive ? 'bg-green-50 text-green-700' : 'bg-zinc-200 text-zinc-600'}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge className={getStatusColor(r.status || 'AVAILABLE')}>
                        {r.status || 'AVAILABLE'}
                      </Badge>
                    </div>
                  </div>

                  {/* Housekeeping Status Select */}
                  <div className="flex items-center justify-between rounded-lg border bg-zinc-50 p-2 text-xs">
                    <span className="font-semibold text-zinc-500">Housekeeping:</span>
                    <select
                      value={r.status || 'AVAILABLE'}
                      onChange={(e) => setStatus.mutate({ id: r._id, status: e.target.value })}
                      className="font-semibold text-zinc-700 bg-transparent border-none focus:outline-none cursor-pointer"
                      disabled={setStatus.isPending}
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="OCCUPIED">Occupied</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="MAINTENANCE">Maintenance</option>
                    </select>
                  </div>

                  <p className="text-xs text-zinc-400">
                    QR {r.qr.isActive ? 'active' : 'disabled'} · v{r.qr.version}
                  </p>
                </div>

                <div className="mt-5 flex gap-2">
                  {r.qr.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-red-600 hover:bg-red-50 border-red-200"
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
                      className="flex-1 text-green-700 hover:bg-green-50 border-green-200"
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
            ))}
          </div>
        )
      ) : (
        <BookingsList />
      )}

      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {qrRoom ? <QrDialog room={qrRoom} rooms={rooms ?? []} onClose={() => setQrRoomId(null)} /> : null}
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
