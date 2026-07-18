'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Calendar, Plus, Trash2, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { Field, Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { useKitchenMutations } from '@/hooks/useAdminKitchens';
import { api } from '@/lib/api';

const DAYS_OF_WEEK = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

interface HolidayTiming {
  date: string;
  open: string;
  close: string;
  closed: boolean;
}

interface KitchenDetails {
  _id: string;
  name: string;
  temporarilyClosed: boolean;
  weeklySchedule: number[];
  holidayTimings: HolidayTiming[];
  timings?: {
    open: string;
    close: string;
    timezone: string;
  };
}

export default function OperatingHoursPage() {
  const user = useAuthStore((s) => s.user);
  const kitchenId = user?.kitchenId;
  const { update } = useKitchenMutations();

  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [tempClosed, setTempClosed] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [holidayTimings, setHolidayTimings] = useState<HolidayTiming[]>([]);
  
  // New holiday form
  const [newDate, setNewDate] = useState('');
  const [newClosed, setNewClosed] = useState(false);
  const [newOpen, setNewOpen] = useState('08:00');
  const [newClose, setNewClose] = useState('22:00');

  const { data: kitchen, isLoading, refetch } = useQuery({
    queryKey: ['admin-kitchen', kitchenId],
    enabled: !!kitchenId,
    queryFn: async () => {
      const res = await api.get<{ data: { kitchen: KitchenDetails } }>(`/kitchens/${kitchenId}`);
      return res.data.data.kitchen;
    },
  });

  // Load initial settings
  useEffect(() => {
    if (kitchen) {
      setOpenTime(kitchen.timings?.open ?? '08:00');
      setCloseTime(kitchen.timings?.close ?? '22:00');
      setTempClosed(kitchen.temporarilyClosed ?? false);
      setWeeklySchedule(kitchen.weeklySchedule ?? [0, 1, 2, 3, 4, 5, 6]);
      setHolidayTimings(kitchen.holidayTimings ?? []);
    }
  }, [kitchen]);

  const handleDayToggle = (dayVal: number) => {
    setWeeklySchedule((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal].sort()
    );
  };

  const addHoliday = () => {
    if (!newDate) {
      alert('Please select a date.');
      return;
    }
    // Check if date already exists
    if (holidayTimings.some((h) => h.date === newDate)) {
      alert('A holiday override already exists for this date.');
      return;
    }

    const newHoliday: HolidayTiming = {
      date: newDate,
      closed: newClosed,
      open: newClosed ? '00:00' : newOpen,
      close: newClosed ? '00:00' : newClose,
    };

    setHolidayTimings((prev) => [...prev, newHoliday].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate('');
    setNewClosed(false);
  };

  const removeHoliday = (idx: number) => {
    setHolidayTimings((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!kitchenId) return;
    try {
      await update.mutateAsync({
        id: kitchenId,
        input: {
          temporarilyClosed: tempClosed,
          weeklySchedule,
          holidayTimings,
          timings: {
            open: openTime,
            close: closeTime,
            timezone: kitchen?.timings?.timezone ?? 'Asia/Kolkata',
          },
        },
      });
      alert('Operating hours saved successfully!');
      refetch();
    } catch (err) {
      alert('Could not save timings.');
    }
  };

  if (!kitchenId) {
    return (
      <AdminShell>
        <EmptyState title="Not Allowed" description="Only assigned kitchen owners can access timings settings." />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-brand" /> Operating Hours
          </h1>
          <p className="text-sm text-zinc-500">Configure kitchen regular hours, weekly schedule, and holidays</p>
        </div>
        <Button onClick={handleSave} disabled={update.isPending} className="flex items-center gap-1.5">
          {update.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>

      {isLoading ? (
        <CenteredSpinner label="Loading operational parameters…" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column: Standard Timings & Weekly Schedule */}
          <div className="space-y-6">
            {/* Standard Timings & Quick Switch */}
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Standard Operating Times
              </h2>

              <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-4 border border-zinc-200">
                <div>
                  <p className="font-semibold text-zinc-800">Temporarily Closed</p>
                  <p className="text-xs text-zinc-500">Instantly block customer ordering online</p>
                </div>
                <button
                  onClick={() => setTempClosed(!tempClosed)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    tempClosed ? 'bg-red-600' : 'bg-zinc-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      tempClosed ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Open Time">
                  <Input type="time" value={openTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpenTime(e.target.value)} />
                </Field>
                <Field label="Close Time">
                  <Input type="time" value={closeTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCloseTime(e.target.value)} />
                </Field>
              </div>
              <p className="text-xs text-zinc-400">
                Timezone: <span className="font-semibold">{kitchen?.timings?.timezone ?? 'Asia/Kolkata'}</span>
              </p>
            </Card>

            {/* Weekly Schedule */}
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Weekly Schedule
              </h2>
              <p className="text-xs text-zinc-500 mb-4">Select the days of the week when the kitchen is open.</p>

              <div className="space-y-2">
                {DAYS_OF_WEEK.map((day) => {
                  const checked = weeklySchedule.includes(day.value);
                  return (
                    <label
                      key={day.value}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 hover:bg-zinc-50/50 p-2.5 cursor-pointer text-sm font-medium"
                    >
                      <span className="text-zinc-800">{day.label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleDayToggle(day.value)}
                        className="h-4.5 w-4.5 rounded border-zinc-300 text-brand focus:ring-brand"
                      />
                    </label>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right Column: Holiday Overrides */}
          <div className="space-y-6">
            {/* Holiday Overrides Form */}
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-brand" /> Add Holiday/Date Override
              </h2>
              <p className="text-xs text-zinc-500">Configure special timings or full closure for specific dates.</p>

              <div className="space-y-3">
                <Field label="Date">
                  <Input type="date" value={newDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDate(e.target.value)} />
                </Field>

                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="newClosed"
                    checked={newClosed}
                    onChange={(e) => setNewClosed(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-zinc-300 text-brand focus:ring-brand"
                  />
                  <label htmlFor="newClosed" className="text-sm font-medium text-zinc-800 cursor-pointer">
                    Fully Closed on this Date
                  </label>
                </div>

                {!newClosed && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Override Open">
                      <Input type="time" value={newOpen} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOpen(e.target.value)} />
                    </Field>
                    <Field label="Override Close">
                      <Input type="time" value={newClose} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClose(e.target.value)} />
                    </Field>
                  </div>
                )}

                <Button variant="outline" size="sm" onClick={addHoliday} className="w-full flex items-center justify-center gap-1.5">
                  <Plus className="h-4 w-4" /> Add Date Override
                </Button>
              </div>
            </Card>

            {/* List of Holiday Overrides */}
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-500">
                Configured Date Overrides
              </h2>
              {holidayTimings.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-400">No holiday overrides configured</p>
              ) : (
                <div className="space-y-3">
                  {holidayTimings.map((h, i) => (
                    <div
                      key={h.date}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm shadow-sm"
                    >
                      <div>
                        <p className="font-semibold text-zinc-800">
                          {new Date(h.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {h.closed ? (
                            <span className="font-medium text-red-600 uppercase">Fully Closed</span>
                          ) : (
                            <span>
                              Custom Hours: {h.open} – {h.close}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => removeHoliday(i)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        aria-label="Delete override"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
