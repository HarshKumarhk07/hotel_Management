'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Card, CenteredSpinner } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { Save, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['global-settings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) => api.put('/settings', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-settings'] });
      setSuccess('Settings updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(apiErrorMessage(err, 'Failed to update settings'));
      setTimeout(() => setError(null), 5000);
    },
  });

  const { register, handleSubmit, reset, control } = useForm({
    defaultValues: data || {
      hotelName: 'The Page Hotel',
      contactEmail: '',
      contactPhone: '',
      address: '',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      tableLockDurationMinutes: 10,
      enableOnlineTableBooking: true,
      enableOnlineRoomBooking: true,
      enableTableAdvancePayment: false,
      tableAdvancePercentage: 20,
    },
    values: data, // Updates the form when data loads
  });

  if (isLoading) {
    return (
      <AdminShell>
        <CenteredSpinner label="Loading settings..." />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Global Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">Configure hotel-wide business and operational settings.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        
        {success && (
          <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 text-sm flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit((values) => updateMutation.mutate(values))} className="space-y-6">
          <Card className="p-6 bg-white border border-zinc-200 shadow-sm rounded-3xl space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 border-b pb-2">Hotel Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Hotel Name">
                <Input {...register('hotelName')} />
              </Field>
              <Field label="Contact Email">
                <Input type="email" {...register('contactEmail')} />
              </Field>
              <Field label="Contact Phone">
                <Input {...register('contactPhone')} />
              </Field>
              <Field label="Currency">
                <Input {...register('currency')} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Address">
                  <textarea 
                    {...register('address')} 
                    rows={3}
                    className="w-full text-sm rounded-xl border border-zinc-200 p-3 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border border-zinc-200 shadow-sm rounded-3xl space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 border-b pb-2">Operational Configurations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Timezone">
                <Input {...register('timezone')} />
              </Field>
              <Field label="Table Lock Duration (Minutes)">
                <Input type="number" min="1" {...register('tableLockDurationMinutes', { valueAsNumber: true })} />
              </Field>
              
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Enable Online Table Booking</h3>
                  <p className="text-xs text-zinc-500 mt-1">Allow customers to book tables online via the website.</p>
                </div>
                <Controller
                  name="enableOnlineTableBooking"
                  control={control}
                  render={({ field }) => (
                    <input 
                      type="checkbox" 
                      checked={field.value} 
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-5 w-5 text-[#D4AF37] rounded focus:ring-[#D4AF37]"
                    />
                  )}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Enable Online Room Booking</h3>
                  <p className="text-xs text-zinc-500 mt-1">Allow customers to book rooms online via the website.</p>
                </div>
                <Controller
                  name="enableOnlineRoomBooking"
                  control={control}
                  render={({ field }) => (
                    <input 
                      type="checkbox" 
                      checked={field.value} 
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-5 w-5 text-[#D4AF37] rounded focus:ring-[#D4AF37]"
                    />
                  )}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Require Table Booking Advance</h3>
                  <p className="text-xs text-zinc-500 mt-1">Force customers to pay an advance deposit for table reservations.</p>
                </div>
                <Controller
                  name="enableTableAdvancePayment"
                  control={control}
                  render={({ field }) => (
                    <input 
                      type="checkbox" 
                      checked={field.value} 
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-5 w-5 text-[#D4AF37] rounded focus:ring-[#D4AF37]"
                    />
                  )}
                />
              </div>

              <Field label="Table Advance Percentage (%)">
                <Input type="number" min="0" max="100" {...register('tableAdvancePercentage', { valueAsNumber: true })} />
              </Field>
            </div>
          </Card>

          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => reset()}
              disabled={updateMutation.isPending}
            >
              Discard Changes
            </Button>
            <Button 
              type="submit" 
              disabled={updateMutation.isPending}
              className="bg-[#D4AF37] hover:bg-[#AE963C] text-white flex items-center gap-2 px-6"
            >
              <Save className="h-4 w-4" /> 
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
