'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { Field, Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { useKitchenMutations } from '@/hooks/useAdminKitchens';
import { api } from '@/lib/api';

interface KitchenDetails {
  _id: string;
  name: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  settings: {
    serviceChargePercent: number;
    taxPercent: number;
    acceptsCOD: boolean;
    acceptsRoomBilling: boolean;
  };
}

export default function KitchenSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const kitchenId = user?.kitchenId;
  const { update } = useKitchenMutations();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [serviceCharge, setServiceCharge] = useState(0);
  const [tax, setTax] = useState(5);
  const [acceptsCOD, setAcceptsCOD] = useState(false);
  const [acceptsRoomBilling, setAcceptsRoomBilling] = useState(false);

  const { data: kitchen, isLoading, refetch } = useQuery({
    queryKey: ['admin-kitchen', kitchenId],
    enabled: !!kitchenId,
    queryFn: async () => {
      const res = await api.get<{ data: { kitchen: KitchenDetails } }>(`/kitchens/${kitchenId}`);
      return res.data.data.kitchen;
    },
  });

  // Populate form with current values
  useEffect(() => {
    if (kitchen) {
      setName(kitchen.name);
      setDescription(kitchen.description ?? '');
      setContactEmail(kitchen.contactEmail ?? '');
      setContactPhone(kitchen.contactPhone ?? '');
      setServiceCharge(kitchen.settings?.serviceChargePercent ?? 0);
      setTax(kitchen.settings?.taxPercent ?? 0);
      setAcceptsCOD(kitchen.settings?.acceptsCOD ?? false);
      setAcceptsRoomBilling(kitchen.settings?.acceptsRoomBilling ?? false);
    }
  }, [kitchen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitchenId) return;
    if (!name.trim()) {
      alert('Kitchen name is required.');
      return;
    }

    try {
      await update.mutateAsync({
        id: kitchenId,
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          settings: {
            serviceChargePercent: Number(serviceCharge),
            taxPercent: Number(tax),
            acceptsCOD,
            acceptsRoomBilling,
          },
        },
      });
      alert('Kitchen settings updated successfully!');
      refetch();
    } catch (err) {
      alert('Could not update kitchen settings.');
    }
  };

  if (!kitchenId) {
    return (
      <AdminShell>
        <EmptyState title="Not Allowed" description="Only assigned kitchen owners can edit settings." />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-brand" /> Kitchen Settings
        </h1>
        <p className="text-sm text-zinc-500">Configure your kitchen profile, taxes, fees, and payment settings</p>
      </div>

      {isLoading ? (
        <CenteredSpinner label="Loading settings…" />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Card: Basic Profile Info */}
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Kitchen Profile</h2>
              
              <Field label="Kitchen Name">
                <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required />
              </Field>

              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Tell customers about your kitchen..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-zinc-300 p-2.5 text-sm focus:border-zinc-500 focus:outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Contact Email">
                  <Input type="email" value={contactEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)} />
                </Field>
                <Field label="Contact Phone">
                  <Input type="tel" value={contactPhone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactPhone(e.target.value)} />
                </Field>
              </div>
            </Card>

            {/* Right Card: Financials & Payments */}
            <div className="space-y-6">
              <Card className="p-5 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Tax & Fees</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Service Charge %">
                    <Input type="number" step="0.1" value={serviceCharge} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServiceCharge(Number(e.target.value))} />
                  </Field>
                  <Field label="Tax %">
                    <Input type="number" step="0.1" value={tax} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTax(Number(e.target.value))} />
                  </Field>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Payment Options</h2>
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 rounded-lg border border-zinc-100 hover:bg-zinc-50/50 p-3 cursor-pointer text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={acceptsCOD}
                      onChange={(e) => setAcceptsCOD(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-zinc-300 text-brand focus:ring-brand"
                    />
                    <div>
                      <p className="text-zinc-800">Accept Cash on Delivery (COD)</p>
                      <p className="text-xs text-zinc-400 font-normal">Allow customers to pay in cash upon delivery</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-lg border border-zinc-100 hover:bg-zinc-50/50 p-3 cursor-pointer text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={acceptsRoomBilling}
                      onChange={(e) => setAcceptsRoomBilling(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-zinc-300 text-brand focus:ring-brand"
                    />
                    <div>
                      <p className="text-zinc-800">Accept Room Billing</p>
                      <p className="text-xs text-zinc-400 font-normal">Allow customers to bill their orders to their room</p>
                    </div>
                  </label>
                </div>
              </Card>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending} className="flex items-center gap-1.5 px-6">
              {update.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Settings
            </Button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
