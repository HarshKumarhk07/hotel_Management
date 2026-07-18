'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Car, 
  LogOut, 
  Loader2, 
  Camera, 
  Plus, 
  Check, 
  User, 
  FolderSync, 
  Upload, 
  MapPin, 
  Key, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Play, 
  HelpCircle,
  Clock,
  ExternalLink,
  X,
  Bell
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { playNewOrderChime, primeAudio } from '@/lib/sound';
import { Eye } from 'lucide-react';

interface VehiclePhoto {
  url: string;
  publicId: string;
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
    damage?: VehiclePhoto[];
  };
  checkedInAt: string;
}

interface ParkingSlot {
  _id: string;
  slotNumber: string;
  isOccupied: boolean;
  notes?: string;
}

export default function ValetDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useAuthStore();
  const { logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'queue' | 'checkin' | 'history'>('queue');
  
  // States for check-in & alerts
  const [scanningProcessing, setScanningProcessing] = useState(false);
  const [valetAlerts, setValetAlerts] = useState<{
    id: string;
    carNumber: string;
    guestName: string;
    roomNumber: string;
    slot: string;
    time: string;
  }[]>([]);
  const [selectedHistoryVehicle, setSelectedHistoryVehicle] = useState<Vehicle | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Prefilled Guest details from scan
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isPrefilled, setIsPrefilled] = useState(false);

  // Form inputs
  const [carNumber, setCarNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [keyTag, setKeyTag] = useState('');
  const [fuelLevel, setFuelLevel] = useState('Half Tank');
  const [odometer, setOdometer] = useState('');

  // Image upload states
  const [photoFront, setPhotoFront] = useState<File | null>(null);
  const [photoRear, setPhotoRear] = useState<File | null>(null);
  const [photoLeft, setPhotoLeft] = useState<File | null>(null);
  const [photoRight, setPhotoRight] = useState<File | null>(null);
  const [photoDashboard, setPhotoDashboard] = useState<File | null>(null);
  const [photoDamageList, setPhotoDamageList] = useState<File[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Protect route
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // Fetch active queue vehicles
  const {
    data: activeQueue,
    isLoading: isLoadingQueue,
    refetch: refetchQueue
  } = useQuery<Vehicle[]>({
    queryKey: ['valet-queue'],
    queryFn: async () => {
      const res = await api.get('/valet/vehicles?activeOnly=true');
      return res.data.data.items;
    },
    enabled: status === 'authenticated'
  });

  // Fetch delivered vehicles (history)
  const {
    data: historyQueue,
    isLoading: isLoadingHistory,
    refetch: refetchHistory
  } = useQuery<Vehicle[]>({
    queryKey: ['valet-history'],
    queryFn: async () => {
      const res = await api.get('/valet/vehicles?status=DELIVERED');
      return res.data.data.items;
    },
    enabled: status === 'authenticated' && activeTab === 'history'
  });

  // Fetch parking slots
  const {
    data: slots,
    refetch: refetchSlots
  } = useQuery<ParkingSlot[]>({
    queryKey: ['valet-slots'],
    queryFn: async () => {
      const res = await api.get('/valet/slots');
      return res.data.data;
    },
    enabled: status === 'authenticated'
  });

  // Check-in checkinMutation
  const checkinMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await api.post('/valet/check-in', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.data;
    },
    onSuccess: () => {
      // Reset form
      setGuestName('');
      setRoomNumber('');
      setGuestPhone('');
      setGuestEmail('');
      setIsPrefilled(false);
      setCarNumber('');
      setBrand('');
      setModel('');
      setColor('');
      setSelectedSlot('');
      setKeyTag('');
      setOdometer('');
      setPhotoFront(null);
      setPhotoRear(null);
      setPhotoLeft(null);
      setPhotoRight(null);
      setPhotoDashboard(null);
      setPhotoDamageList([]);
      
      refetchQueue();
      refetchSlots();
      setActiveTab('queue');
    }
  });

  // Update status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const res = await api.patch(`/valet/vehicles/${id}/status`, {
        status: newStatus,
        notes: `Progressed to ${newStatus} by valet manager`
      });
      return res.data.data;
    },
    onSuccess: () => {
      refetchQueue();
      refetchSlots();
    }
  });

  // Real-time socket events & Audio Priming
  useEffect(() => {
    // Prime the audio context on first click anywhere on the page
    const handleGesture = () => {
      primeAudio();
      window.removeEventListener('click', handleGesture);
    };
    window.addEventListener('click', handleGesture);

    if (status !== 'authenticated') {
      return () => {
        window.removeEventListener('click', handleGesture);
      };
    }

    const socket = getSocket();
    
    const handleNewValet = () => {
      // Play a synthetic sound to alert valet managers
      playNewOrderChime();
      void refetchQueue();
      void refetchSlots();
    };

    const handleUpdateValet = (updatedVehicle?: any) => {
      void refetchQueue();
      void refetchSlots();

      if (updatedVehicle && updatedVehicle.status === 'REQUESTED') {
        playNewOrderChime();
        const newAlert = {
          id: Math.random().toString(),
          carNumber: updatedVehicle.carNumber,
          guestName: updatedVehicle.guestInfo?.name || 'Guest',
          roomNumber: updatedVehicle.guestInfo?.roomNumber || '--',
          slot: updatedVehicle.parkingSlot,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        };
        setValetAlerts(prev => [newAlert, ...prev]);

        // Auto dismiss alert after 10 seconds
        setTimeout(() => {
          setValetAlerts(prev => prev.filter(a => a.id !== newAlert.id));
        }, 10000);
      }
    };

    socket.on('valet:new', handleNewValet);
    socket.on('valet:updated', handleUpdateValet);

    return () => {
      window.removeEventListener('click', handleGesture);
      socket.off('valet:new', handleNewValet);
      socket.off('valet:updated', handleUpdateValet);
    };
  }, [status, refetchQueue, refetchSlots]);



  const handleCheckinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!carNumber || !brand || !model || !color || !selectedSlot || !keyTag || !guestName || !roomNumber || !guestPhone || !guestEmail) {
      alert('Please fill in all required fields.');
      return;
    }
    if (!photoFront || !photoRear || !photoLeft || !photoRight || !photoDashboard) {
      alert('Please upload all 5 required vehicle photos.');
      return;
    }

    const payload = {
      carNumber: carNumber.toUpperCase(),
      brand,
      model,
      color,
      parkingSlot: selectedSlot,
      fuelLevel,
      odometer: odometer ? Number(odometer) : undefined,
      keyTag,
      guestInfo: {
        name: guestName,
        roomNumber,
        phone: guestPhone,
        email: guestEmail
      }
    };

    const formData = new FormData();
    formData.append('data', JSON.stringify(payload));
    formData.append('front', photoFront);
    formData.append('rear', photoRear);
    formData.append('left', photoLeft);
    formData.append('right', photoRight);
    formData.append('dashboard', photoDashboard);
    
    photoDamageList.forEach((file) => {
      formData.append('damage', file);
    });

    checkinMutation.mutate(formData);
  };

  const handleSignOut = () => {
    void logout().then(() => {
      router.replace('/login');
    });
  };

  // Filter lists based on search
  const filterVehicles = (list?: Vehicle[]) => {
    if (!list) return [];
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(v => 
      v.carNumber.toLowerCase().includes(query) ||
      v.guestInfo.name.toLowerCase().includes(query) ||
      v.guestInfo.roomNumber.toLowerCase().includes(query)
    );
  };

  const filteredQueue = filterVehicles(activeQueue);
  const filteredHistory = filterVehicles(historyQueue);

  if (status !== 'authenticated') {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-100 font-sans text-zinc-800">
      {/* Sidebar navigation */}
      <aside className="w-full md:w-64 bg-zinc-950 text-zinc-300 flex flex-col justify-between p-4 md:p-6 shrink-0 border-b md:border-b-0 border-zinc-900 sticky top-0 z-30">
        {/* Mobile Layout Structure */}
        <div className="md:hidden w-full flex flex-col gap-3.5">
          {/* Mobile Top Row: Logo & Logout */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5">
              <div className="bg-brand rounded-lg p-1.5 text-white">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <span className="font-extrabold text-white text-sm block">Valet Terminal</span>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Hotel Gated Entry</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm">
                {user?.name?.slice(0, 2) ?? 'VM'}
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Mobile Tabs Row */}
          <nav className="grid grid-cols-3 gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-900">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'queue' ? 'bg-zinc-800 text-white shadow-sm border border-zinc-705/30' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FolderSync className="h-3.5 w-3.5 shrink-0" />
              <span>Queue</span>
            </button>
            <button
              onClick={() => setActiveTab('checkin')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'checkin' ? 'bg-zinc-800 text-white shadow-sm border border-zinc-705/30' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Check-In</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'history' ? 'bg-zinc-800 text-white shadow-sm border border-zinc-705/30' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Logs</span>
            </button>
          </nav>
        </div>

        {/* Desktop Layout Structure */}
        <div className="hidden md:flex flex-col gap-8 w-full">
          <div className="flex items-center gap-2.5">
            <div className="bg-brand rounded-lg p-1.5 text-white">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold text-white text-base block">Valet Terminal</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Hotel Gated Entry</span>
            </div>
          </div>

          <nav className="flex flex-col gap-1 space-y-1">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'queue' ? 'bg-zinc-800 text-white shadow-sm' : 'hover:bg-zinc-900/50'
              }`}
            >
              <FolderSync className="h-4 w-4 shrink-0" />
              <span>Live Queue</span>
            </button>
            <button
              onClick={() => setActiveTab('checkin')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'checkin' ? 'bg-zinc-800 text-white shadow-sm' : 'hover:bg-zinc-900/50'
              }`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>New Check-In</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'history' ? 'bg-zinc-800 text-white shadow-sm' : 'hover:bg-zinc-900/50'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>Delivered Logs</span>
            </button>
          </nav>
        </div>

        {/* User Profile & Sign Out - Desktop */}
        <div className="hidden md:block space-y-4 pt-6 border-t border-zinc-900 mt-auto w-full">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-white uppercase shadow-sm">
              {user?.name?.slice(0, 2) ?? 'VM'}
            </div>
            <div>
              <span className="font-bold text-white text-xs block truncate max-w-[140px]">{user?.name}</span>
              <span className="text-[10px] text-zinc-500 block truncate max-w-[140px]">{user?.email}</span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="bg-white border-b border-zinc-200 px-4 md:px-8 py-4 md:py-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
          <div>
            <h1 className="text-lg md:text-xl font-black text-zinc-900">
              {activeTab === 'queue' ? 'Live Order Queue' : activeTab === 'checkin' ? 'Register Check-In' : 'Delivered Logs'}
            </h1>
            <p className="text-[10px] md:text-xs text-zinc-400 font-medium">Hotel Parking Slots & Valet State Panel</p>
          </div>

          <div className="w-full sm:w-72 relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search car, name, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-xs font-semibold text-zinc-800 placeholder-zinc-400 shadow-inner focus:border-brand focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Live Queue Kanban Tab */}
            {activeTab === 'queue' && (
              <motion.div
                key="queue"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {isLoadingQueue ? (
                  <div className="flex justify-center items-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-brand" />
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-4 items-start">
                    {/* Columns Definitions */}
                    {[
                      { key: 'PARKED', title: 'Parked', color: 'bg-emerald-500', list: filteredQueue.filter(v => v.status === 'PARKED') },
                      { key: 'REQUESTED', title: 'Requested', color: 'bg-amber-500', list: filteredQueue.filter(v => v.status === 'REQUESTED') },
                      { key: 'BRINGING', title: 'Bringing', color: 'bg-blue-500', list: filteredQueue.filter(v => v.status === 'BRINGING') },
                      { key: 'READY', title: 'Ready Outside', color: 'bg-brand', list: filteredQueue.filter(v => v.status === 'READY') }
                    ].map((col) => (
                      <div key={col.key} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-4 border-b border-zinc-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                            <h3 className="font-extrabold text-sm text-zinc-800">{col.title}</h3>
                          </div>
                          <span className="rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-xs font-bold text-zinc-500 shadow-sm">
                            {col.list.length}
                          </span>
                        </div>

                        <div className="space-y-3 flex-1 overflow-y-auto">
                          {col.list.length === 0 ? (
                            <div className="h-full flex flex-col justify-center items-center py-12 text-center text-zinc-400">
                              <span className="text-xl mb-1">📭</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider">Empty</span>
                            </div>
                          ) : (
                            col.list.map((car) => (
                              <div key={car._id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm text-left hover:border-zinc-300 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="text-[10px] font-bold font-mono tracking-wider text-zinc-400 block">Plate</span>
                                    <span className="text-sm font-extrabold text-zinc-900 uppercase">{car.carNumber}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold tracking-wider text-zinc-400 block">Room</span>
                                    <span className="text-xs font-bold text-zinc-800">#{car.guestInfo.roomNumber}</span>
                                  </div>
                                </div>

                                <div className="space-y-1 mb-4 text-[11px] text-zinc-500 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                    <span>Slot: <strong>{car.parkingSlot}</strong></span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Key className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                    <span>Key Tag: <strong>{car.keyTag}</strong></span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                    <span className="truncate">Guest: {car.guestInfo.name}</span>
                                  </div>
                                </div>

                                <div className="flex gap-2 mb-3 pt-2 border-t border-zinc-100">
                                  <button
                                    type="button"
                                    onClick={() => window.open(`${api.defaults.baseURL}/valet/vehicles/${car._id}/ticket`, '_blank')}
                                    className="flex-1 text-center py-1 rounded-lg border border-zinc-200 bg-zinc-50 text-[10px] font-bold text-zinc-600 hover:bg-zinc-100 transition-colors"
                                  >
                                    Ticket PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => window.open(`${api.defaults.baseURL}/valet/vehicles/${car._id}/receipt`, '_blank')}
                                    className="flex-1 text-center py-1 rounded-lg border border-zinc-200 bg-zinc-50 text-[10px] font-bold text-zinc-600 hover:bg-zinc-100 transition-colors"
                                  >
                                    Receipt PDF
                                  </button>
                                </div>

                                {/* Status actions */}
                                <div className="pt-2 border-t border-zinc-100 flex justify-end">
                                  {car.status === 'PARKED' && (
                                    <button
                                      onClick={() => statusMutation.mutate({ id: car._id, newStatus: 'BRINGING' })}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-1.5 text-xs font-semibold text-white transition-all hover:bg-zinc-800"
                                    >
                                      Retrieve Car
                                    </button>
                                  )}
                                  {car.status === 'REQUESTED' && (
                                    <button
                                      onClick={() => statusMutation.mutate({ id: car._id, newStatus: 'BRINGING' })}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 bg-amber px-2.5 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-105"
                                    >
                                      <Play className="h-3 w-3 fill-current shrink-0" />
                                      Bring Car
                                    </button>
                                  )}
                                  {car.status === 'BRINGING' && (
                                    <button
                                      onClick={() => statusMutation.mutate({ id: car._id, newStatus: 'READY' })}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-105"
                                    >
                                      Ready Outside
                                    </button>
                                  )}
                                  {car.status === 'READY' && (
                                    <button
                                      onClick={() => statusMutation.mutate({ id: car._id, newStatus: 'DELIVERED' })}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-105"
                                    >
                                      Deliver to Guest
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Check-in Tab */}
            {activeTab === 'checkin' && (
              <motion.div
                key="checkin"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto rounded-3xl border border-zinc-200 bg-white p-8 shadow-md text-left"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-zinc-100 pb-5">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-950">New Valet Entry Registration</h2>
                    <p className="text-xs text-zinc-500">Fill in the guest occupant details, vehicle information, and complete the mandatory inspection checklist photos.</p>
                  </div>
                </div>


                <form onSubmit={handleCheckinSubmit} className="space-y-8">
                  {/* Step 1: Guest Occupant Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">1</span>
                      Guest Details
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Room Number *</label>
                        <input
                          type="text"
                          required
                          value={roomNumber}
                          onChange={(e) => setRoomNumber(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-zinc-500">Guest Name *</label>
                        <input
                          type="text"
                          required
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Phone Number *</label>
                        <input
                          type="text"
                          required
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-zinc-500">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                    {isPrefilled && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md inline-block">
                        ✓ Occupant details loaded from active dining reservation.
                      </span>
                    )}
                  </div>

                  {/* Step 2: Vehicle Specs */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">2</span>
                      Vehicle Information
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Car Number *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. KA-03-MR-9821"
                          value={carNumber}
                          onChange={(e) => setCarNumber(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 uppercase shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Brand / Make *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Mercedes-Benz"
                          value={brand}
                          onChange={(e) => setBrand(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Model *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. C-Class"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Color *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Silver"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Parking Slot *</label>
                        <select
                          required
                          value={selectedSlot}
                          onChange={(e) => setSelectedSlot(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        >
                          <option value="">Select a Slot</option>
                          {slots?.map(s => (
                            <option key={s._id} value={s.slotNumber} disabled={s.isOccupied}>
                              {s.slotNumber} {s.isOccupied ? '(Occupied)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Key Tag *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. K-104"
                          value={keyTag}
                          onChange={(e) => setKeyTag(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Fuel Level</label>
                        <select
                          value={fuelLevel}
                          onChange={(e) => setFuelLevel(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        >
                          <option value="Empty">Empty</option>
                          <option value="Quarter Tank">Quarter Tank</option>
                          <option value="Half Tank">Half Tank</option>
                          <option value="Three Quarter">Three Quarter</option>
                          <option value="Full Tank">Full Tank</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Odometer (Optional)</label>
                        <input
                          type="number"
                          placeholder="Current mileage"
                          value={odometer}
                          onChange={(e) => setOdometer(e.target.value)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Photos Check-in */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">3</span>
                      Vehicle Inspection Photos
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                      {[
                        { label: 'Front Angle *', file: photoFront, setter: setPhotoFront },
                        { label: 'Rear Angle *', file: photoRear, setter: setPhotoRear },
                        { label: 'Left Side *', file: photoLeft, setter: setPhotoLeft },
                        { label: 'Right Side *', file: photoRight, setter: setPhotoRight },
                        { label: 'Dashboard / Odo *', file: photoDashboard, setter: setPhotoDashboard }
                      ].map((inp, idx) => (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-zinc-500">{inp.label}</span>
                          <label className="flex flex-col items-center justify-center border border-dashed border-zinc-200 hover:border-zinc-300 rounded-xl bg-zinc-50 h-28 cursor-pointer select-none transition-colors relative overflow-hidden">
                            {inp.file ? (
                              <div className="absolute inset-0 p-1 bg-white">
                                <img
                                  src={URL.createObjectURL(inp.file)}
                                  alt="Preview"
                                  className="w-full h-full object-cover rounded-lg"
                                />
                                <span className="absolute bottom-1 right-1 rounded bg-zinc-950/80 px-1 text-[8px] font-bold text-white font-mono uppercase">Change</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Plus className="h-5 w-5 text-zinc-400" />
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Upload</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              required={!inp.file}
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) inp.setter(f);
                              }}
                            />
                          </label>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2">
                      <span className="text-xs font-bold text-zinc-500">Damage Photos (Optional)</span>
                      <div className="flex flex-wrap gap-4 items-center">
                        {photoDamageList.map((file, idx) => (
                          <div key={idx} className="relative h-20 w-20 border border-zinc-200 bg-white rounded-xl p-0.5 shrink-0 overflow-hidden">
                            <img
                              src={URL.createObjectURL(file)}
                              alt="Damage preview"
                              className="w-full h-full object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => setPhotoDamageList(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold font-mono focus:outline-none"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {photoDamageList.length < 5 && (
                          <label className="flex flex-col items-center justify-center border border-dashed border-zinc-200 hover:border-zinc-300 rounded-xl bg-zinc-50 h-20 w-20 cursor-pointer select-none transition-colors">
                            <Plus className="h-4 w-4 text-zinc-400" />
                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Damage</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setPhotoDamageList(prev => [...prev, f]);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-6 border-t border-zinc-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('queue')}
                      className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={checkinMutation.isPending}
                      className="rounded-xl bg-zinc-950 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-zinc-800 active:scale-95 disabled:opacity-75"
                    >
                      {checkinMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking-In Vehicle…
                        </span>
                      ) : (
                        'Complete Check-In'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* History logs Tab */}
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {isLoadingHistory ? (
                  <div className="flex justify-center items-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-brand" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Desktop View Table - Hidden on Mobile */}
                    <div className="hidden md:block rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-x-auto text-left">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200 text-zinc-400 font-bold uppercase tracking-wider">
                            <th className="py-3 px-4">Car Plate</th>
                            <th className="py-3 px-4">Guest Occupant</th>
                            <th className="py-3 px-4">Room No</th>
                            <th className="py-3 px-4">Parking Slot</th>
                            <th className="py-3 px-4">Key Tag</th>
                            <th className="py-3 px-4">Check-In Date</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                          {filteredHistory.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-zinc-400 font-semibold">
                                No history entries found matching filters.
                              </td>
                            </tr>
                          ) : (
                            filteredHistory.map((car) => (
                              <tr key={car._id} className="hover:bg-zinc-50 transition-colors">
                                <td className="py-3.5 px-4 font-bold text-zinc-900 uppercase tracking-wider">{car.carNumber}</td>
                                <td className="py-3.5 px-4">{car.guestInfo.name}</td>
                                <td className="py-3.5 px-4 font-bold">Room {car.guestInfo.roomNumber}</td>
                                <td className="py-3.5 px-4">{car.parkingSlot}</td>
                                <td className="py-3.5 px-4 font-mono">{car.keyTag}</td>
                                <td className="py-3.5 px-4 text-zinc-400">
                                  {new Date(car.checkedInAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-bold text-zinc-500 border border-zinc-200">
                                    {car.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => window.open(`${api.defaults.baseURL}/valet/vehicles/${car._id}/receipt`, '_blank')}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 hover:border-zinc-350 bg-white hover:bg-zinc-50 px-2.5 py-1.5 text-xs font-bold text-zinc-700 transition-colors shadow-sm mr-2"
                                  >
                                    Receipt PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedHistoryVehicle(car)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 hover:border-zinc-350 bg-white hover:bg-zinc-50 px-2.5 py-1.5 text-xs font-bold text-zinc-700 transition-colors shadow-sm"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-brand" />
                                    View Photos
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View Card List - Hidden on Desktop */}
                    <div className="md:hidden space-y-3.5">
                      {filteredHistory.length === 0 ? (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-400 font-semibold text-xs">
                          No history entries found matching filters.
                        </div>
                      ) : (
                        filteredHistory.map((car) => (
                          <div
                            key={car._id}
                            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm text-left space-y-3"
                          >
                            {/* Card Header: Car Plate & Slot */}
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Car Plate</span>
                                <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">{car.carNumber}</h3>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Parking Slot</span>
                                <span className="inline-block rounded-lg bg-zinc-100 border border-zinc-200 px-2 py-1 text-xs font-black text-zinc-700">{car.parkingSlot}</span>
                              </div>
                            </div>

                            {/* Card Details Grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-zinc-100 py-2.5">
                              <div>
                                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Guest Name</span>
                                <span className="font-extrabold text-zinc-800">{car.guestInfo.name}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Room Number</span>
                                <span className="font-extrabold text-zinc-800">Room {car.guestInfo.roomNumber}</span>
                              </div>
                              <div className="mt-1">
                                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Key Tag</span>
                                <span className="font-mono font-bold text-zinc-700">{car.keyTag}</span>
                              </div>
                              <div className="mt-1">
                                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Date</span>
                                <span className="text-zinc-500 font-medium text-[10px]">
                                  {new Date(car.checkedInAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                            </div>

                            {/* Card Footer: Status & Actions */}
                            <div className="flex items-center justify-between gap-3 pt-1">
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-extrabold text-zinc-500 border border-zinc-200 uppercase">
                                {car.status}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => window.open(`${api.defaults.baseURL}/valet/vehicles/${car._id}/receipt`, '_blank')}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-black text-zinc-700 transition-colors shadow-sm"
                                >
                                  Receipt PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedHistoryVehicle(car)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-black text-zinc-700 transition-colors shadow-sm"
                                >
                                  <Eye className="h-3.5 w-3.5 text-brand" />
                                  View Photos
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Inspection Photos Gallery Modal Overlay */}
      {selectedHistoryVehicle && (
        <div className="fixed inset-0 z-40 flex items-start md:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto pt-10 md:pt-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl space-y-6 relative border border-zinc-100 max-h-[90vh] overflow-y-auto text-left my-auto">
            <button
              onClick={() => setSelectedHistoryVehicle(null)}
              className="absolute right-6 top-6 rounded-full p-2 bg-zinc-50 border border-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors shadow-sm"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-brand">Logs Gallery</span>
              <h2 className="text-xl font-extrabold mt-1 text-zinc-950 flex items-center gap-2">
                Inspection Photos - <span className="uppercase text-brand">{selectedHistoryVehicle.carNumber}</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Uploaded check-in records for Room {selectedHistoryVehicle.guestInfo.roomNumber} ({selectedHistoryVehicle.guestInfo.name}).
              </p>
            </div>

            {/* Photos Grid */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Mandatory 5-Angle Photos</h3>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                {[
                  { title: 'Front Angle', url: selectedHistoryVehicle.photos.front?.url },
                  { title: 'Rear Angle', url: selectedHistoryVehicle.photos.rear?.url },
                  { title: 'Left Side', url: selectedHistoryVehicle.photos.left?.url },
                  { title: 'Right Side', url: selectedHistoryVehicle.photos.right?.url },
                  { title: 'Dashboard / Odo', url: selectedHistoryVehicle.photos.dashboard?.url }
                ].map((item, idx) => (
                  <div key={idx} className="group relative rounded-2xl border border-zinc-200 bg-zinc-50 overflow-hidden shadow-sm aspect-[4/3] flex flex-col justify-between hover:border-brand/40 transition-colors">
                    <div className="w-full h-full relative overflow-hidden bg-zinc-950 flex items-center justify-center cursor-zoom-in" onClick={() => setLightboxUrl(item.url)}>
                      {item.url ? (
                        <img
                          src={item.url}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="text-xs text-zinc-500">No Image</span>
                      )}
                    </div>
                    <div className="bg-white border-t border-zinc-100 p-2 text-center">
                      <span className="text-[10px] font-black text-zinc-800">{item.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Damage photos section if any */}
            {selectedHistoryVehicle.photos.damage && selectedHistoryVehicle.photos.damage.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Reported Pre-existing Damages</h3>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                  {selectedHistoryVehicle.photos.damage.map((img, idx) => (
                    <div key={idx} className="group relative rounded-2xl border border-zinc-200 bg-zinc-50 overflow-hidden shadow-sm aspect-[4/3] flex flex-col justify-between hover:border-red-400/40 transition-colors">
                      <div className="w-full h-full relative overflow-hidden bg-zinc-950 flex items-center justify-center cursor-zoom-in" onClick={() => setLightboxUrl(img.url)}>
                        {img.url && (
                          <img
                            src={img.url}
                            alt={`Damage Log #${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        )}
                      </div>
                      <div className="bg-white border-t border-zinc-100 p-2 text-center">
                        <span className="text-[10px] font-black text-red-600">Damage File #{idx + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Overlay */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4" onClick={() => setLightboxUrl(null)}>
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-6 top-6 rounded-full p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Inspection Zoom"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}

      {/* Visual Notification Toast Stack */}
      <div className="fixed top-6 right-6 z-50 space-y-3 w-80 max-w-full pointer-events-none">
        <AnimatePresence>
          {valetAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="pointer-events-auto bg-zinc-950 text-white rounded-2xl p-4 shadow-xl border border-zinc-800 flex gap-3 relative overflow-hidden text-left"
            >
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5">
                <Car className="h-24 w-24 text-white" />
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 animate-bounce mt-1">
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-500">Retrieval Request</span>
                <h4 className="text-xs font-black text-white uppercase mt-0.5 truncate">{alert.carNumber}</h4>
                <div className="text-[10px] text-zinc-400 mt-1 space-y-0.5">
                  <p>Guest: <strong className="text-zinc-200">{alert.guestName}</strong></p>
                  <p>Room: <strong className="text-zinc-200">Room {alert.roomNumber}</strong></p>
                  <p>Slot: <strong className="text-zinc-200">{alert.slot}</strong></p>
                  <p className="text-[9px] text-zinc-500 pt-1">Requested at {alert.time}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('queue');
                      setValetAlerts(prev => prev.filter(a => a.id !== alert.id));
                    }}
                    className="rounded-lg bg-white px-2.5 py-1 text-[9px] font-bold text-zinc-950 transition-colors hover:bg-zinc-150"
                  >
                    View Queue
                  </button>
                  <button
                    onClick={() => setValetAlerts(prev => prev.filter(a => a.id !== alert.id))}
                    className="rounded-lg border border-zinc-800 px-2.5 py-1 text-[9px] font-bold text-zinc-400 transition-colors hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
