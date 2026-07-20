'use client';

import { useState } from 'react';
import { useAdminRooms, useRoomMutations, type AdminRoom } from '@/hooks/useAdminRooms';
import { AdminShell } from '@/components/admin/AdminShell';
import { Card, CenteredSpinner, EmptyState, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Brush, CheckCircle, ClipboardList, Info, ShieldAlert, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HousekeepingPage() {
  const { data: rooms, isLoading, isError, refetch } = useAdminRooms();
  const { setStatus } = useRoomMutations();

  // Selected room for checklist
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // Checklist item states for selected room
  const [checklist, setChecklist] = useState({
    linens: false,
    bathroom: false,
    minibar: false,
    dusting: false,
    amenities: false,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'OCCUPIED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CLEANING':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse';
      case 'MAINTENANCE':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-zinc-100 text-zinc-700';
    }
  };

  if (isLoading) {
    return (
      <AdminShell>
        <CenteredSpinner label="Loading housekeeping workspace..." />
      </AdminShell>
    );
  }

  const allRooms = rooms ?? [];
  const cleaningRooms = allRooms.filter(r => r.status === 'CLEANING' || r.status === 'MAINTENANCE');
  
  // Statistics
  const total = allRooms.length;
  const available = allRooms.filter(r => r.status === 'AVAILABLE').length;
  const occupied = allRooms.filter(r => r.status === 'OCCUPIED').length;
  const cleaning = allRooms.filter(r => r.status === 'CLEANING').length;
  const maintenance = allRooms.filter(r => r.status === 'MAINTENANCE').length;

  const handleSelectRoom = (room: AdminRoom) => {
    setSelectedRoomId(room._id);
    setChecklist({
      linens: false,
      bathroom: false,
      minibar: false,
      dusting: false,
      amenities: false,
    });
  };

  const handleToggleChecklist = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isChecklistComplete = Object.values(checklist).every(v => v);

  const handleMarkClean = async (id: string) => {
    await setStatus.mutateAsync({ id, status: 'AVAILABLE' });
    setSelectedRoomId(null);
  };

  return (
    <AdminShell>
      <div className="space-y-6 font-sans">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Brush className="h-6 w-6 text-brand" /> Housekeeping & Maintenance
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Track room status, check off cleaning logs, and release rooms for bookings</p>
        </div>

        {/* Dashboard Statistics Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card className="p-4 flex flex-col justify-between border-t-2 border-t-zinc-400">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Total Rooms</span>
            <span className="text-2xl font-bold mt-1 text-zinc-800">{total}</span>
          </Card>
          <Card className="p-4 flex flex-col justify-between border-t-2 border-t-green-500">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Available</span>
            <span className="text-2xl font-bold mt-1 text-green-600">{available}</span>
          </Card>
          <Card className="p-4 flex flex-col justify-between border-t-2 border-t-blue-500">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Occupied</span>
            <span className="text-2xl font-bold mt-1 text-blue-600">{occupied}</span>
          </Card>
          <Card className="p-4 flex flex-col justify-between border-t-2 border-t-yellow-500">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Cleaning Queue</span>
            <span className="text-2xl font-bold mt-1 text-yellow-600">{cleaning}</span>
          </Card>
          <Card className="p-4 flex flex-col justify-between border-t-2 border-t-red-500">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">Maintenance</span>
            <span className="text-2xl font-bold mt-1 text-red-600">{maintenance}</span>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cleaning Queue List */}
          <div className="lg:col-span-8 space-y-4">
            <h2 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5 uppercase tracking-wider">
              Cleaning & Repair Tasks ({cleaningRooms.length})
            </h2>

            {cleaningRooms.length === 0 ? (
              <EmptyState
                title="All Rooms Clean!"
                description="There are currently no rooms marked for cleaning or maintenance."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cleaningRooms.map(r => (
                  <Card
                    key={r._id}
                    className={`p-5 flex flex-col justify-between cursor-pointer border-l-4 transition-all ${
                      selectedRoomId === r._id
                        ? 'border-l-brand bg-brand/5 shadow-md border-brand/20 scale-[1.01]'
                        : 'border-l-yellow-400 hover:shadow-md'
                    }`}
                    onClick={() => handleSelectRoom(r)}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b pb-2 mb-3">
                        <span className="font-extrabold text-zinc-800 text-sm">Room {r.roomNumber}</span>
                        <Badge className={`text-[10px] font-semibold ${getStatusColor(r.status)}`}>
                          {r.status}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-xs text-zinc-500">
                        <p>Floor: {r.floor}</p>
                        <p>QR code: {r.qr.isActive ? 'Active' : 'Disabled'}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t flex justify-end">
                      <Button size="sm" variant={selectedRoomId === r._id ? 'default' : 'outline'}>
                        {selectedRoomId === r._id ? 'Open Checklist' : 'Start Audit'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Checklist Panel */}
          <div className="lg:col-span-4">
            <AnimatePresence mode="wait">
              {selectedRoomId ? (
                (() => {
                  const activeRoom = cleaningRooms.find(r => r._id === selectedRoomId);
                  if (!activeRoom) return null;

                  return (
                    <motion.div
                      key={selectedRoomId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="sticky top-20"
                    >
                      <Card className="p-5 border-t-4 border-t-brand space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                          <div>
                            <h3 className="font-extrabold text-zinc-800 text-sm">Room {activeRoom.roomNumber} Logs</h3>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Category: {activeRoom.status}</p>
                          </div>
                          <Badge className={getStatusColor(activeRoom.status)}>{activeRoom.status}</Badge>
                        </div>

                        <div className="space-y-3 py-2">
                          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Required Tasks
                          </h4>

                          <label className="flex items-center gap-3 text-xs text-zinc-700 cursor-pointer font-medium p-2 rounded hover:bg-zinc-50 border">
                            <input
                              type="checkbox"
                              checked={checklist.linens}
                              onChange={() => handleToggleChecklist('linens')}
                              className="rounded border-zinc-300 text-brand focus:ring-brand h-4 w-4"
                            />
                            <span>Change Linens & Bedding</span>
                          </label>

                          <label className="flex items-center gap-3 text-xs text-zinc-700 cursor-pointer font-medium p-2 rounded hover:bg-zinc-50 border">
                            <input
                              type="checkbox"
                              checked={checklist.bathroom}
                              onChange={() => handleToggleChecklist('bathroom')}
                              className="rounded border-zinc-300 text-brand focus:ring-brand h-4 w-4"
                            />
                            <span>Bathroom Sanitization</span>
                          </label>

                          <label className="flex items-center gap-3 text-xs text-zinc-700 cursor-pointer font-medium p-2 rounded hover:bg-zinc-50 border">
                            <input
                              type="checkbox"
                              checked={checklist.minibar}
                              onChange={() => handleToggleChecklist('minibar')}
                              className="rounded border-zinc-300 text-brand focus:ring-brand h-4 w-4"
                            />
                            <span>Restock Minibar & Check Items</span>
                          </label>

                          <label className="flex items-center gap-3 text-xs text-zinc-700 cursor-pointer font-medium p-2 rounded hover:bg-zinc-50 border">
                            <input
                              type="checkbox"
                              checked={checklist.dusting}
                              onChange={() => handleToggleChecklist('dusting')}
                              className="rounded border-zinc-300 text-brand focus:ring-brand h-4 w-4"
                            />
                            <span>Vacuuming & Dusting Surfaces</span>
                          </label>

                          <label className="flex items-center gap-3 text-xs text-zinc-700 cursor-pointer font-medium p-2 rounded hover:bg-zinc-50 border">
                            <input
                              type="checkbox"
                              checked={checklist.amenities}
                              onChange={() => handleToggleChecklist('amenities')}
                              className="rounded border-zinc-300 text-brand focus:ring-brand h-4 w-4"
                            />
                            <span>Refill Bathroom Amenities</span>
                          </label>
                        </div>

                        {activeRoom.status === 'MAINTENANCE' && (
                          <div className="rounded-lg bg-red-50/50 border border-red-100 p-3 text-xs text-red-700 flex gap-2">
                            <Info className="h-4 w-4 shrink-0" />
                            <p>Verify that technical/maintenance issues have been fully resolved before release.</p>
                          </div>
                        )}

                        <div className="pt-4 border-t flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setSelectedRoomId(null)}
                          >
                            Close
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            disabled={!isChecklistComplete || setStatus.isPending}
                            onClick={() => handleMarkClean(activeRoom._id)}
                          >
                            <Sparkles className="h-4 w-4 mr-1.5" />
                            Release Room
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })()
              ) : (
                <Card className="p-6 text-center border-dashed border-2 text-zinc-400">
                  <ClipboardList className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                  <p className="text-xs font-semibold">Checklist Drawer</p>
                  <p className="text-[10px] mt-1">Select a room from the cleaning queue to inspect checklist items.</p>
                </Card>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
