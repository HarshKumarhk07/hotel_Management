'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, RefreshCw, Settings } from 'lucide-react';
import { KitchenShell } from '@/components/kitchen/KitchenShell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { useAuthStore } from '@/stores/auth';
import { useKitchenMutations } from '@/hooks/useAdminKitchens';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

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
  const kitchenId = useAuthStore((s) => s.user?.kitchenId);
  const { update } = useKitchenMutations();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [serviceChargePercent, setServiceChargePercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [acceptsCOD, setAcceptsCOD] = useState(true);
  const [acceptsRoomBilling, setAcceptsRoomBilling] = useState(true);

  const { data: kitchen, isLoading } = useQuery({
    queryKey: ['kitchen-self', kitchenId],
    enabled: !!kitchenId,
    queryFn: async () => {
      const res = await api.get<{ data: { kitchen: KitchenDetails } }>(`/kitchens/${kitchenId}`);
      return res.data.data.kitchen;
    },
  });

  useEffect(() => {
    if (kitchen) {
      setName(kitchen.name ?? '');
      setDescription(kitchen.description ?? '');
      setContactEmail(kitchen.contactEmail ?? '');
      setContactPhone(kitchen.contactPhone ?? '');
      setServiceChargePercent(kitchen.settings?.serviceChargePercent ?? 0);
      setTaxPercent(kitchen.settings?.taxPercent ?? 0);
      setAcceptsCOD(kitchen.settings?.acceptsCOD ?? true);
      setAcceptsRoomBilling(kitchen.settings?.acceptsRoomBilling ?? true);
    }
  }, [kitchen]);

  const isDirty = !!kitchen && (
    name !== (kitchen.name ?? '') ||
    description !== (kitchen.description ?? '') ||
    contactEmail !== (kitchen.contactEmail ?? '') ||
    contactPhone !== (kitchen.contactPhone ?? '') ||
    serviceChargePercent !== (kitchen.settings?.serviceChargePercent ?? 0) ||
    taxPercent !== (kitchen.settings?.taxPercent ?? 0) ||
    acceptsCOD !== (kitchen.settings?.acceptsCOD ?? true) ||
    acceptsRoomBilling !== (kitchen.settings?.acceptsRoomBilling ?? true)
  );
  useUnsavedChanges(isDirty);

  const handleSave = async () => {
    if (!kitchenId) return;
    try {
      await update.mutateAsync({
        id: kitchenId,
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          settings: { serviceChargePercent, taxPercent, acceptsCOD, acceptsRoomBilling },
        },
      });
      toast.success('Kitchen settings saved!');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save settings'));
    }
  };

  return (
    <KitchenShell>
      {!kitchenId ? (
        <EmptyState title="No kitchen assigned" description="This account is not linked to a kitchen." />
      ) : isLoading ? (
        <CenteredSpinner label="Loading kitchen settings…" />
      ) : (
        <div className="max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                <Settings className="h-6 w-6 text-brand" /> Kitchen Settings
              </h1>
              <p className="text-sm text-zinc-500">Configure your kitchen&apos;s profile and billing preferences.</p>
            </div>
            <div className="flex items-center gap-3">
              {isDirty && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Unsaved changes
                </span>
              )}
              <Button onClick={handleSave} disabled={update.isPending || !isDirty} className="flex items-center gap-1.5">
                {update.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Settings
              </Button>
            </div>
          </div>

          <Card className="p-6 space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 border-b pb-2">Kitchen Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Kitchen Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Contact Email">
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </Field>
              <Field label="Contact Phone">
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Description">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full text-sm rounded-xl border border-zinc-200 p-3 focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-6">
            <h2 className="text-lg font-bold text-zinc-900 border-b pb-2">Billing & Charges</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Service Charge (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={serviceChargePercent}
                  onChange={(e) => setServiceChargePercent(Number(e.target.value))}
                />
              </Field>
              <Field label="Tax (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 cursor-pointer">
                <div>
                  <p className="text-sm font-bold text-zinc-900">Accept Cash on Delivery</p>
                  <p className="text-xs text-zinc-500 mt-1">Allow guests to pay in cash.</p>
                </div>
                <input
                  type="checkbox"
                  checked={acceptsCOD}
                  onChange={(e) => setAcceptsCOD(e.target.checked)}
                  className="h-5 w-5 rounded text-brand focus:ring-brand"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 cursor-pointer">
                <div>
                  <p className="text-sm font-bold text-zinc-900">Accept Room Billing</p>
                  <p className="text-xs text-zinc-500 mt-1">Charge orders to the guest&apos;s room.</p>
                </div>
                <input
                  type="checkbox"
                  checked={acceptsRoomBilling}
                  onChange={(e) => setAcceptsRoomBilling(e.target.checked)}
                  className="h-5 w-5 rounded text-brand focus:ring-brand"
                />
              </label>
            </div>
          </Card>
        </div>
      )}
    </KitchenShell>
  );
}
