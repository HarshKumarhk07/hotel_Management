'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Car, 
  Search, 
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
  User
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
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
  keyTag: string;
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

export default function GuestValetPage() {
  const queryClient = useQueryClient();
  const [searchPlate, setSearchPlate] = useState('');
  const [activePlate, setActivePlate] = useState<string | null>(null);

  // Load plate number from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kds_valet_plate');
      if (saved) {
        setSearchPlate(saved);
        setActivePlate(saved);
      }
    }
  }, []);

  // Fetch active vehicle tracking details
  const {
    data: vehicle,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<Vehicle>({
    queryKey: ['valet-track', activePlate],
    queryFn: async () => {
      const res = await api.get(`/valet/track/${encodeURIComponent(activePlate!)}`);
      return res.data.data;
    },
    enabled: !!activePlate,
    retry: false
  });

  // Request vehicle retrieval mutation
  const requestMutation = useMutation({
    mutationFn: async (carNo: string) => {
      const res = await api.post(`/valet/request/${encodeURIComponent(carNo)}`, {
        notes: 'Requested by guest via tracking page'
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['valet-track', activePlate], data);
    }
  });

  // Listen to live updates via WebSocket
  useEffect(() => {
    if (!activePlate) return;

    const socket = getSocket();
    const handleUpdate = (updatedVehicle: Vehicle) => {
      if (updatedVehicle.carNumber.toUpperCase() === activePlate.toUpperCase()) {
        queryClient.setQueryData(['valet-track', activePlate], updatedVehicle);
      }
    };

    socket.on('valet:updated', handleUpdate);

    return () => {
      socket.off('valet:updated', handleUpdate);
    };
  }, [activePlate, queryClient]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPlate.trim()) return;
    
    const plate = searchPlate.trim().toUpperCase();
    if (typeof window !== 'undefined') {
      localStorage.setItem('kds_valet_plate', plate);
    }
    setActivePlate(plate);
  };

  const handleRequestClick = () => {
    if (!vehicle) return;
    requestMutation.mutate(vehicle.carNumber);
  };

  const handleClearSearch = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kds_valet_plate');
    }
    setSearchPlate('');
    setActivePlate(null);
  };

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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">

      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
        <div className="space-y-8 text-center">
          {/* Header */}
          <div className="space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand shadow-inner">
              <Car className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
              Valet Vehicle Tracking
            </h1>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              Search your vehicle plate number to track status and request retrieval instantly.
            </p>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">
                <Search className="h-5 w-5" />
              </span>
              <input
                type="text"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                placeholder="Enter Car Number (e.g. KA-03-MR-9821)"
                className="w-full rounded-xl border border-zinc-200 bg-white py-3.5 pl-10 pr-4 text-base font-semibold text-zinc-800 shadow-sm transition-all focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand uppercase"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:brightness-95 active:scale-95 focus:outline-none"
            >
              Search
            </button>
          </form>

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
                  <p className="text-sm text-zinc-500 font-medium">Fetching valet status...</p>
                </motion.div>
              )}

              {isError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-red-100 bg-red-50 p-6 text-left space-y-3"
                >
                  <div className="flex gap-3 items-start text-red-700">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold">No active vehicle found</h3>
                      <p className="mt-1 text-xs text-red-600">
                        {apiErrorMessage(error, 'We could not find an active valet session for this car number. It may already be delivered or the registration is pending.')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-xs font-semibold text-red-700 underline hover:text-red-800"
                  >
                    Clear Search
                  </button>
                </motion.div>
              )}

              {!activePlate && !isLoading && !isError && (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-dashed border-zinc-200 bg-white p-10 text-center space-y-4"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-400">
                    <Car className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">No Vehicle Queried</h3>
                    <p className="mt-1 text-xs text-zinc-400">
                      Enter your car plate number above to link with our digital parking desk.
                    </p>
                  </div>
                </motion.div>
              )}

              {vehicle && !isLoading && !isError && (
                <motion.div
                  key="tracker"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Info Card */}
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm text-left space-y-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Plate Number</span>
                        <h2 className="text-xl font-extrabold text-zinc-900 uppercase">{vehicle.carNumber}</h2>
                        <p className="text-xs text-zinc-500 font-semibold mt-0.5">{vehicle.brand} {vehicle.model} ({vehicle.color})</p>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-bold border flex items-center gap-1.5 ${
                        vehicle.status === 'PARKED'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                          : vehicle.status === 'DELIVERED'
                          ? 'bg-zinc-100 border-zinc-200 text-zinc-600'
                          : 'bg-brand-50 border-brand-100 text-brand animate-pulse'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          vehicle.status === 'PARKED' 
                            ? 'bg-emerald-500' 
                            : vehicle.status === 'DELIVERED'
                            ? 'bg-zinc-400'
                            : 'bg-brand'
                        }`} />
                        {vehicle.status}
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
                        <div>
                          <span className="text-zinc-400 block uppercase text-[9px] tracking-wider font-bold">Slot</span>
                          <span className="font-bold text-zinc-800">{vehicle.parkingSlot}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-zinc-400 shrink-0" />
                        <div>
                          <span className="text-zinc-400 block uppercase text-[9px] tracking-wider font-bold">Key Tag</span>
                          <span className="font-bold text-zinc-800">{vehicle.keyTag}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-zinc-400 shrink-0" />
                        <div>
                          <span className="text-zinc-400 block uppercase text-[9px] tracking-wider font-bold">Room</span>
                          <span className="font-bold text-zinc-800">Room {vehicle.guestInfo.roomNumber}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
                        <div>
                          <span className="text-zinc-400 block uppercase text-[9px] tracking-wider font-bold">Parked At</span>
                          <span className="font-bold text-zinc-800">
                            {new Date(vehicle.checkedInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Request Button or Active Retrieve Message */}
                    <div className="pt-2 border-t border-zinc-100">
                      {vehicle.status === 'PARKED' ? (
                        <button
                          type="button"
                          onClick={handleRequestClick}
                          disabled={requestMutation.isPending}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-75 focus:outline-none"
                        >
                          {requestMutation.isPending ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              Sending Request…
                            </>
                          ) : (
                            <>
                              Request Vehicle Retrieval
                            </>
                          )}
                        </button>
                      ) : vehicle.status === 'DELIVERED' ? (
                        <div className="rounded-xl bg-zinc-100 p-4 text-center text-zinc-600 text-sm font-semibold border border-zinc-200">
                          This vehicle has been delivered. Thank you!
                        </div>
                      ) : (
                        <div className="rounded-xl bg-brand-50 p-4 text-center text-brand text-sm font-bold border border-brand-100 animate-pulse">
                          Retrieval In Progress
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stepper Card */}
                  {vehicle.status !== 'DELIVERED' && (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm text-left">
                      <h3 className="font-extrabold text-zinc-950 text-sm mb-5 uppercase tracking-wider">Retrieval Progress</h3>
                      <div className="relative pl-6 space-y-6">
                        {/* Connecting Line */}
                        <div className="absolute top-1 left-2.5 bottom-1 w-0.5 bg-zinc-200" />

                        {steps.map((step, idx) => {
                          const isCompleted = idx < currentStepIdx;
                          const isCurrent = idx === currentStepIdx;
                          return (
                            <div key={idx} className="relative flex gap-4 items-start text-xs">
                              {/* Step dot */}
                              <div className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                                isCompleted 
                                  ? 'bg-brand border-brand text-white' 
                                  : isCurrent 
                                  ? 'bg-zinc-950 border-zinc-950 text-white shadow-md animate-bounce' 
                                  : 'bg-white border-zinc-300 text-zinc-400'
                              }`}>
                                {isCompleted ? (
                                  <CheckCircle className="h-3.5 w-3.5" />
                                ) : (
                                  <span>{idx + 1}</span>
                                )}
                              </div>

                              <div className="space-y-0.5">
                                <h4 className={`font-bold ${isCurrent ? 'text-zinc-950 text-sm' : isCompleted ? 'text-zinc-800' : 'text-zinc-400'}`}>
                                  {step.label}
                                </h4>
                                <p className={`leading-relaxed ${isCurrent ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                  {step.desc}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Clear Button */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="text-xs font-semibold text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      Use another plate number
                    </button>
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
