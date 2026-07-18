'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Car, 
  Loader2, 
  AlertCircle, 
  MapPin, 
  Clock, 
  Key, 
  ChevronRight, 
  CheckCircle,
  HelpCircle,
  Phone,
  Mail,
  User,
  ExternalLink,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { SiteNav } from '@/components/site/SiteNav';
import { SiteFooter } from '@/components/site/SiteFooter';
import { motion, AnimatePresence } from 'framer-motion';

interface VehiclePhoto {
  url: string;
  publicId: string;
}

interface VehicleHistory {
  status: string;
  at: string;
  notes?: string;
}

interface Vehicle {
  _id: string;
  carNumber: string;
  brand: string;
  model: string;
  color: string;
  parkingSlot: string;
  fuelLevel?: string;
  odometer?: number;
  keyTag: string;
  secureToken: string;
  status: 'PARKED' | 'REQUESTED' | 'BRINGING' | 'READY' | 'DELIVERED';
  guestInfo: {
    name: string;
    roomNumber: string;
    phone: string;
    email: string;
  };
  photos: {
    front: VehiclePhoto;
    rear: VehiclePhoto;
    left: VehiclePhoto;
    right: VehiclePhoto;
    dashboard: VehiclePhoto;
  };
  statusHistory: VehicleHistory[];
  checkedInAt: string;
}

export default function GuestValetTokenPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  // Fetch active vehicle tracking details using the secure token
  const {
    data: vehicle,
    isLoading,
    isError,
    error,
  } = useQuery<Vehicle>({
    queryKey: ['valet-track-token', token],
    queryFn: async () => {
      const res = await api.get(`/valet/session/${token}`);
      return res.data.data;
    },
    enabled: !!token,
    retry: false
  });

  // Request vehicle retrieval mutation
  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/valet/session/${token}/request`, {
        notes: 'Requested by guest via secure link'
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['valet-track-token', token], data);
    }
  });

  // Listen to live updates via WebSocket
  useEffect(() => {
    if (!token || !vehicle) return;

    const socket = getSocket();
    const handleUpdate = (updatedVehicle: Vehicle) => {
      if (updatedVehicle.secureToken === token) {
        queryClient.setQueryData(['valet-track-token', token], updatedVehicle);
      }
    };

    socket.on('valet:updated', handleUpdate);

    return () => {
      socket.off('valet:updated', handleUpdate);
    };
  }, [token, vehicle, queryClient]);

  // Setup dynamic stepper configuration
  const steps = [
    { key: 'PARKED', label: 'Parked Securely', desc: 'Your vehicle is parked in slot ' + (vehicle?.parkingSlot ?? '--') },
    { key: 'REQUESTED', label: 'Requested Retrieval', desc: 'Retrieval requested. Valet manager is assigning staff.' },
    { key: 'BRINGING', label: 'Bringing Vehicle', desc: 'Valet staff is bringing your vehicle to the lobby.' },
    { key: 'READY', label: 'Ready Outside', desc: 'Your vehicle is ready outside the main lobby entrance.' },
    { key: 'DELIVERED', label: 'Delivered', desc: 'Vehicle handed over safely.' }
  ];

  const getStepIndex = (status: string) => {
    return steps.findIndex(s => s.key === status);
  };

  const currentStepIdx = vehicle ? getStepIndex(vehicle.status) : -1;

  const getStepStatus = (idx: number) => {
    if (currentStepIdx === -1) return 'pending';
    if (idx < currentStepIdx) return 'complete';
    if (idx === currentStepIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <SiteNav fullMenuHref="/" />

      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
        <div className="space-y-8 text-center">
          {/* Header */}
          <div className="space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand shadow-inner">
              <Car className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
              Live Valet Status
            </h1>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              Real-time vehicle status and digital retrieval desk.
            </p>
          </div>

          {/* Dynamic Content Panel */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {isLoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 gap-3"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-brand" />
                  <p className="text-sm text-zinc-500 font-medium">Loading session...</p>
                </motion.div>
              )}

              {isError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-red-100 bg-red-50 p-6 text-left space-y-4 shadow-sm"
                >
                  <div className="flex gap-3 items-start text-red-700">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-sm">Expired or Invalid Link</h3>
                      <p className="mt-1 text-xs text-red-600 leading-relaxed">
                        {apiErrorMessage(error, 'This valet session tracking link is either invalid, completed, or expired.')}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Link href="/">
                      <button className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-800">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
                      </button>
                    </Link>
                  </div>
                </motion.div>
              )}

              {vehicle && (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6 text-left"
                >
                  {/* Status Banner */}
                  <div className="rounded-2xl bg-zinc-950 p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
                      <Car className="h-36 w-36 text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand">Current Status</span>
                    <h2 className="text-xl font-extrabold mt-1 text-white flex items-center gap-2">
                      {vehicle.status === 'READY' && <Sparkles className="h-5 w-5 text-brand animate-pulse" />}
                      {steps[currentStepIdx]?.label || vehicle.status}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                      {steps[currentStepIdx]?.desc}
                    </p>

                    {/* Retrieval Request Controls */}
                    {vehicle.status === 'PARKED' && (
                      <div className="mt-6 border-t border-zinc-800/80 pt-4 flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-400">Request Retrieval</h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Let the valet team bring your car around.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestMutation.mutate()}
                          disabled={requestMutation.isPending}
                          className="rounded-xl bg-brand px-5 py-3 text-xs font-black text-white hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center gap-1.5 shadow-md"
                        >
                          {requestMutation.isPending ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Requesting...
                            </>
                          ) : (
                            'Request Vehicle'
                          )}
                        </button>
                      </div>
                    )}

                    {vehicle.status !== 'PARKED' && vehicle.status !== 'DELIVERED' && (
                      <div className="mt-6 border-t border-zinc-800/80 pt-4 flex items-center gap-2 text-xs text-brand font-bold">
                        <Clock className="h-4 w-4 animate-pulse" />
                        {vehicle.status === 'REQUESTED' && 'Retrieval request received. Waiting for valet assignment.'}
                        {vehicle.status === 'BRINGING' && 'Valet staff is bringing your vehicle to the entrance.'}
                        {vehicle.status === 'READY' && 'Your vehicle is ready outside the main lobby entrance!'}
                      </div>
                    )}
                  </div>

                  {/* Status Timeline */}
                  <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-6">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Activity Timeline</h3>
                    <div className="relative border-l-2 border-zinc-100 ml-3.5 pl-6 space-y-6">
                      {steps.map((st, idx) => {
                        const state = getStepStatus(idx);
                        return (
                          <div key={idx} className="relative">
                            {/* Dot Badge */}
                            <div className={`absolute -left-[33px] top-0.5 flex h-5.5 w-5.5 items-center justify-center rounded-full border text-[10px] font-bold transition-all shadow-sm ${
                              state === 'complete' 
                                ? 'bg-zinc-950 border-zinc-950 text-white'
                                : state === 'active'
                                ? 'bg-brand border-brand text-white ring-4 ring-brand/20 animate-pulse'
                                : 'bg-white border-zinc-200 text-zinc-400'
                            }`}>
                              {state === 'complete' ? '✓' : idx + 1}
                            </div>
                            <div>
                              <h4 className={`text-xs font-bold ${state === 'active' ? 'text-zinc-900' : 'text-zinc-700'}`}>
                                {st.label}
                              </h4>
                              {state === 'active' && (
                                <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                                  {st.desc}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Guest Info Card */}
                    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" /> Guest Details
                      </h3>
                      <div className="text-xs space-y-1.5">
                        <div>
                          <span className="text-zinc-400">Guest Name:</span>
                          <p className="font-bold text-zinc-800">{vehicle.guestInfo.name}</p>
                        </div>
                        <div>
                          <span className="text-zinc-400">Room Number:</span>
                          <p className="font-bold text-zinc-800">Room {vehicle.guestInfo.roomNumber}</p>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Info Card */}
                    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Car className="h-4 w-4" /> Vehicle Details
                      </h3>
                      <div className="text-xs space-y-1.5">
                        <div>
                          <span className="text-zinc-400">Plate Number:</span>
                          <p className="font-bold text-zinc-800 uppercase">{vehicle.carNumber}</p>
                        </div>
                        <div>
                          <span className="text-zinc-400">Vehicle Description:</span>
                          <p className="font-bold text-zinc-800">
                            {vehicle.color} {vehicle.brand} {vehicle.model}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Support Notice */}
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-5 text-center text-[11px] text-zinc-400 font-semibold">
                    Having trouble? Contact the hotel desk or reception dialer directly.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
